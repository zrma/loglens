import { startTransition, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readTextFileLines } from "@tauri-apps/plugin-fs";
import { getFileName } from "@/features/log-explorer/presentation";
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

export function useLogSession() {
  const [session, setSession] = useState<ParsedLogSession | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<LoadProgressState | null>(null);

  const applySession = useCallback((parsedSession: ParsedLogSession, label: string, path: string | null) => {
    startTransition(() => {
      setSession(parsedSession);
      setSourceLabel(label);
      setSourcePath(path);
      setErrorMessage(null);
    });
  }, []);

  const loadSession = useCallback((content: string, label: string, path: string | null) => {
    applySession(parseLogContent(content, {
      id: path ?? "sample",
      label,
      path,
    }), label, path);
  }, [applySession]);

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

      const selectedPaths = Array.isArray(selected) ? selected : [selected];

      if (selectedPaths.length === 0) {
        return;
      }

      try {
        const parsedSessions: ParsedLogSession[] = [];

        for (const [index, path] of selectedPaths.entries()) {
          const nextLabel = getFileName(path) ?? path;
          await invoke("allow_file_access", { path });
          setLoadProgress({
            currentSourceIndex: index + 1,
            sourceLabel: nextLabel,
            totalSources: selectedPaths.length,
            lineCount: 0,
            eventCount: 0,
            diagnosticCount: 0,
          });

          try {
            const lineStream = await readTextFileLines(path);
            const parsedSession = await parseLogLineStream(lineStream, {
              source: {
                id: path,
                label: nextLabel,
                path,
              },
              onProgress: (progress) => {
                setLoadProgress({
                  currentSourceIndex: index + 1,
                  sourceLabel: nextLabel,
                  totalSources: selectedPaths.length,
                  ...progress,
                });
              },
              reportInterval: 1500,
            });

            parsedSessions.push(parsedSession);
          } catch {
            const content = await readTextFile(path);
            parsedSessions.push(parseLogContent(content, {
              id: path,
              label: nextLabel,
              path,
            }));
          }
        }

        const mergedSession = parsedSessions.length === 1
          ? parsedSessions[0]
          : mergeParsedSessions(parsedSessions);
        const summary = summarizeSessionSources(selectedPaths);

        applySession(mergedSession, summary.title ?? "No Active Session", summary.path);
      } catch (readError) {
        setErrorMessage(readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.");
      } finally {
        setLoadProgress(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }, [applySession]);

  const loadSampleSession = useCallback(() => {
    loadSession(SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME, null);
  }, [loadSession]);

  return {
    errorMessage,
    loadProgress,
    loadSampleSession,
    selectLogFile,
    session,
    sourceLabel,
    sourcePath,
  };
}
