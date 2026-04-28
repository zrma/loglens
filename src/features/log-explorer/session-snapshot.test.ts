import { describe, expect, it } from "vitest";
import { buildLogSessionSnapshot, compareSessionSnapshotCompatibility, parseLogSessionSnapshotText, stringifyLogSessionSnapshot } from "@/features/log-explorer/session-snapshot";
import { parseLogContent } from "@/lib/logs/parser";

const SESSION_TEXT = [
  JSON.stringify({
    timestamp: "2026-03-08T10:15:01.000Z",
    level: "info",
    service: "checkout-api",
    traceId: "trace-1",
    requestId: "req-1",
    message: "checkout started",
    route: "/checkout",
  }),
  JSON.stringify({
    timestamp: "2026-03-08T10:15:02.000Z",
    level: "error",
    service: "payment-worker",
    traceId: "trace-1",
    requestId: "req-1",
    message: "payment failed",
    route: "/checkout",
  }),
].join("\n");

describe("session snapshot helpers", () => {
  it("round-trips parser, filter, view, and source signature state", () => {
    const session = parseLogContent(SESSION_TEXT, {
      aliasOverrides: {
        requestId: ["rid", "rid"],
      },
      aliasPresetId: "auto",
      source: {
        id: "source-1",
        label: "checkout.log",
        path: "/private/path/checkout.log",
      },
    });
    const selectedEventId = session.events[1]?.id ?? null;

    const snapshot = buildLogSessionSnapshot({
      activeTab: "analysis",
      aliasOverrides: {
        requestId: ["rid", "rid"],
      },
      analysisDrillDownFilters: [{ kind: "level", value: "error" }],
      eventStreamBuiltinColumns: ["time", "source", "message"],
      facetFieldKey: "route",
      fieldFilters: [{ key: "route", operator: "include", value: "/checkout" }],
      hiddenFieldKeys: ["traceId", "traceId"],
      issuesOnly: true,
      levelFilter: "error",
      parserPresetId: "auto",
      pinnedEventFieldColumns: ["route", "route"],
      requestFilter: "req-1",
      searchTerm: "payment",
      selectedEventId,
      serviceFilter: "payment-worker",
      session,
      sourceFilter: "source-1",
      traceFilter: "trace-1",
    });

    const parsed = parseLogSessionSnapshotText(stringifyLogSessionSnapshot(snapshot));

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(parsed.snapshot.parserPresetId).toBe("auto");
    expect(parsed.snapshot.aliasOverrides).toEqual({ requestId: ["rid"] });
    expect(parsed.snapshot.filters).toMatchObject({
      facetFieldKey: "route",
      issuesOnly: true,
      levelFilter: "error",
      requestFilter: "req-1",
      searchTerm: "payment",
      serviceFilter: "payment-worker",
      sourceFilter: "source-1",
      traceFilter: "trace-1",
    });
    expect(parsed.snapshot.filters.fieldFilters).toEqual([{ key: "route", operator: "include", value: "/checkout" }]);
    expect(parsed.snapshot.filters.analysisDrillDownFilters).toEqual([{ kind: "level", value: "error" }]);
    expect(parsed.snapshot.view).toMatchObject({
      activeTab: "analysis",
      hiddenFieldKeys: ["traceId"],
      pinnedEventFieldColumns: ["route"],
      selectedEventId,
    });
    expect(parsed.snapshot.view.eventStreamBuiltinColumns).toEqual(["time", "source", "message"]);
    expect(parsed.snapshot.sourceSignature).toMatchObject({
      eventCount: 2,
      sourceCount: 1,
      sources: [{ diagnosticCount: 0, eventCount: 2, label: "checkout.log" }],
    });
    expect(parsed.snapshot.sourceSignature.sources[0]).not.toHaveProperty("path");
  });

  it("rejects invalid versions and unsafe shapes before state is applied", () => {
    expect(parseLogSessionSnapshotText("{")).toEqual({
      ok: false,
      error: "snapshot JSON을 파싱할 수 없습니다.",
    });

    expect(parseLogSessionSnapshotText(JSON.stringify({
      schema: "loglens.sessionSnapshot",
      version: 999,
    }))).toEqual({
      ok: false,
      error: "지원하지 않는 snapshot version입니다.",
    });

    expect(parseLogSessionSnapshotText(JSON.stringify({
      aliasOverrides: { requestId: ["rid"] },
      createdAt: new Date().toISOString(),
      filters: {},
      parserPresetId: "missing-preset",
      schema: "loglens.sessionSnapshot",
      sourceSignature: {},
      version: 1,
      view: {},
    }))).toEqual({
      ok: false,
      error: "snapshot parser preset이 올바르지 않습니다.",
    });
  });

  it("reports source signature mismatch as a warning", () => {
    const session = parseLogContent(SESSION_TEXT, {
      source: {
        id: "source-1",
        label: "checkout.log",
        path: null,
      },
    });
    const otherSession = parseLogContent(`${SESSION_TEXT}\n${SESSION_TEXT}`, {
      source: {
        id: "source-1",
        label: "checkout.log",
        path: null,
      },
    });
    const snapshot = buildLogSessionSnapshot({
      activeTab: "events",
      aliasOverrides: {},
      analysisDrillDownFilters: [],
      eventStreamBuiltinColumns: ["time", "level", "service", "message"],
      facetFieldKey: "all",
      fieldFilters: [],
      hiddenFieldKeys: [],
      issuesOnly: false,
      levelFilter: "all",
      parserPresetId: "auto",
      pinnedEventFieldColumns: [],
      requestFilter: "all",
      searchTerm: "",
      selectedEventId: null,
      serviceFilter: "all",
      session,
      sourceFilter: "all",
      traceFilter: "all",
    });

    expect(compareSessionSnapshotCompatibility(session, snapshot)).toEqual({
      level: "match",
      messages: [],
    });
    expect(compareSessionSnapshotCompatibility(otherSession, snapshot)).toEqual({
      level: "warning",
      messages: ["이벤트 수가 다릅니다. 현재 4개, snapshot 2개입니다."],
    });
  });
});
