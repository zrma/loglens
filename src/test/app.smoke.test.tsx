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
      screen.getByRole("heading", { name: /구조화 탐색 세션을 시작해 보세요/i }),
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
    expect(screen.getByText(/trace 내부 parent\/child span 관계를 최소 트리 형태로 재구성합니다/i)).toBeInTheDocument();
    expect(await screen.findByText(/4줄을 하나의 이벤트로 병합했습니다/i)).toBeInTheDocument();
    expect(screen.getAllByText(/span-auth-root/i).length).toBeGreaterThan(0);
  });

  it("streams a selected file line by line and renders the parsed session", async () => {
    tauriMocks.openMock.mockResolvedValue("/tmp/checkout.log");
    tauriMocks.invokeMock.mockResolvedValue(undefined);
    tauriMocks.readTextFileLinesMock.mockResolvedValue(linesFromText(SAMPLE_LOG_CONTENT));

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/checkout.log");
    });
    expect((await screen.findAllByText(/checkout\.log/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/이벤트 스트림/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/trace-checkout-4821/i)).length).toBeGreaterThan(0);
  });
});
