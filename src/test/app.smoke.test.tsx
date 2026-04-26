import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderApp() {
  return render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
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
    renderApp();

    expect(
      screen.getByRole("heading", { name: /분석을 시작하려면 로그를 선택하세요/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /데모 데이터로 체험하기/i })).toBeInTheDocument();
  });

  it("loads the sample session and reveals span topology plus parser notes", async () => {
    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /데모 데이터로 체험하기/i }));
    });

    await act(async () => {
      fireEvent.change(
        await screen.findByPlaceholderText(/메시지, ID, 서비스명 검색/i),
        { target: { value: "cache miss" } },
      );
    });

    expect(await screen.findByText(/Span 토폴로지/i)).toBeInTheDocument();
    expect(await screen.findByText(/이벤트 Diagnostics/i)).toBeInTheDocument();
    expect(await screen.findByText(/multiline_merged/i)).toBeInTheDocument();
    expect(await screen.findByText(/4줄을 하나의 이벤트로 병합했습니다/i)).toBeInTheDocument();
    expect(screen.getAllByText(/span-auth-root/i).length).toBeGreaterThan(0);
  });

  it("lets users add builtin columns to the event stream", async () => {
    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /데모 데이터로 체험하기/i }));
    });

    const eventStream = await screen.findByRole("listbox", { name: /로그 이벤트 스트림/i });

    expect(within(eventStream).queryByText("Source")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Source$/i }));
    });

    expect(within(eventStream).getByText("Source")).toBeInTheDocument();
  });

  it("keeps issue filtering and analysis tab navigation agent-legible", async () => {
    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /데모 데이터로 체험하기/i }));
    });

    expect(await screen.findByText(/필터 결과 11개 이벤트/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /모든 로그/i }));
    });

    expect(await screen.findByText(/필터 결과 2개 이벤트/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/payment provider timeout/i)).length).toBeGreaterThan(0);

    const analysisTab = screen.getByRole("tab", { name: /연관 분석/i });

    await act(async () => {
      fireEvent.mouseDown(analysisTab, { button: 0, ctrlKey: false });
      fireEvent.click(analysisTab);
    });

    expect(analysisTab).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/시간대별 분포/i)).toBeInTheDocument();
    expect(await screen.findByText(/Level 분포/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Parser Diagnostics/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Trace 요약/i)).toBeInTheDocument();
  });

  it("applies and clears analysis drill-down filters", async () => {
    async function clickFirstRowButton(label: RegExp) {
      const button = (await screen.findAllByText(label))
        .map((element) => element.closest("button"))
        .find((element): element is HTMLButtonElement => element !== null);

      if (!button) {
        throw new Error(`No analysis row button found for ${label}`);
      }

      fireEvent.click(button);
    }

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /데모 데이터로 체험하기/i }));
    });

    const analysisTab = await screen.findByRole("tab", { name: /연관 분석/i });

    await act(async () => {
      fireEvent.mouseDown(analysisTab, { button: 0, ctrlKey: false });
      fireEvent.click(analysisTab);
    });

    await act(async () => {
      await clickFirstRowButton(/^ERROR$/i);
    });

    expect(await screen.findByRole("button", { name: /Level ERROR/i })).toBeInTheDocument();

    await act(async () => {
      const tab = screen.getByRole("tab", { name: /이벤트 스트림/i });
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
      fireEvent.click(tab);
    });

    expect(await screen.findByText(/필터 결과 2개 이벤트/i)).toBeInTheDocument();

    await act(async () => {
      const tab = screen.getByRole("tab", { name: /연관 분석/i });
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
      fireEvent.click(tab);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Level ERROR/i }));
    });

    expect(await screen.findByText(/전체 분석 범위/i)).toBeInTheDocument();

    await act(async () => {
      await clickFirstRowButton(/^ERROR$/i);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /분석 조건만 해제/i }));
    });

    expect(await screen.findByText(/전체 분석 범위/i)).toBeInTheDocument();
  });

  it("streams selected files line by line and merges them into one session", async () => {
    tauriMocks.openMock.mockResolvedValue([
      "file:///tmp/checkout.log",
      "file:///tmp/auth.log",
    ]);
    tauriMocks.readTextFileLinesMock
      .mockResolvedValueOnce(linesFromText(SAMPLE_LOG_CONTENT))
      .mockResolvedValueOnce(linesFromText(`
{"timestamp":"2026-03-08T10:15:01.500Z","level":"info","service":"auth-service","traceId":"trace-checkout-4821","spanId":"span-auth-extra","requestId":"req-77","message":"token refreshed","route":"/checkout"}
      `.trim()));

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로컬 로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.invokeMock).toHaveBeenCalledWith("allow_file_access", { path: "/tmp/checkout.log" });
      expect(tauriMocks.invokeMock).toHaveBeenCalledWith("allow_file_access", { path: "/tmp/auth.log" });
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/checkout.log");
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/auth.log");
    });
    expect((await screen.findAllByText(/2개 파일 세션/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/checkout\.log/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/auth\.log/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("tab", { name: /이벤트 스트림/i })).toBeInTheDocument();
    expect((await screen.findAllByText(/trace-checkout-4821/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Trace Diff/i)).toBeInTheDocument();
    expect(document.body).toHaveTextContent("2 sources · 7 events");
    expect(document.body).toHaveTextContent("현재 소스");
    expect(document.body).toHaveTextContent("missing hints");
    expect(document.body).toHaveTextContent("span-auth-extra");
  });

  it("applies custom alias overrides from the field mapping dialog", async () => {
    const customAliasLog = JSON.stringify({
      detail: "custom alias ui message",
      flow: "trace-custom-ui",
      requestKey: "req-custom-ui",
      severityText: "ERROR",
      svcName: "edge-custom-ui",
      unit: "span-custom-ui",
      when: "1741437296000123",
    });

    tauriMocks.openMock.mockResolvedValue("file:///tmp/custom-alias.log");
    tauriMocks.readTextFileLinesMock.mockImplementation(async () => linesFromText(customAliasLog));

    renderApp();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /로컬 로그 파일 열기/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.openMock).toHaveBeenCalledTimes(1);
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledWith("/tmp/custom-alias.log");
    });
    await waitFor(() => {
      expect(document.body).toHaveTextContent("필터 결과 1개 이벤트");
    });

    expect(document.body).toHaveTextContent("서비스 0");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /필드 매핑/i }));
    });

    const dialog = await screen.findByRole("dialog", { name: /필드 매핑/i });

    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText("timestamp alias"), { target: { value: "when" } });
      fireEvent.change(within(dialog).getByLabelText("level alias"), { target: { value: "severityText" } });
      fireEvent.change(within(dialog).getByLabelText("service alias"), { target: { value: "svcName" } });
      fireEvent.change(within(dialog).getByLabelText("message alias"), { target: { value: "detail" } });
      fireEvent.change(within(dialog).getByLabelText("traceId alias"), { target: { value: "flow" } });
      fireEvent.change(within(dialog).getByLabelText("spanId alias"), { target: { value: "unit" } });
      fireEvent.change(within(dialog).getByLabelText("requestId alias"), { target: { value: "requestKey" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /현재 세션 다시 파싱/i }));
    });

    await waitFor(() => {
      expect(tauriMocks.readTextFileLinesMock).toHaveBeenCalledTimes(2);
    });
    expect((await screen.findAllByText(/custom alias active/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/edge-custom-ui/i)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(document.body).toHaveTextContent("서비스 1");
    });
  });
});
