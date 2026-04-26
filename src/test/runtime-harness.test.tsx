import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const tauriMocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  readTextFileLinesMock: vi.fn(),
  readTextFileMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invokeMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: tauriMocks.openMock,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFileLines: tauriMocks.readTextFileLinesMock,
  readTextFile: tauriMocks.readTextFileMock,
}));

async function* linesFromText(text: string) {
  for (const line of text.split("\n")) {
    yield line;
  }
}

async function* generateLargeUiJsonLines(count: number) {
  const startMs = Date.UTC(2026, 2, 8, 12, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const route = index % 2 === 0 ? "/checkout" : "/login";
    const service = `api-${index % 5}`;
    const level = index % 40 === 0 ? "error" : "info";

    yield JSON.stringify({
      timestamp: new Date(startMs + (index * 1000)).toISOString(),
      level,
      service,
      traceId: `trace-ui-large-${Math.floor(index / 10)}`,
      spanId: `span-ui-large-${index}`,
      requestId: `req-ui-large-${Math.floor(index / 10)}`,
      message: `${service} handled ${route} item ${index}`,
      route,
    });
  }
}

function renderApp() {
  return render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

describe("runtime harness", () => {
  beforeEach(() => {
    tauriMocks.invokeMock.mockReset();
    tauriMocks.openMock.mockReset();
    tauriMocks.readTextFileLinesMock.mockReset();
    tauriMocks.readTextFileMock.mockReset();
    tauriMocks.invokeMock.mockResolvedValue(undefined);
    tauriMocks.openMock.mockResolvedValue(null);
    tauriMocks.readTextFileLinesMock.mockResolvedValue(linesFromText(""));
  });

  it("renders a large selected file through the Tauri line stream without DOM blow-up", async () => {
    tauriMocks.openMock.mockResolvedValue("file:///tmp/large-runtime.log");
    tauriMocks.readTextFileLinesMock.mockResolvedValueOnce(generateLargeUiJsonLines(3000));

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로컬 로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.invokeMock).toHaveBeenCalledWith("allow_file_access", { path: "/tmp/large-runtime.log" });
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/large-runtime.log");
      expect(tauriMocks.readTextFileMock).not.toHaveBeenCalled();
    });

    expect(await screen.findByText(/필터 결과 3,000개 이벤트/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/large-runtime\.log/i)).length).toBeGreaterThan(0);

    const eventStream = await screen.findByRole("listbox", { name: /로그 이벤트 스트림/i });
    const renderedRows = within(eventStream).getAllByRole("option");

    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThanOrEqual(24);
    expect(within(eventStream).getByText(/api-0 handled \/checkout item 0/i)).toBeInTheDocument();
  });

  it("falls back to whole-file reading after a line-stream failure", async () => {
    tauriMocks.openMock.mockResolvedValue("file:///tmp/fallback-runtime.log");
    tauriMocks.readTextFileLinesMock.mockRejectedValueOnce(new Error("line stream unavailable"));
    tauriMocks.readTextFileMock.mockResolvedValueOnce(JSON.stringify({
      timestamp: "2026-03-08T10:15:01.500Z",
      level: "info",
      service: "fallback-reader",
      traceId: "trace-fallback-runtime",
      spanId: "span-fallback-runtime",
      requestId: "req-fallback-runtime",
      message: "fallback file reader used",
    }));

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로컬 로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.invokeMock).toHaveBeenCalledWith("allow_file_access", { path: "/tmp/fallback-runtime.log" });
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/fallback-runtime.log");
      expect(tauriMocks.readTextFileMock).toHaveBeenCalledWith("/tmp/fallback-runtime.log");
    });

    expect((await screen.findAllByText(/fallback file reader used/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/필터 결과 1개 이벤트/i)).toBeInTheDocument();
  });

  it("surfaces scoped file access failures before any file read", async () => {
    tauriMocks.openMock.mockResolvedValue("file:///tmp/rejected-runtime.log");
    tauriMocks.invokeMock.mockRejectedValueOnce(new Error("path is outside the allowed scope"));

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로컬 로그 파일 열기/i }));
    });

    expect(await screen.findByText(/파일을 불러오는 중 문제가 발생했습니다/i)).toBeInTheDocument();
    expect(await screen.findByText(/path is outside the allowed scope/i)).toBeInTheDocument();
    expect(tauriMocks.readTextFileLinesMock).not.toHaveBeenCalled();
    expect(tauriMocks.readTextFileMock).not.toHaveBeenCalled();
  });
});
