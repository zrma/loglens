import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readTextFileLines } from "@tauri-apps/plugin-fs";
import { getFileName } from "@/features/log-explorer/presentation";
import {
  getLogAliasPreset,
  LOG_ALIAS_PRESETS,
  type LogAliasPresetId,
} from "@/lib/logs/aliases";
import {
  mergeParsedSessions,
  parseLogContent,
  parseLogLineStream,
  type ParserProgress,
} from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME } from "@/lib/logs/sample";
import type { ParsedLogSession } from "@/lib/logs/types";

export type LoadProgressState = ParserProgress & {
  currentSourceIndex: number;
  sourceLabel: string;
  totalSources: number;
};

type SessionLoadRequest =
  | { kind: "files"; paths: string[] }
  | { kind: "sample" };

function createSourceMeta(label: string, path: string | null) {
  return {
    id: path ?? "sample",
    label,
    path,
  };
}

function normalizeDialogPath(path: string) {
  const trimmed = path.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("file://")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "file:") {
      return trimmed;
    }

    const decodedPath = decodeURIComponent(parsed.pathname);

    if (/^\/[A-Za-z]:\//.test(decodedPath)) {
      return decodedPath.slice(1);
    }

    return decodedPath;
  } catch {
    return trimmed;
  }
}

function normalizeSelectedPaths(selected: string | string[]) {
  return (Array.isArray(selected) ? selected : [selected])
    .map((path) => (typeof path === "string" ? normalizeDialogPath(path) : null))
    .filter((path): path is string => typeof path === "string" && path.length > 0);
}

function summarizeSessionSources(paths: string[]) {
  if (paths.length === 0) {
    return {
      path: null,
      title: null,
    };
  }

  if (paths.length === 1) {
    const [path] = paths;
    return {
      path,
      title: getFileName(path) ?? path,
    };
  }

  return {
    path: null,
    title: `${paths.length}개 파일 세션`,
  };
}

async function allowSelectedFileAccess(path: string) {
  await invoke("allow_file_access", { path });
}

export function useLogSession() {
  const [session, setSession] = useState<ParsedLogSession | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<LoadProgressState | null>(null);
  const [parserPresetId, setParserPresetIdState] = useState<LogAliasPresetId>("auto");
  const activeLoadIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastLoadRequestRef = useRef<SessionLoadRequest | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeLoadIdRef.current += 1;
    };
  }, []);

  const beginLoad = useCallback(() => {
    activeLoadIdRef.current += 1;
    return activeLoadIdRef.current;
  }, []);

  const isActiveLoad = useCallback((loadId: number) => (
    isMountedRef.current && activeLoadIdRef.current === loadId
  ), []);

  const setLoadProgressSafely = useCallback((loadId: number, progress: LoadProgressState | null) => {
    if (!isActiveLoad(loadId)) {
      return;
    }

    setLoadProgress(progress);
  }, [isActiveLoad]);

  const setErrorMessageSafely = useCallback((loadId: number, nextErrorMessage: string | null) => {
    if (!isActiveLoad(loadId)) {
      return;
    }

    setErrorMessage(nextErrorMessage);
  }, [isActiveLoad]);

  const applySession = useCallback((
    loadId: number,
    parsedSession: ParsedLogSession,
    label: string,
    path: string | null,
  ) => {
    if (!isActiveLoad(loadId)) {
      return;
    }

    startTransition(() => {
      if (!isActiveLoad(loadId)) {
        return;
      }

      setSession(parsedSession);
      setSourceLabel(label);
      setSourcePath(path);
      setLoadProgress(null);
      setErrorMessage(null);
    });
  }, [isActiveLoad]);

  const parseSessionContent = useCallback((
    content: string,
    label: string,
    path: string | null,
    presetId: LogAliasPresetId,
  ) => {
    const loadId = beginLoad();
    const parsedSession = parseLogContent(content, {
      aliasPresetId: presetId,
      source: createSourceMeta(label, path),
    });

    applySession(loadId, parsedSession, label, path);
  }, [applySession, beginLoad]);

  const loadSelectedPaths = useCallback(async (paths: string[], presetId: LogAliasPresetId) => {
    const loadId = beginLoad();

    try {
      setErrorMessageSafely(loadId, null);
      const parsedSessions: ParsedLogSession[] = [];

      for (const [index, path] of paths.entries()) {
        if (!isActiveLoad(loadId)) {
          return;
        }

        const nextLabel = getFileName(path) ?? path;
        setLoadProgressSafely(loadId, {
          currentSourceIndex: index + 1,
          sourceLabel: nextLabel,
          totalSources: paths.length,
          lineCount: 0,
          eventCount: 0,
          diagnosticCount: 0,
        });

        await allowSelectedFileAccess(path);

        try {
          const lineStream = await readTextFileLines(path);

          if (!isActiveLoad(loadId)) {
            return;
          }

          const parsedSession = await parseLogLineStream(lineStream, {
            aliasPresetId: presetId,
            onProgress: (progress) => {
              setLoadProgressSafely(loadId, {
                currentSourceIndex: index + 1,
                sourceLabel: nextLabel,
                totalSources: paths.length,
                ...progress,
              });
            },
            reportInterval: 1500,
            source: createSourceMeta(nextLabel, path),
          });

          if (!isActiveLoad(loadId)) {
            return;
          }

          parsedSessions.push(parsedSession);
        } catch {
          const content = await readTextFile(path);

          if (!isActiveLoad(loadId)) {
            return;
          }

          parsedSessions.push(parseLogContent(content, {
            aliasPresetId: presetId,
            source: createSourceMeta(nextLabel, path),
          }));
        }
      }

      if (!isActiveLoad(loadId)) {
        return;
      }

      const mergedSession = parsedSessions.length === 1
        ? parsedSessions[0]
        : mergeParsedSessions(parsedSessions);
      const summary = summarizeSessionSources(paths);

      applySession(loadId, mergedSession, summary.title ?? "No Active Session", summary.path);
    } catch (readError) {
      setErrorMessageSafely(
        loadId,
        readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.",
      );
    } finally {
      setLoadProgressSafely(loadId, null);
    }
  }, [applySession, beginLoad, isActiveLoad, setErrorMessageSafely, setLoadProgressSafely]);

  const reloadSession = useCallback(async (request: SessionLoadRequest, presetId: LogAliasPresetId) => {
    if (request.kind === "sample") {
      parseSessionContent(SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME, null, presetId);
      return;
    }

    await loadSelectedPaths(request.paths, presetId);
  }, [loadSelectedPaths, parseSessionContent]);

  const selectLogFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Log Files",
          extensions: ["log", "txt"],
        }],
        defaultPath: "~/",
        directory: false,
      });

      if (!selected) {
        return;
      }

      const selectedPaths = normalizeSelectedPaths(selected);

      if (selectedPaths.length === 0) {
        return;
      }

      const request: SessionLoadRequest = { kind: "files", paths: selectedPaths };
      lastLoadRequestRef.current = request;
      await reloadSession(request, parserPresetId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }, [parserPresetId, reloadSession]);

  const loadSampleSession = useCallback(() => {
    const request: SessionLoadRequest = { kind: "sample" };
    lastLoadRequestRef.current = request;
    parseSessionContent(SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME, null, parserPresetId);
  }, [parseSessionContent, parserPresetId]);

  const setParserPresetId = useCallback((nextPresetId: LogAliasPresetId) => {
    if (nextPresetId === parserPresetId) {
      return;
    }

    setParserPresetIdState(nextPresetId);

    const lastLoadRequest = lastLoadRequestRef.current;

    if (!lastLoadRequest) {
      return;
    }

    void reloadSession(lastLoadRequest, nextPresetId);
  }, [parserPresetId, reloadSession]);

  const parserPreset = useMemo(
    () => getLogAliasPreset(parserPresetId),
    [parserPresetId],
  );

  return {
    errorMessage,
    loadProgress,
    loadSampleSession,
    parserPreset,
    parserPresetId,
    parserPresetOptions: LOG_ALIAS_PRESETS,
    selectLogFile,
    setParserPresetId,
    session,
    sourceLabel,
    sourcePath,
  };
}
