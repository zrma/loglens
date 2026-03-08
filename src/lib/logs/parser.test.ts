import { describe, expect, it } from "vitest";
import { buildTraceGroups, filterLogEvents } from "@/lib/logs/analysis";
import { parseLogContent } from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT } from "@/lib/logs/sample";

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
    });

    expect(filtered).toHaveLength(4);
    expect(filtered.every((event) => event.traceId === "trace-auth-9912")).toBe(true);
  });
});
