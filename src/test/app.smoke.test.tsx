import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const tauriMocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  readTextFileMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invokeMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: tauriMocks.openMock,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: tauriMocks.readTextFileMock,
}));

describe("App smoke", () => {
  beforeEach(() => {
    tauriMocks.invokeMock.mockReset();
    tauriMocks.openMock.mockReset();
    tauriMocks.readTextFileMock.mockReset();
    tauriMocks.openMock.mockResolvedValue(null);
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

    fireEvent.click(screen.getByRole("button", { name: /샘플 trace 세션 로드/i }));

    const [cacheMissEvent] = await screen.findAllByText(/cache miss during refresh/i);
    fireEvent.click(cacheMissEvent);

    expect(await screen.findByText("Span Topology")).toBeInTheDocument();
    expect(screen.getByText(/trace 내부 parent\/child span 관계를 최소 트리 형태로 재구성합니다/i)).toBeInTheDocument();
    expect(await screen.findByText(/4줄을 하나의 이벤트로 병합했습니다/i)).toBeInTheDocument();
    expect(screen.getAllByText(/span-auth-root/i).length).toBeGreaterThan(0);
  });
});
