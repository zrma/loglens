import { describe, expect, it } from "vitest";
import {
  buildFieldFacetSnapshot,
  buildHourlyChartData,
  buildLevelCounts,
  buildTopDerivedFlowGroupPreviews,
  buildTopTraceGroupPreviews,
  createLogEventMatcher,
  filterLogEvents,
} from "@/lib/logs/analysis";
import { parseLogLineStream } from "@/lib/logs/parser";

const LARGE_SESSION_BENCH_LINE_COUNT = 200_000;

async function* generateLargeBenchmarkJsonLines(count: number) {
  const startMs = Date.UTC(2026, 2, 8, 12, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const route = index % 3 === 0 ? "/checkout" : index % 3 === 1 ? "/login" : "/account";
    const service = `api-${index % 8}`;
    const level = index % 100 === 0 ? "error" : "info";

    yield JSON.stringify({
      timestamp: new Date(startMs + (index * 250)).toISOString(),
      level,
      service,
      traceId: `trace-bench-${Math.floor(index / 20)}`,
      spanId: `span-bench-${index}`,
      requestId: `req-bench-${Math.floor(index / 20)}`,
      message: `${service} handled ${route} item ${index}`,
      route,
      tenant: `team-${index % 10}`,
    });
  }
}

const describeLargeSessionBench = process.env.LOG_LENS_LARGE_BENCH === "1"
  ? describe
  : describe.skip;

describeLargeSessionBench("large session benchmark candidate", () => {
  it("keeps the 200k-line parser and derived summary path executable", async () => {
    const session = await parseLogLineStream(
      generateLargeBenchmarkJsonLines(LARGE_SESSION_BENCH_LINE_COUNT),
      { reportInterval: 50_000 },
    );
    const filteredEvents = filterLogEvents(session.events, {
      searchTerm: "handled",
      level: "all",
      source: "all",
      service: "api-1",
      traceId: "all",
      requestId: "all",
      fieldFilters: [],
      issuesOnly: false,
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
    const fieldFacetSnapshot = buildFieldFacetSnapshot(session.events, {
      fieldFilters: [{ key: "tenant", value: "team-1", operator: "include" }],
      matchesBaseEvent,
      selectedFieldKey: "route",
    });

    expect(session.events).toHaveLength(LARGE_SESSION_BENCH_LINE_COUNT);
    expect(session.diagnostics).toHaveLength(0);
    expect(filteredEvents).toHaveLength(25_000);
    expect(buildLevelCounts(session.events)).toEqual(expect.arrayContaining([
      { label: "error", count: 2000 },
      { label: "info", count: 198_000 },
    ]));
    expect(buildHourlyChartData(session.events).parsedCount).toBe(LARGE_SESSION_BENCH_LINE_COUNT);
    expect(buildTopTraceGroupPreviews(session.events, 8)).toHaveLength(8);
    expect(buildTopDerivedFlowGroupPreviews(session.events, 8)).toHaveLength(8);
    expect(fieldFacetSnapshot.fieldKeyCounts).toEqual(expect.arrayContaining([
      { label: "route", count: 25_000 },
      { label: "tenant", count: 25_000 },
    ]));
    expect(fieldFacetSnapshot.fieldValueCounts.reduce((total, item) => total + item.count, 0)).toBe(5000);
  }, 120_000);
});
