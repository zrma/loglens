import { startTransition, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readTextFileLines } from "@tauri-apps/plugin-fs";
import { getFileName } from "@/features/log-explorer/presentation";
import { parseLogContent, parseLogLineStream, type ParserProgress } from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME } from "@/lib/logs/sample";
import type { ParsedLogSession } from "@/lib/logs/types";

export type LoadProgressState = ParserProgress & {
  sourceLabel: string;
};

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
    applySession(parseLogContent(content), label, path);
  }, [applySession]);

  const selectLogFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Log Files",
          extensions: ["log", "txt"],
        }],
        defaultPath: "~/",
        directory: false,
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const nextLabel = getFileName(selected) ?? selected;

      try {
        await invoke("allow_file_access", { path: selected });
        setLoadProgress({
          sourceLabel: nextLabel,
          lineCount: 0,
          eventCount: 0,
          diagnosticCount: 0,
        });

        try {
          const lineStream = await readTextFileLines(selected);
          const parsedSession = await parseLogLineStream(lineStream, {
            onProgress: (progress) => {
              setLoadProgress({
                sourceLabel: nextLabel,
                ...progress,
              });
            },
            reportInterval: 1500,
          });

          applySession(parsedSession, nextLabel, selected);
        } catch {
          const content = await readTextFile(selected);
          loadSession(content, nextLabel, selected);
        }
      } catch (readError) {
        setErrorMessage(readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.");
      } finally {
        setLoadProgress(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }, [applySession, loadSession]);

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
