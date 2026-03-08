import type {
  LogEvent,
  LogFilters,
  LogLevel,
  SpanForest,
  SpanNode,
  TraceGroup,
} from "@/lib/logs/types";

type ChartPoint = {
  hour: string;
  count: number;
};

type FacetCount = {
  label: string;
  count: number;
};

type MutableSpanNode = Omit<SpanNode, "children" | "depth" | "requestIds"> & {
  childIds: string[];
  requestIds: Set<string>;
};

const LEVEL_ORDER: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "unknown"];

function levelRank(level: LogLevel) {
  const index = LEVEL_ORDER.indexOf(level);
  return index === -1 ? LEVEL_ORDER.length : index;
}

export function compareEvents(left: LogEvent, right: LogEvent) {
  const leftTime = left.timestampMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.timestampMs ?? Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.lineNumber - right.lineNumber;
}

export function isIssueLevel(level: LogLevel) {
  return level === "error" || level === "fatal";
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

    if (filters.requestId !== "all" && (event.requestId ?? "none") !== filters.requestId) {
      return false;
    }

    if (filters.fieldKey !== "all" && !(filters.fieldKey in event.fields)) {
      return false;
    }

    if (
      filters.fieldKey !== "all"
      && filters.fieldValue !== "all"
      && event.fields[filters.fieldKey] !== filters.fieldValue
    ) {
      return false;
    }

    if (filters.issuesOnly && !isIssueLevel(event.level)) {
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
      ...Object.keys(event.fields),
      ...Object.values(event.fields),
    ];

    return haystacks.some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
}

export function buildFieldKeyCounts(events: LogEvent[]) {
  const counter = new Map<string, number>();

  for (const event of events) {
    for (const key of Object.keys(event.fields)) {
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }
  }

  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildFieldValueCounts(events: LogEvent[], fieldKey: string | "all") {
  if (fieldKey === "all") {
    return [];
  }

  return buildFacetCounts(
    events
      .map((event) => event.fields[fieldKey] ?? null)
      .filter((value): value is string => value !== null),
    "none",
  );
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
  const counts = buildFacetCounts(events.map((event) => event.level), "unknown");

  return counts.sort((left, right) => {
    const leftIndex = LEVEL_ORDER.indexOf(left.label as LogLevel);
    const rightIndex = LEVEL_ORDER.indexOf(right.label as LogLevel);
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
    const requestIds = [...new Set(sorted.map((event) => event.requestId).filter(Boolean))] as string[];
    const uniqueSpans = new Set(sorted.map((event) => event.spanId).filter(Boolean));
    const timedEvents = sorted.filter((event) => event.timestampMs !== null);
    const issueCount = sorted.filter((event) => isIssueLevel(event.level)).length;

    return {
      traceId,
      eventIds: sorted.map((event) => event.id),
      services,
      levels,
      requestIds,
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

function createMutableSpanNode(spanId: string): MutableSpanNode {
  return {
    spanId,
    parentSpanId: null,
    service: null,
    requestIds: new Set<string>(),
    label: "Unnamed span",
    eventIds: [],
    eventCount: 0,
    issueCount: 0,
    level: "unknown",
    startMs: null,
    endMs: null,
    childIds: [],
  };
}

function updateSpanWindow(node: MutableSpanNode, timestampMs: number | null) {
  if (timestampMs === null) {
    return;
  }

  node.startMs = node.startMs === null ? timestampMs : Math.min(node.startMs, timestampMs);
  node.endMs = node.endMs === null ? timestampMs : Math.max(node.endMs, timestampMs);
}

function materializeSpanNode(
  spanId: string,
  nodes: Map<string, MutableSpanNode>,
  depth: number,
  visited: Set<string>,
): SpanNode {
  const node = nodes.get(spanId);

  if (!node || visited.has(spanId)) {
    return {
      spanId,
      parentSpanId: null,
      depth,
      service: null,
      requestIds: [],
      label: "Broken span",
      eventIds: [],
      eventCount: 0,
      issueCount: 0,
      level: "unknown",
      startMs: null,
      endMs: null,
      children: [],
    };
  }

  visited.add(spanId);
  const children = [...node.childIds]
    .map((childId) => materializeSpanNode(childId, nodes, depth + 1, visited))
    .sort((left, right) => {
      if (left.startMs !== null && right.startMs !== null && left.startMs !== right.startMs) {
        return left.startMs - right.startMs;
      }

      return left.spanId.localeCompare(right.spanId);
    });

  return {
    spanId: node.spanId,
    parentSpanId: node.parentSpanId,
    depth,
    service: node.service,
    requestIds: [...node.requestIds],
    label: node.label,
    eventIds: node.eventIds,
    eventCount: node.eventCount,
    issueCount: node.issueCount,
    level: node.level,
    startMs: node.startMs,
    endMs: node.endMs,
    children,
  };
}

function computeMaxDepth(nodes: SpanNode[], fallback = 0): number {
  let maxDepth = fallback;

  for (const node of nodes) {
    maxDepth = Math.max(maxDepth, node.depth, computeMaxDepth(node.children, maxDepth));
  }

  return maxDepth;
}

export function buildSpanForest(events: LogEvent[], traceId: string | null): SpanForest | null {
  if (!traceId) {
    return null;
  }

  const traceEvents = events
    .filter((event) => event.traceId === traceId)
    .sort(compareEvents);

  if (traceEvents.length === 0) {
    return null;
  }

  const spanNodes = new Map<string, MutableSpanNode>();
  const orphanEvents: LogEvent[] = [];

  for (const event of traceEvents) {
    if (!event.spanId) {
      orphanEvents.push(event);
      continue;
    }

    const span = spanNodes.get(event.spanId) ?? createMutableSpanNode(event.spanId);
    span.parentSpanId = span.parentSpanId ?? event.parentSpanId ?? null;
    span.service = span.service ?? event.service;
    span.eventIds.push(event.id);
    span.eventCount += 1;
    span.issueCount += isIssueLevel(event.level) ? 1 : 0;
    span.level = levelRank(event.level) < levelRank(span.level) ? event.level : span.level;
    span.label = span.label === "Unnamed span" ? event.message.replace(/\s*\(\+\d+ lines\)$/, "") : span.label;
    updateSpanWindow(span, event.timestampMs);

    if (event.requestId) {
      span.requestIds.add(event.requestId);
    }

    spanNodes.set(event.spanId, span);
  }

  for (const [spanId, node] of spanNodes.entries()) {
    if (!node.parentSpanId || node.parentSpanId === spanId) {
      continue;
    }

    const parent = spanNodes.get(node.parentSpanId);

    if (!parent) {
      continue;
    }

    if (!parent.childIds.includes(spanId)) {
      parent.childIds.push(spanId);
    }
  }

  const rootIds = [...spanNodes.values()]
    .filter((node) => !node.parentSpanId || node.parentSpanId === node.spanId || !spanNodes.has(node.parentSpanId))
    .map((node) => node.spanId)
    .sort((left, right) => {
      const leftNode = spanNodes.get(left);
      const rightNode = spanNodes.get(right);
      const leftStart = leftNode?.startMs ?? Number.MAX_SAFE_INTEGER;
      const rightStart = rightNode?.startMs ?? Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart || left.localeCompare(right);
    });

  const roots = rootIds.map((spanId) => materializeSpanNode(spanId, spanNodes, 0, new Set<string>()));

  return {
    roots,
    orphanEvents,
    totalSpans: spanNodes.size,
    maxDepth: computeMaxDepth(roots),
  };
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
