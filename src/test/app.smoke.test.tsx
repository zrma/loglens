import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { SAMPLE_LOG_CONTENT } from "@/lib/logs/sample";

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

describe("App smoke", () => {
  beforeEach(() => {
    tauriMocks.invokeMock.mockReset();
    tauriMocks.openMock.mockReset();
    tauriMocks.readTextFileLinesMock.mockReset();
    tauriMocks.readTextFileMock.mockReset();
    tauriMocks.openMock.mockResolvedValue(null);
    tauriMocks.readTextFileLinesMock.mockResolvedValue(linesFromText(""));
  });

  it("renders the empty structured explorer shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /로그 세션을 불러오세요/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /샘플 trace 세션 로드/i })).toBeInTheDocument();
  });

  it("loads the sample session and reveals span topology plus parser notes", async () => {
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /샘플 trace 세션 로드/i }));
    });

    await act(async () => {
      fireEvent.change(
        await screen.findByPlaceholderText(/메시지, request id, trace id, service명, 필드 값으로 검색/i),
        { target: { value: "cache miss" } },
      );
    });

    expect(await screen.findByText("Span Topology")).toBeInTheDocument();
    expect(screen.getByText(/trace span 트리입니다/i)).toBeInTheDocument();
    expect(await screen.findByText(/4줄을 하나의 이벤트로 병합했습니다/i)).toBeInTheDocument();
    expect(screen.getAllByText(/span-auth-root/i).length).toBeGreaterThan(0);
  });

  it("streams selected files line by line and merges them into one session", async () => {
    tauriMocks.openMock.mockResolvedValue(["/tmp/checkout.log", "/tmp/auth.log"]);
    tauriMocks.invokeMock.mockResolvedValue(undefined);
    tauriMocks.readTextFileLinesMock
      .mockResolvedValueOnce(linesFromText(SAMPLE_LOG_CONTENT))
      .mockResolvedValueOnce(linesFromText(`
{"timestamp":"2026-03-08T10:15:01.500Z","level":"info","service":"auth-service","traceId":"trace-checkout-4821","spanId":"span-auth-extra","requestId":"req-77","message":"token refreshed","route":"/checkout"}
      `.trim()));

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/checkout.log");
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/auth.log");
    });
    expect((await screen.findAllByText(/2개 파일 세션/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/checkout\.log/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/auth\.log/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/이벤트 스트림/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/trace-checkout-4821/i)).length).toBeGreaterThan(0);
  });
});
