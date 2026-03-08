import { describe, expect, it } from "vitest";
import { buildSpanForest, buildTraceGroups, filterLogEvents } from "@/lib/logs/analysis";
import { parseLogContent, parseLogLineStream } from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT } from "@/lib/logs/sample";

async function* generateLargeLogLines(count: number) {
  for (let index = 0; index < count; index += 1) {
    yield `2026-03-08 12:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")} INFO api-service trace_id=trace-${Math.floor(index / 5)} span_id=span-${index} request_id=req-${Math.floor(index / 5)} message="processed item ${index}"`;
  }
}

describe("parseLogContent", () => {
  it("extracts structured fields from mixed log formats", () => {
    const session = parseLogContent(SAMPLE_LOG_CONTENT);

    expect(session.events).toHaveLength(11);
    expect(session.formatCounts.json).toBe(3);
    expect(session.formatCounts.keyvalue).toBeGreaterThanOrEqual(5);

    const paymentTimeout = session.events.find((event) => event.message.includes("payment provider timeout"));

    expect(paymentTimeout).toMatchObject({
      level: "error",
      service: "payments-api",
      traceId: "trace-checkout-4821",
      spanId: "span-pay",
      parentSpanId: "span-root",
      requestId: "req-77",
    });
  });

  it("merges multiline stack traces into a single event with parser diagnostics", () => {
    const session = parseLogContent(SAMPLE_LOG_CONTENT);
    const cacheMiss = session.events.find((event) => event.spanId === "span-cache");

    expect(cacheMiss).toMatchObject({
      lineNumber: 9,
      endLineNumber: 12,
      isMultiLine: true,
      traceId: "trace-auth-9912",
      level: "error",
    });
    expect(cacheMiss?.rawLine).toContain("Caused by: RedisTimeoutError");
    expect(cacheMiss?.message).toContain("(+3 lines)");
    expect(cacheMiss?.parseIssues.some((issue) => issue.kind === "multiline")).toBe(true);
    expect(session.diagnostics.some((diagnostic) =>
      diagnostic.kind === "multiline" && diagnostic.lineNumber === 9 && diagnostic.endLineNumber === 12
    )).toBe(true);
  });

  it("groups trace events and filters by trace id", () => {
    const session = parseLogContent(SAMPLE_LOG_CONTENT);
    const traces = buildTraceGroups(session.events);

    expect(traces).toHaveLength(2);
    expect(traces[0]?.traceId).toBe("trace-checkout-4821");
    expect(traces[0]?.eventCount).toBe(6);
    expect(traces[0]?.issueCount).toBe(1);

    const filtered = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      service: "all",
      traceId: "trace-auth-9912",
      requestId: "all",
      issuesOnly: false,
    });

    expect(filtered).toHaveLength(4);
    expect(filtered.every((event) => event.traceId === "trace-auth-9912")).toBe(true);
  });

  it("builds a parent-child span forest for a trace", () => {
    const session = parseLogContent(SAMPLE_LOG_CONTENT);
    const forest = buildSpanForest(session.events, "trace-checkout-4821");

    expect(forest).not.toBeNull();
    expect(forest?.totalSpans).toBe(6);
    expect(forest?.roots).toHaveLength(1);
    expect(forest?.roots[0]).toMatchObject({
      spanId: "span-root",
      eventCount: 1,
    });
    expect(forest?.roots[0]?.children.map((child) => child.spanId)).toEqual(expect.arrayContaining([
      "span-auth",
      "span-stock",
      "span-pay",
      "span-fallback",
      "span-mail",
    ]));
  });

  it("parses large logs from an async line stream and reports progress", async () => {
    const progressMarks: number[] = [];
    const session = await parseLogLineStream(generateLargeLogLines(2400), {
      reportInterval: 600,
      onProgress: (progress) => {
        progressMarks.push(progress.lineCount);
      },
    });

    expect(session.events).toHaveLength(2400);
    expect(session.formatCounts.keyvalue).toBe(2400);
    expect(progressMarks).toEqual([600, 1200, 1800, 2400, 2400]);
  });
});
