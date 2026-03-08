import type { LogEvent, LogFilters, LogLevel, TraceGroup } from "@/lib/logs/types";

type ChartPoint = {
  hour: string;
  count: number;
};

type FacetCount = {
  label: string;
  count: number;
};

function compareEvents(left: LogEvent, right: LogEvent) {
  const leftTime = left.timestampMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.timestampMs ?? Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.lineNumber - right.lineNumber;
}

export function filterLogEvents(events: LogEvent[], filters: LogFilters) {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.level !== "all" && event.level !== filters.level) {
      return false;
    }

    if (filters.service !== "all" && (event.service ?? "미지정") !== filters.service) {
      return false;
    }

    if (filters.traceId !== "all" && (event.traceId ?? "untracked") !== filters.traceId) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystacks = [
      event.message,
      event.rawLine,
      event.service,
      event.traceId,
      event.spanId,
      event.parentSpanId,
      event.requestId,
    ];

    return haystacks.some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
}

export function buildHourlyChartData(events: LogEvent[]) {
  const points = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}시`,
    count: 0,
  }));

  let parsedCount = 0;

  for (const event of events) {
    if (event.timestampMs === null) {
      continue;
    }

    const timestamp = new Date(event.timestampMs);
    points[timestamp.getHours()].count += 1;
    parsedCount += 1;
  }

  return {
    data: points satisfies ChartPoint[],
    parsedCount,
  };
}

export function buildFacetCounts(values: Array<string | null | undefined>, emptyLabel: string) {
  const counter = new Map<string, number>();

  for (const value of values) {
    const label = value?.trim() ? value : emptyLabel;
    counter.set(label, (counter.get(label) ?? 0) + 1);
  }

  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildLevelCounts(events: LogEvent[]) {
  const order: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "unknown"];
  const counts = buildFacetCounts(events.map((event) => event.level), "unknown");

  return counts.sort((left, right) => {
    const leftIndex = order.indexOf(left.label as LogLevel);
    const rightIndex = order.indexOf(right.label as LogLevel);
    return leftIndex - rightIndex;
  });
}

export function buildTraceGroups(events: LogEvent[]) {
  const groups = new Map<string, LogEvent[]>();

  for (const event of events) {
    if (!event.traceId) {
      continue;
    }

    const traceEvents = groups.get(event.traceId) ?? [];
    traceEvents.push(event);
    groups.set(event.traceId, traceEvents);
  }

  const traces: TraceGroup[] = [...groups.entries()].map(([traceId, traceEvents]) => {
    const sorted = [...traceEvents].sort(compareEvents);
    const services = [...new Set(sorted.map((event) => event.service).filter(Boolean))] as string[];
    const levels = [...new Set(sorted.map((event) => event.level))];
    const uniqueSpans = new Set(sorted.map((event) => event.spanId).filter(Boolean));
    const timedEvents = sorted.filter((event) => event.timestampMs !== null);
    const issueCount = sorted.filter((event) => event.level === "error" || event.level === "fatal").length;

    return {
      traceId,
      eventIds: sorted.map((event) => event.id),
      services,
      levels,
      eventCount: sorted.length,
      spanCount: uniqueSpans.size,
      issueCount,
      startMs: timedEvents[0]?.timestampMs ?? null,
      endMs: timedEvents[timedEvents.length - 1]?.timestampMs ?? null,
    };
  });

  return traces.sort((left, right) => {
    if (right.issueCount !== left.issueCount) {
      return right.issueCount - left.issueCount;
    }

    if (right.eventCount !== left.eventCount) {
      return right.eventCount - left.eventCount;
    }

    return left.traceId.localeCompare(right.traceId);
  });
}

export function getRelatedEvents(events: LogEvent[], selectedEvent: LogEvent | null, limit = 8) {
  if (!selectedEvent) {
    return [];
  }

  if (selectedEvent.traceId) {
    return events
      .filter((event) => event.traceId === selectedEvent.traceId)
      .sort(compareEvents)
      .slice(0, limit);
  }

  return events.filter((event) =>
    Math.abs(event.lineNumber - selectedEvent.lineNumber) <= 3,
  );
}

export function formatDuration(startMs: number | null, endMs: number | null) {
  if (startMs === null || endMs === null || endMs < startMs) {
    return "n/a";
  }

  const duration = endMs - startMs;

  if (duration < 1000) {
    return `${duration}ms`;
  }

  return `${(duration / 1000).toFixed(2)}s`;
}

export function formatTimestamp(timestampMs: number | null) {
  if (timestampMs === null) {
    return "시간 정보 없음";
  }

  const date = new Date(timestampMs);
  const datePart = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${datePart} ${timePart}`;
}

export type { ChartPoint, FacetCount };
