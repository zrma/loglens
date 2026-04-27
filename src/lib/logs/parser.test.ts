import { describe, expect, it } from "vitest";
import {
  buildDerivedFlowGroups,
  buildFieldKeyCounts,
  buildFieldValueCounts,
  buildHourlyChartData,
  buildLevelCounts,
  buildSpanForest,
  buildDerivedFlowGroupForEvent,
  buildFieldFacetSnapshot,
  buildTopDerivedFlowGroupPreviews,
  buildTopTraceGroupPreviews,
  createLogEventMatcher,
  getRelatedEvents,
  getDerivedFlowGroupForEvent,
  buildTraceSourceDiff,
  buildTraceSourceCoverage,
  buildTraceGroups,
  filterLogEvents,
} from "@/lib/logs/analysis";
import { buildLogFieldAliases } from "@/lib/logs/aliases";
import { mergeParsedSessions, parseLogContent, parseLogLineStream } from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT } from "@/lib/logs/sample";

async function* generateLargeLogLines(count: number) {
  for (let index = 0; index < count; index += 1) {
    yield `2026-03-08 12:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")} INFO api-service trace_id=trace-${Math.floor(index / 5)} span_id=span-${index} request_id=req-${Math.floor(index / 5)} message="processed item ${index}"`;
  }
}

async function* generateMixedLargeJsonLines(count: number) {
  const startMs = Date.UTC(2026, 2, 8, 12, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const route = index % 2 === 0 ? "/checkout" : "/login";
    const service = `api-${index % 4}`;
    const level = index % 25 === 0 ? "error" : "info";

    yield JSON.stringify({
      timestamp: new Date(startMs + (index * 1000)).toISOString(),
      level,
      service,
      traceId: `trace-large-${Math.floor(index / 10)}`,
      spanId: `span-large-${index}`,
      requestId: `req-large-${Math.floor(index / 10)}`,
      message: `${service} handled ${route} item ${index}`,
      route,
      tenant: `team-${index % 3}`,
    });
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
    expect(cacheMiss?.parseIssues.some((issue) => issue.kind === "multiline_merged")).toBe(true);
    expect(session.diagnostics.some((diagnostic) =>
      diagnostic.kind === "multiline_merged"
      && diagnostic.lineNumber === 9
      && diagnostic.endLineNumber === 12
      && diagnostic.severity === "info"
      && diagnostic.eventId === cacheMiss?.id
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

  it("orders trace events by timestamp and keeps missing-parent spans visible", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T10:00:03.000Z","level":"error","service":"worker","traceId":"trace-edge-1","spanId":"span-late","parentSpanId":"span-root","requestId":"req-edge-1","message":"late error"}
{"timestamp":"2026-03-08T10:00:01.000Z","level":"info","service":"api","traceId":"trace-edge-1","spanId":"span-root","requestId":"req-edge-1","message":"root start"}
{"timestamp":"2026-03-08T10:00:02.000Z","level":"info","service":"worker","traceId":"trace-edge-1","spanId":"span-orphan","parentSpanId":"span-missing","requestId":"req-edge-1","message":"missing parent child"}
    `.trim());
    const [traceGroup] = buildTraceGroups(session.events);
    const spanForest = buildSpanForest(session.events, "trace-edge-1");

    expect(traceGroup).toMatchObject({
      traceId: "trace-edge-1",
      eventCount: 3,
      issueCount: 1,
      requestIds: ["req-edge-1"],
      spanCount: 3,
    });
    expect(traceGroup?.eventIds).toEqual([
      session.events[1]?.id,
      session.events[2]?.id,
      session.events[0]?.id,
    ]);
    expect(spanForest?.roots.map((node) => node.spanId)).toEqual(["span-root", "span-orphan"]);
    expect(spanForest?.roots[0]?.children.map((node) => node.spanId)).toEqual(["span-late"]);
    expect(spanForest?.maxDepth).toBe(1);
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

  it("keeps large parsed sessions analyzable with deterministic counts", async () => {
    const session = await parseLogLineStream(generateMixedLargeJsonLines(3000), {
      reportInterval: 1000,
    });

    const issueEvents = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      source: "all",
      service: "all",
      traceId: "all",
      requestId: "all",
      fieldFilters: [],
      issuesOnly: true,
    });
    const serviceEvents = filterLogEvents(session.events, {
      searchTerm: "",
      level: "all",
      source: "all",
      service: "api-1",
      traceId: "all",
      requestId: "all",
      fieldFilters: [],
      issuesOnly: false,
    });
    const hourlyChart = buildHourlyChartData(session.events);

    expect(session.events).toHaveLength(3000);
    expect(session.diagnostics).toHaveLength(0);
    expect(issueEvents).toHaveLength(120);
    expect(serviceEvents).toHaveLength(750);
    expect(buildLevelCounts(session.events)).toEqual(expect.arrayContaining([
      { label: "error", count: 120 },
      { label: "info", count: 2880 },
    ]));
    expect(buildFieldValueCounts(session.events, "route")).toEqual(expect.arrayContaining([
      { label: "/checkout", count: 1500 },
      { label: "/login", count: 1500 },
    ]));
    expect(hourlyChart.parsedCount).toBe(3000);
    expect(hourlyChart.data.reduce((total, point) => total + point.count, 0)).toBe(3000);
  });

  it("builds bounded large-session flow previews without materializing every group event id", async () => {
    const session = await parseLogLineStream(generateMixedLargeJsonLines(3000), {
      reportInterval: 1000,
    });

    const topTracePreviews = buildTopTraceGroupPreviews(session.events, 6);
    const topFlowPreviews = buildTopDerivedFlowGroupPreviews(session.events, 6);
    const selectedFlowGroup = buildDerivedFlowGroupForEvent(session.events, session.events[0] ?? null);

    expect(topTracePreviews).toHaveLength(6);
    expect(topTracePreviews.every((group) => group.firstEventId !== null)).toBe(true);
    expect(topTracePreviews.every((group) => group.eventCount === 10)).toBe(true);
    expect(topTracePreviews.every((group) => "eventIds" in group)).toBe(false);
    expect(topFlowPreviews).toHaveLength(6);
    expect(topFlowPreviews.every((group) => group.firstEventId !== null)).toBe(true);
    expect(topFlowPreviews.every((group) => "eventIds" in group)).toBe(false);
    expect(selectedFlowGroup).toMatchObject({
      correlationKind: "request",
      correlationValue: "req-large-0",
      eventCount: 5,
      family: "/checkout",
    });
    expect(selectedFlowGroup?.eventIds).toHaveLength(5);
  });

  it("builds selected field facets without scoped event arrays", async () => {
    const session = await parseLogLineStream(generateMixedLargeJsonLines(3000), {
      reportInterval: 1000,
    });
    const matchesBaseEvent = createLogEventMatcher({
      searchTerm: "handled",
      level: "all",
      source: "all",
      service: "api-1",
      traceId: "all",
      requestId: "all",
      fieldFilters: [],
      issuesOnly: false,
    });
    const snapshot = buildFieldFacetSnapshot(session.events, {
      fieldFilters: [
        { key: "tenant", value: "team-1", operator: "include" },
        { key: "route", value: "/checkout", operator: "include" },
      ],
      matchesBaseEvent,
      selectedFieldKey: "route",
    });

    expect(snapshot.fieldKeyCounts).toEqual(expect.arrayContaining([
      { label: "route", count: 750 },
      { label: "tenant", count: 750 },
    ]));
    expect(snapshot.fieldValueCounts).toEqual([{ label: "/login", count: 250 }]);
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
      source: {
        id: "/tmp/checkout.log",
        label: "checkout.log",
        path: "/tmp/checkout.log",
      },
    });
    const authSession = parseLogContent(`
{"timestamp":"2026-03-08T10:15:01.500Z","level":"info","service":"auth-service","traceId":"trace-checkout-4821","spanId":"span-auth-extra","requestId":"req-77","message":"token refreshed","route":"/checkout"}
    `.trim(), {
      source: {
        id: "/tmp/auth.log",
        label: "auth.log",
        path: "/tmp/auth.log",
      },
    });

    const merged = mergeParsedSessions([checkoutSession, authSession]);

    expect(merged.sources.map((source) => source.label)).toEqual(["checkout.log", "auth.log"]);
    expect(merged.events.some((event) => event.sourceLabel === "checkout.log")).toBe(true);
    expect(merged.events.some((event) => event.sourceLabel === "auth.log")).toBe(true);
    expect(merged.events.filter((event) => event.traceId === "trace-checkout-4821")).toHaveLength(7);
    expect(buildTraceSourceCoverage(merged.events, "trace-checkout-4821")).toEqual([
      expect.objectContaining({
        sourceLabel: "checkout.log",
      }),
      expect.objectContaining({
        sourceLabel: "auth.log",
      }),
    ]);
  });

  it("builds a cross-file trace diff with missing span hints", () => {
    const checkoutSession = parseLogContent(SAMPLE_LOG_CONTENT, {
      source: {
        id: "/tmp/checkout.log",
        label: "checkout.log",
        path: "/tmp/checkout.log",
      },
    });
    const authSession = parseLogContent(`
{"timestamp":"2026-03-08T10:15:01.500Z","level":"info","service":"auth-service","traceId":"trace-checkout-4821","spanId":"span-auth-extra","requestId":"req-77","message":"token refreshed","route":"/checkout"}
    `.trim(), {
      source: {
        id: "/tmp/auth.log",
        label: "auth.log",
        path: "/tmp/auth.log",
      },
    });

    const merged = mergeParsedSessions([checkoutSession, authSession]);
    const selectedEvent = merged.events.find((event) => event.spanId === "span-pay") ?? null;
    const diff = buildTraceSourceDiff(merged.events, selectedEvent);

    expect(diff).not.toBeNull();
    expect(diff?.basis).toMatchObject({
      kind: "trace",
      value: "trace-checkout-4821",
    });
    expect(diff?.eventCount).toBe(7);
    expect(diff?.sourceCount).toBe(2);
    expect(diff?.spanIds).toEqual(expect.arrayContaining(["span-root", "span-auth-extra"]));

    const checkoutRow = diff?.rows.find((row) => row.sourceLabel === "checkout.log");
    const authRow = diff?.rows.find((row) => row.sourceLabel === "auth.log");

    expect(checkoutRow).toMatchObject({
      eventCount: 6,
      issueCount: 1,
      selected: true,
    });
    expect(checkoutRow?.missingSpanIds).toContain("span-auth-extra");
    expect(authRow).toMatchObject({
      eventCount: 1,
      issueCount: 0,
      selected: false,
    });
    expect(authRow?.missingServices).toEqual(expect.arrayContaining(["payments-api", "checkout-service"]));
    expect(authRow?.missingSpanIds).toContain("span-root");
  });

  it("uses request id before derived flow for trace diff fallback", () => {
    const apiSession = parseLogContent(`
{"timestamp":"2026-03-08T12:00:00.000Z","level":"info","service":"api-gateway","requestId":"req-no-trace","message":"transcribe created","method":"POST","path":"/v1/transcribe","transcription_id":"tr-9812"}
    `.trim(), {
      source: {
        id: "/tmp/api.log",
        label: "api.log",
        path: "/tmp/api.log",
      },
    });
    const workerSession = parseLogContent(`
{"timestamp":"2026-03-08T12:00:02.000Z","level":"error","service":"worker","requestId":"req-no-trace","message":"job failed","method":"PATCH","path":"/v1/transcribe/tr-9812","status":"failed"}
    `.trim(), {
      source: {
        id: "/tmp/worker.log",
        label: "worker.log",
        path: "/tmp/worker.log",
      },
    });

    const merged = mergeParsedSessions([apiSession, workerSession]);
    const selectedEvent = merged.events.find((event) => event.sourceLabel === "api.log") ?? null;
    const flows = buildDerivedFlowGroups(merged.events);
    const diff = buildTraceSourceDiff(
      merged.events,
      selectedEvent,
      getDerivedFlowGroupForEvent(flows, selectedEvent),
    );

    expect(diff?.basis).toMatchObject({
      kind: "request",
      value: "req-no-trace",
    });
    expect(diff?.rows).toHaveLength(2);
    expect(diff?.issueCount).toBe(1);
    expect(diff?.rows.find((row) => row.sourceLabel === "api.log")?.missingServices).toEqual(["worker"]);
    expect(diff?.rows.find((row) => row.sourceLabel === "worker.log")?.missingRoutes).toEqual(["/v1/transcribe"]);
  });

  it("falls back to derived flow diff when trace and request ids are absent", () => {
    const apiSession = parseLogContent(`
{"timestamp":"2026-03-08T12:00:00.000Z","level":"info","service":"api-gateway","message":"transcribe created","method":"POST","path":"/v1/transcribe","transcription_id":"tr-9911"}
    `.trim(), {
      source: {
        id: "/tmp/api.log",
        label: "api.log",
        path: "/tmp/api.log",
      },
    });
    const workerSession = parseLogContent(`
{"timestamp":"2026-03-08T12:00:02.000Z","level":"info","service":"worker","message":"job completed","method":"PATCH","path":"/v1/transcribe/tr-9911","status":"completed"}
    `.trim(), {
      source: {
        id: "/tmp/worker.log",
        label: "worker.log",
        path: "/tmp/worker.log",
      },
    });

    const merged = mergeParsedSessions([apiSession, workerSession]);
    const flows = buildDerivedFlowGroups(merged.events);
    const selectedEvent = merged.events.find((event) => event.sourceLabel === "api.log") ?? null;
    const diff = buildTraceSourceDiff(
      merged.events,
      selectedEvent,
      getDerivedFlowGroupForEvent(flows, selectedEvent),
    );

    expect(diff?.basis.kind).toBe("derivedFlow");
    expect(diff?.basis.value).toBe("/v1/transcribe resource:tr-9911");
    expect(diff?.methods).toEqual(["PATCH", "POST"]);
    expect(diff?.rows.map((row) => row.sourceLabel)).toEqual(["api.log", "worker.log"]);
    expect(diff?.rows[0]?.selected).toBe(true);
    expect(diff?.rows[0]?.missingMethods).toEqual(["PATCH"]);
    expect(diff?.rows[1]?.missingMethods).toEqual(["POST"]);
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

  it("extracts common HTTP correlation headers from nested JSON and key-value logs", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:35:00.000Z","level":"info","message":"nested header correlation","headers":{"X-Request-ID":"req-header-1","X-B3-TraceId":"trace-header-1","X-B3-SpanId":"span-header-1","X-B3-ParentSpanId":"span-parent-1"}}
timestamp=2026-03-08T12:35:01.000Z level=info msg="key value header correlation" x-request-id=req-header-2 x-b3-traceid=trace-header-2 x-b3-spanid=span-header-2 x-b3-parentspanid=span-parent-2
    `.trim());

    expect(session.events[0]).toMatchObject({
      message: "nested header correlation",
      parentSpanId: "span-parent-1",
      requestId: "req-header-1",
      spanId: "span-header-1",
      traceId: "trace-header-1",
    });
    expect(session.events[1]).toMatchObject({
      message: "key value header correlation",
      parentSpanId: "span-parent-2",
      requestId: "req-header-2",
      spanId: "span-header-2",
      traceId: "trace-header-2",
    });
  });

  it("extracts AWS X-Ray trace headers from nested JSON and key-value logs", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:36:00.000Z","level":"info","message":"nested xray correlation","headers":{"X-Amzn-Trace-Id":"Root=1-65f84c7a-12d6f0f0f2f0f2f0f2f0f2f0;Parent=53995c3f42cd8ad8;Sampled=1"}}
timestamp=2026-03-08T12:36:01.000Z level=info msg="key value xray correlation" x-amzn-trace-id=Root=1-65f84c7b-aaaaaaaaaaaaaaaaaaaaaaaa;Parent=4d2c3b2a19080706;Sampled=0
{"timestamp":"2026-03-08T12:36:02.000Z","level":"info","message":"explicit trace wins","traceId":"trace-explicit","spanId":"span-explicit","headers":{"X-Amzn-Trace-Id":"Root=1-65f84c7c-bbbbbbbbbbbbbbbbbbbbbbbb;Parent=1111111111111111;Sampled=1"}}
    `.trim());

    expect(session.events[0]).toMatchObject({
      message: "nested xray correlation",
      spanId: "53995c3f42cd8ad8",
      traceId: "1-65f84c7a-12d6f0f0f2f0f2f0f2f0f2f0",
    });
    expect(session.events[1]).toMatchObject({
      message: "key value xray correlation",
      spanId: "4d2c3b2a19080706",
      traceId: "1-65f84c7b-aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(session.events[2]).toMatchObject({
      message: "explicit trace wins",
      spanId: "span-explicit",
      traceId: "trace-explicit",
    });
    expect(session.events.every((event) => (
      !event.parseIssues.some((issue) => issue.kind === "correlation_field_missing")
    ))).toBe(true);
  });

  it("extracts OpenTelemetry-style log fields from nested JSON", () => {
    const session = parseLogContent(`
{"timeUnixNano":"1741437296000123456","severityText":"ERROR","body":{"stringValue":"checkout failed"},"resource":{"attributes":{"service.name":"checkout-api"}},"attributes":{"http.request_id":"req-otel-1"},"trace_id":"trace-otel-1","span_id":"span-otel-1"}
{"observedTimeUnixNano":1741437297000000000,"severityNumber":13,"body":"rate limited","resource":{"attributes":{"service_name":"edge-gateway"}},"attributes":{"requestId":"req-otel-2"},"trace_id":"trace-otel-2","span_id":"span-otel-2"}
    `.trim());

    expect(session.events[0]).toMatchObject({
      level: "error",
      message: "checkout failed",
      requestId: "req-otel-1",
      service: "checkout-api",
      spanId: "span-otel-1",
      timestampMs: 1741437296000,
      traceId: "trace-otel-1",
    });
    expect(session.events[1]).toMatchObject({
      level: "warn",
      message: "rate limited",
      requestId: "req-otel-2",
      service: "edge-gateway",
      spanId: "span-otel-2",
      timestampMs: 1741437297000,
      traceId: "trace-otel-2",
    });
    expect(session.events.every((event) => (
      !event.parseIssues.some((issue) => (
        issue.kind === "timestamp_missing"
        || issue.kind === "timestamp_parse_failed"
        || issue.kind === "correlation_field_missing"
      ))
    ))).toBe(true);
  });

  it("parses zap-style short json keys used by pronaia logs", () => {
    const session = parseLogContent(`
run batch service....
{"L":"INFO","T":"2026-03-04T22:46:55.704+0900","N":"PRONAIA.BATCH","C":"monitoring/server.go:60","M":"Starting metric server on :9085"}
{"L":"INFO","T":"2026-03-05T10:25:02.461+0900","N":"PRONAIA.BATCH.ACCESS","C":"middleware/logger.go:57","M":"/v1/authenticate","rid":"lL8vrjjr1W-000001","status":200,"method":"POST","path":"/v1/authenticate","latency_ms":9}
    `.trim());

    expect(session.events).toHaveLength(3);
    expect(session.events[1]).toMatchObject({
      level: "info",
      message: "Starting metric server on :9085",
      service: "PRONAIA.BATCH",
      timestampText: "2026-03-04T22:46:55.704+0900",
    });
    expect(session.events[2]).toMatchObject({
      level: "info",
      message: "/v1/authenticate",
      requestId: "lL8vrjjr1W-000001",
      service: "PRONAIA.BATCH.ACCESS",
      timestampText: "2026-03-05T10:25:02.461+0900",
    });
    expect(session.events[2]?.fields.method).toBe("POST");
    expect(session.events[2]?.fields.path).toBe("/v1/authenticate");
    expect(session.events[2]?.parseIssues).toEqual([]);
  });

  it("keeps zap-style short field mapping behind a preset boundary", () => {
    const session = parseLogContent(`
{"L":"INFO","T":"2026-03-04T22:46:55.704+0900","N":"PRONAIA.BATCH","M":"Starting metric server on :9085"}
    `.trim(), {
      aliasPresetId: "default",
    });

    expect(session.events[0]).toMatchObject({
      service: null,
      requestId: null,
    });
    expect(session.events[0]?.message).toContain("\"N\":\"PRONAIA.BATCH\"");
  });

  it("supports session-specific alias overrides", () => {
    const session = parseLogContent(`
{"when":"2026-03-08T12:34:56.000Z","severityText":"ERROR","svcName":"gateway","detail":"custom alias log","flow":"trace-custom-1","unit":"span-custom-1","requestKey":"req-custom-1"}
    `.trim(), {
      aliasOverrides: {
        level: ["severityText"],
        message: ["detail"],
        requestId: ["requestKey"],
        service: ["svcName"],
        spanId: ["unit"],
        timestamp: ["when"],
        traceId: ["flow"],
      },
      aliasPresetId: "default",
    });

    expect(session.events[0]).toMatchObject({
      level: "error",
      message: "custom alias log",
      requestId: "req-custom-1",
      service: "gateway",
      spanId: "span-custom-1",
      timestampText: "2026-03-08T12:34:56.000Z",
      traceId: "trace-custom-1",
    });
    expect(session.events[0]?.parseIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "alias_override_applied",
        metadata: expect.objectContaining({
          alias: "when",
          canonicalField: "timestamp",
        }),
        severity: "info",
      }),
    ]));
  });

  it("separates missing and unparseable timestamp diagnostics", () => {
    const session = parseLogContent(`
{"level":"info","service":"api","message":"missing timestamp","traceId":"trace-ts-1"}
{"timestamp":"not-a-date","level":"info","service":"api","message":"bad timestamp","traceId":"trace-ts-1"}
    `.trim());

    expect(session.events[0]?.parseIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "timestamp_missing",
        severity: "warning",
      }),
    ]));
    expect(session.events[1]?.parseIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "timestamp_parse_failed",
        metadata: expect.objectContaining({
          key: "timestamp",
          value: "not-a-date",
        }),
        severity: "warning",
      }),
    ]));
    expect(session.events[1]?.parseIssues.some((issue) => issue.kind === "timestamp_missing")).toBe(false);
  });

  it("accepts documented timestamp formats without diagnostics", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:34:56.000Z","level":"info","service":"api","message":"iso zulu","traceId":"trace-time-1"}
{"timestamp":"2026-03-08T12:34:56+09:00","level":"info","service":"api","message":"iso offset","traceId":"trace-time-1"}
{"timestamp":"2026/03/08 12:34:56","level":"info","service":"api","message":"slash local","traceId":"trace-time-1"}
timestamp=1741437296 level=info service=api trace_id=trace-time-1 message="epoch seconds"
timestamp=1741437296000 level=info service=api trace_id=trace-time-1 message="epoch millis"
timestamp=1741437296000123 level=info service=api trace_id=trace-time-1 message="epoch micros"
2026-03-08 12:34:56 INFO api trace_id=trace-time-1 message="plain prefix"
    `.trim());

    expect(session.events).toHaveLength(7);
    expect(session.events.map((event) => event.timestampMs)).toEqual([
      Date.UTC(2026, 2, 8, 12, 34, 56),
      Date.UTC(2026, 2, 8, 3, 34, 56),
      expect.any(Number),
      1741437296000,
      1741437296000,
      1741437296000,
      expect.any(Number),
    ]);
    expect(session.events.every((event) => event.timestampMs !== null)).toBe(true);
    expect(session.events.every((event) => (
      !event.parseIssues.some((issue) => (
        issue.kind === "timestamp_missing"
        || issue.kind === "timestamp_parse_failed"
      ))
    ))).toBe(true);
  });

  it("keeps json fallback diagnostics on the recovered plain event", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:34:56.000Z","level":"info","message":"broken json"
    `.trim());

    expect(session.events).toHaveLength(1);
    expect(session.events[0]?.format).toBe("plain");
    expect(session.events[0]?.parseIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "json_parse_failed",
        severity: "warning",
      }),
      expect.objectContaining({
        kind: "structured_parse_fallback",
        severity: "info",
      }),
    ]));
    expect(session.diagnostics.map((diagnostic) => diagnostic.kind)).toEqual(expect.arrayContaining([
      "json_parse_failed",
      "structured_parse_fallback",
    ]));
  });

  it("gives session alias overrides priority over the selected preset", () => {
    const session = parseLogContent(`
{"L":"INFO","severityText":"ERROR","T":"2026-03-08T12:34:56.000Z","N":"preset-service","svcName":"override-service","M":"preset message","detail":"override message"}
    `.trim(), {
      aliasOverrides: {
        level: ["severityText"],
        message: ["detail"],
        service: ["svcName"],
      },
      aliasPresetId: "zap-short-json",
    });

    expect(session.events[0]).toMatchObject({
      level: "error",
      message: "override message",
      service: "override-service",
      timestampText: "2026-03-08T12:34:56.000Z",
    });
  });

  it("parses numeric epoch timestamps and preserves object arrays as indexed fields", () => {
    const session = parseLogContent(`
{"timestamp":"1741437296000123","level":"info","service":"batch-worker","message":"batch accepted","jobs":[{"id":"job-1","status":"queued"},{"id":"job-2","status":"done"}]}
    `.trim());

    expect(session.events[0]).toMatchObject({
      level: "info",
      service: "batch-worker",
      timestampMs: 1741437296000,
      timestampText: "1741437296000123",
    });
    expect(session.events[0]?.fields["jobs.0.id"]).toBe("job-1");
    expect(session.events[0]?.fields["jobs.1.status"]).toBe("done");
  });

  it("builds derived flows for restful create and follow-up events without explicit trace ids", () => {
    const session = parseLogContent(`
{"timestamp":"2026-03-08T12:00:00.000Z","level":"info","service":"api-gateway","message":"transcribe created","method":"POST","path":"/v1/transcribe","transcription_id":"tr-9812"}
{"timestamp":"2026-03-08T12:00:02.000Z","level":"info","service":"worker","message":"job picked up","method":"GET","path":"/v1/transcribe/tr-9812","status":"running"}
{"timestamp":"2026-03-08T12:00:04.000Z","level":"info","service":"worker","message":"job completed","method":"PATCH","path":"/v1/transcribe/tr-9812","status":"completed"}
    `.trim());

    const flows = buildDerivedFlowGroups(session.events);

    expect(flows).toHaveLength(1);
    expect(flows[0]).toMatchObject({
      correlationKind: "resource",
      correlationValue: "tr-9812",
      eventCount: 3,
      family: "/v1/transcribe",
      methods: ["POST", "GET", "PATCH"],
      resourceId: "tr-9812",
      routes: ["/v1/transcribe", "/v1/transcribe/:id"],
    });
    expect(getDerivedFlowGroupForEvent(flows, session.events[1] ?? null)?.flowKey).toBe(flows[0]?.flowKey);
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
    expect(session.events[0]?.parseIssues.some((issue) => issue.kind === "multiline_merged")).toBe(true);
  });

  it("scopes nearby related events to the same source in merged sessions", () => {
    const firstSession = parseLogContent(`
2026-03-08 10:00:00 INFO api request_id=req-a message="first source line 1"
2026-03-08 10:00:01 INFO api request_id=req-a message="first source line 2"
2026-03-08 10:00:02 INFO api request_id=req-a message="first source line 3"
    `.trim(), {
      source: {
        id: "/tmp/first.log",
        label: "first.log",
        path: "/tmp/first.log",
      },
    });
    const secondSession = parseLogContent(`
2026-03-08 10:00:00 INFO worker request_id=req-b message="second source line 1"
2026-03-08 10:00:01 INFO worker request_id=req-b message="second source line 2"
2026-03-08 10:00:02 INFO worker request_id=req-b message="second source line 3"
    `.trim(), {
      source: {
        id: "/tmp/second.log",
        label: "second.log",
        path: "/tmp/second.log",
      },
    });

    const merged = mergeParsedSessions([firstSession, secondSession]);
    const related = getRelatedEvents(merged.events, firstSession.events[1] ?? null, 10);

    expect(related).toHaveLength(3);
    expect(related.every((event) => event.sourceId === "/tmp/first.log")).toBe(true);
  });

  it("returns isolated alias arrays for each build", () => {
    const firstAliases = buildLogFieldAliases();
    firstAliases.traceId.push("custom-trace-key");

    const secondAliases = buildLogFieldAliases();

    expect(secondAliases.traceId).not.toContain("custom-trace-key");
  });
});
