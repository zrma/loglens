import { describe, expect, it } from "vitest";
import {
  buildFieldKeyCounts,
  buildFieldValueCounts,
  buildSpanForest,
  buildTraceGroups,
  filterLogEvents,
} from "@/lib/logs/analysis";
import { mergeParsedSessions, parseLogContent, parseLogLineStream } from "@/lib/logs/parser";
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
      source: "all",
      service: "all",
      traceId: "trace-auth-9912",
      requestId: "all",
      fieldFilters: [],
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

  it("filters and facets by arbitrary structured fields", () => {
    const session = parseLogContent(SAMPLE_LOG_CONTENT);
    const routeOnly = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      source: "all",
      service: "all",
      traceId: "all",
      requestId: "all",
      fieldFilters: [{ key: "route", value: "/checkout", operator: "include" }],
      issuesOnly: false,
    });

    expect(routeOnly).toHaveLength(1);
    expect(routeOnly[0]?.traceId).toBe("trace-checkout-4821");

    const fieldSearch = filterLogEvents(session.events, {
      searchTerm: "stripe",
      level: "all",
      source: "all",
      service: "all",
      traceId: "all",
      requestId: "all",
      fieldFilters: [],
      issuesOnly: false,
    });

    expect(fieldSearch).toHaveLength(1);
    expect(fieldSearch[0]?.fields.provider).toBe("stripe");

    expect(buildFieldKeyCounts(session.events)).toEqual(expect.arrayContaining([
      { label: "route", count: 2 },
      { label: "provider", count: 1 },
    ]));
    expect(buildFieldValueCounts(session.events, "route")).toEqual(expect.arrayContaining([
      { label: "/checkout", count: 1 },
      { label: "/login", count: 1 },
    ]));
  });

  it("combines multiple structured field filters with and semantics", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T10:15:03.441Z","level":"error","service":"payments-api","trace_id":"trace-checkout-4821","span_id":"span-pay-1","request_id":"req-77","message":"payment provider timeout","route":"/checkout","provider":"stripe"}
{"timestamp":"2026-03-08T10:15:05.441Z","level":"info","service":"payments-api","trace_id":"trace-checkout-4821","span_id":"span-pay-2","request_id":"req-77","message":"fallback provider engaged","route":"/checkout","provider":"adyen"}
{"timestamp":"2026-03-08T10:15:07.441Z","level":"info","service":"edge-gateway","trace_id":"trace-auth-9912","span_id":"span-auth-1","request_id":"req-81","message":"login request","route":"/login","provider":"internal"}
    `.trim());
    const filtered = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      source: "all",
      service: "all",
      traceId: "all",
      requestId: "all",
      fieldFilters: [
        { key: "route", value: "/checkout", operator: "include" },
        { key: "provider", value: "stripe", operator: "include" },
      ],
      issuesOnly: false,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.fields.route).toBe("/checkout");
    expect(filtered[0]?.fields.provider).toBe("stripe");
  });

  it("supports excluding a structured field value", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T10:15:03.441Z","level":"error","service":"payments-api","trace_id":"trace-checkout-4821","span_id":"span-pay-1","request_id":"req-77","message":"payment provider timeout","route":"/checkout","provider":"stripe"}
{"timestamp":"2026-03-08T10:15:05.441Z","level":"info","service":"payments-api","trace_id":"trace-checkout-4821","span_id":"span-pay-2","request_id":"req-77","message":"fallback provider engaged","route":"/checkout","provider":"adyen"}
{"timestamp":"2026-03-08T10:15:07.441Z","level":"info","service":"edge-gateway","trace_id":"trace-auth-9912","span_id":"span-auth-1","request_id":"req-81","message":"login request","route":"/login","provider":"internal"}
    `.trim());
    const filtered = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      source: "all",
      service: "all",
      traceId: "all",
      requestId: "all",
      fieldFilters: [{ key: "provider", value: "stripe", operator: "exclude" }],
      issuesOnly: false,
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((event) => event.fields.provider !== "stripe")).toBe(true);
  });

  it("merges multiple parsed sessions and preserves source metadata", () => {
    const checkoutSession = parseLogContent(SAMPLE_LOG_CONTENT, {
      id: "/tmp/checkout.log",
      label: "checkout.log",
      path: "/tmp/checkout.log",
    });
    const authSession = parseLogContent(`
{"timestamp":"2026-03-08T10:15:01.500Z","level":"info","service":"auth-service","traceId":"trace-checkout-4821","spanId":"span-auth-extra","requestId":"req-77","message":"token refreshed","route":"/checkout"}
    `.trim(), {
      id: "/tmp/auth.log",
      label: "auth.log",
      path: "/tmp/auth.log",
    });

    const merged = mergeParsedSessions([checkoutSession, authSession]);

    expect(merged.sources.map((source) => source.label)).toEqual(["checkout.log", "auth.log"]);
    expect(merged.events.some((event) => event.sourceLabel === "checkout.log")).toBe(true);
    expect(merged.events.some((event) => event.sourceLabel === "auth.log")).toBe(true);
    expect(merged.events.filter((event) => event.traceId === "trace-checkout-4821")).toHaveLength(7);
  });

  it("extracts nested json fields and falls back to traceparent context", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:34:56.000Z","severity_text":"ERROR","resource":{"service":{"name":"checkout-api"}},"trace":{"id":"trace-nested-1","span_id":"span-nested-1","parent_id":"span-root-0"},"http":{"request":{"id":"req-9"}},"error":{"message":"payment capture failed"}}
{"timestamp":"2026-03-08T12:34:57.000Z","service":{"name":"auth-api"},"traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01","message":"traceparent fallback"}
    `.trim());

    expect(session.events[0]).toMatchObject({
      level: "error",
      message: "payment capture failed",
      parentSpanId: "span-root-0",
      requestId: "req-9",
      service: "checkout-api",
      spanId: "span-nested-1",
      traceId: "trace-nested-1",
    });

    expect(session.events[1]).toMatchObject({
      message: "traceparent fallback",
      service: "auth-api",
      spanId: "00f067aa0ba902b7",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
  });

  it("merges go panic stack traces into a single event", () => {
    const session = parseLogContent(`
2026-03-08 10:12:11 ERROR payments-api trace_id=trace-go-1 span_id=span-go-root request_id=req-go-1 message="panic while charging card"
goroutine 19 [running]:
main.chargeCard()
\t/app/cmd/server/main.go:42 +0x1af
2026-03-08 10:12:14 INFO payments-api trace_id=trace-go-1 span_id=span-go-recover request_id=req-go-1 message="worker recovered"
    `.trim());

    expect(session.events).toHaveLength(2);
    expect(session.events[0]).toMatchObject({
      endLineNumber: 4,
      isMultiLine: true,
      lineNumber: 1,
      requestId: "req-go-1",
      spanId: "span-go-root",
      traceId: "trace-go-1",
    });
    expect(session.events[0]?.rawLine).toContain("goroutine 19 [running]:");
    expect(session.events[0]?.rawLine).toContain("/app/cmd/server/main.go:42 +0x1af");
    expect(session.events[0]?.parseIssues.some((issue) => issue.kind === "multiline")).toBe(true);
  });
});
