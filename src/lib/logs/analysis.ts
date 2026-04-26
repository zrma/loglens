import type {
  DerivedFlowCorrelationKind,
  DerivedFlowGroup,
  FieldFilter,
  LogEvent,
  LogFilters,
  LogLevel,
  SpanForest,
  SpanNode,
  TraceDiffBasis,
  TraceSourceDiff,
  TraceSourceDiffRow,
  TraceGroup,
  TraceSourceCoverage,
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
  childIds: Set<string>;
  requestIds: Set<string>;
};

type MutableDerivedFlowGroup = Omit<DerivedFlowGroup, "methods" | "routes" | "services" | "sources"> & {
  methods: Set<string>;
  routes: Set<string>;
  services: Set<string>;
  sources: Set<string>;
};

type MutableTraceGroup = {
  traceId: string;
  events: LogEvent[];
  issueCount: number;
  startMs: number | null;
  endMs: number | null;
};

type MutableTraceSourceCoverage = Omit<TraceSourceCoverage, "services"> & {
  services: Set<string>;
};

type MutableTraceSourceDiffRow = Omit<
  TraceSourceDiffRow,
  "methods" | "missingMethods" | "missingRoutes" | "missingServices" | "missingSpanIds" | "routes" | "services" | "spanIds"
> & {
  methods: Set<string>;
  routes: Set<string>;
  services: Set<string>;
  spanIds: Set<string>;
};

const LEVEL_ORDER: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "unknown"];
const LEVEL_RANK = new Map<LogLevel, number>(LEVEL_ORDER.map((level, index) => [level, index]));
const HTTP_METHOD_PATTERN = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i;
const PATH_PATTERN = /(\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)/;
const ROUTE_FIELD_KEYS = [
  "route",
  "path",
  "url.path",
  "request.path",
  "http.route",
  "http.target",
  "http.path",
  "endpoint",
];
const METHOD_FIELD_KEYS = [
  "method",
  "http.method",
  "request.method",
  "req.method",
  "verb",
];
const RESOURCE_ID_FIELD_CANDIDATE_PATTERNS = [
  /^id$/i,
  /(?:resource|entity|object|item|job|task|transcri(?:be|bing|ption)|document|record|operation)[._-]?id$/i,
  /(?:resource|entity|object|item|job|task|transcri(?:be|bing|ption)|document|record|operation)\.id$/i,
];
const RESOURCE_ID_EXCLUDE_PATTERNS = [
  /trace/i,
  /span/i,
  /request/i,
  /correlation/i,
  /session/i,
  /user/i,
  /parent/i,
];
const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type DerivedFlowHint = {
  family: string | null;
  method: string | null;
  normalizedRoute: string | null;
  rawRoute: string | null;
  resourceId: string | null;
  correlationKind: DerivedFlowCorrelationKind | null;
  correlationValue: string | null;
};

function levelRank(level: LogLevel) {
  const index = LEVEL_RANK.get(level);
  return index === undefined ? LEVEL_ORDER.length : index;
}

function materializeFacetCounts(counter: Map<string, number>) {
  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function sortedSetValues(values: Set<string>) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function getMissingValues(sourceValues: Set<string>, allValues: Set<string>) {
  return sortedSetValues(new Set([...allValues].filter((value) => !sourceValues.has(value))));
}

function matchesNormalizedSearch(value: string | null | undefined, normalizedSearch: string) {
  return value?.toLowerCase().includes(normalizedSearch) ?? false;
}

function eventMatchesSearch(event: LogEvent, normalizedSearch: string) {
  if (
    matchesNormalizedSearch(event.message, normalizedSearch)
    || matchesNormalizedSearch(event.rawLine, normalizedSearch)
    || matchesNormalizedSearch(event.sourceLabel, normalizedSearch)
    || matchesNormalizedSearch(event.sourcePath, normalizedSearch)
    || matchesNormalizedSearch(event.service, normalizedSearch)
    || matchesNormalizedSearch(event.traceId, normalizedSearch)
    || matchesNormalizedSearch(event.spanId, normalizedSearch)
    || matchesNormalizedSearch(event.parentSpanId, normalizedSearch)
    || matchesNormalizedSearch(event.requestId, normalizedSearch)
  ) {
    return true;
  }

  for (const [key, value] of Object.entries(event.fields)) {
    if (key.toLowerCase().includes(normalizedSearch) || value.toLowerCase().includes(normalizedSearch)) {
      return true;
    }
  }

  return false;
}

export function compareEvents(left: LogEvent, right: LogEvent) {
  const leftTime = left.timestampMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.timestampMs ?? Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.sourceLabel !== right.sourceLabel) {
    return left.sourceLabel.localeCompare(right.sourceLabel);
  }

  return left.lineNumber - right.lineNumber;
}

export function isIssueLevel(level: LogLevel) {
  return level === "error" || level === "fatal";
}

function eventMatchesNormalizedLogFilters(event: LogEvent, filters: LogFilters, normalizedSearch: string) {
  if (filters.level !== "all" && event.level !== filters.level) {
    return false;
  }

  if (filters.source !== "all" && event.sourceId !== filters.source) {
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

  if (!matchesFieldFilters(event, filters.fieldFilters)) {
    return false;
  }

  if (filters.issuesOnly && !isIssueLevel(event.level)) {
    return false;
  }

  if (!normalizedSearch) {
    return true;
  }

  return eventMatchesSearch(event, normalizedSearch);
}

export function eventMatchesLogFilters(event: LogEvent, filters: LogFilters) {
  return eventMatchesNormalizedLogFilters(event, filters, filters.searchTerm.trim().toLowerCase());
}

export function filterLogEvents(events: LogEvent[], filters: LogFilters) {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();

  return events.filter((event) => eventMatchesNormalizedLogFilters(event, filters, normalizedSearch));
}

export function matchesFieldFilters(event: LogEvent, filters: FieldFilter[]) {
  return filters.every((filter) => (
    filter.operator === "include"
      ? event.fields[filter.key] === filter.value
      : event.fields[filter.key] !== filter.value
  ));
}

export function buildFieldKeyCounts(events: LogEvent[]) {
  const counter = new Map<string, number>();

  for (const event of events) {
    for (const key in event.fields) {
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }
  }

  return materializeFacetCounts(counter);
}

export function buildFieldValueCounts(events: LogEvent[], fieldKey: string | "all") {
  if (fieldKey === "all") {
    return [];
  }

  const counter = new Map<string, number>();

  for (const event of events) {
    const value = event.fields[fieldKey];

    if (value === undefined) {
      continue;
    }

    const label = value.trim() ? value : "none";
    counter.set(label, (counter.get(label) ?? 0) + 1);
  }

  return materializeFacetCounts(counter);
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

  return materializeFacetCounts(counter);
}

function pickCandidateField(event: LogEvent, candidates: string[]) {
  for (const candidate of candidates) {
    const value = event.fields[candidate];

    if (value) {
      return value;
    }
  }

  return null;
}

function sanitizeRouteValue(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const stripped = trimmed
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "");

  return stripped.startsWith("/") ? stripped : null;
}

function looksLikeResourceSegment(segment: string) {
  return /^\d+$/.test(segment)
    || /^[a-f0-9]{8,}$/i.test(segment)
    || /^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(segment)
    || (/^[A-Za-z]{1,6}-[A-Za-z0-9-]{3,}$/i.test(segment) && /[0-9]/.test(segment))
    || (segment.length >= 8 && /[0-9]/.test(segment) && /[A-Za-z]/.test(segment));
}

function normalizeRoutePath(route: string | null) {
  if (!route) {
    return null;
  }

  const segments = route
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (/^v\d+$/i.test(segment)) {
        return segment.toLowerCase();
      }

      return looksLikeResourceSegment(segment) ? ":id" : segment;
    });

  return segments.length > 0 ? `/${segments.join("/")}` : route;
}

function deriveRouteFamily(normalizedRoute: string | null) {
  if (!normalizedRoute) {
    return null;
  }

  const segments = normalizedRoute.split("/").filter(Boolean);

  if (segments[segments.length - 1] === ":id") {
    const familySegments = segments.slice(0, -1);
    return familySegments.length > 0 ? `/${familySegments.join("/")}` : normalizedRoute;
  }

  return normalizedRoute;
}

function extractRouteAndMethod(event: LogEvent) {
  const fieldRoute = sanitizeRouteValue(pickCandidateField(event, ROUTE_FIELD_KEYS));
  const fieldMethod = pickCandidateField(event, METHOD_FIELD_KEYS)?.toUpperCase() ?? null;
  const messageMethod = event.message.match(HTTP_METHOD_PATTERN)?.[1]?.toUpperCase() ?? null;
  const messagePath = sanitizeRouteValue(event.message.match(PATH_PATTERN)?.[1] ?? null);

  return {
    method: fieldMethod ?? messageMethod,
    route: fieldRoute ?? messagePath,
  };
}

function extractResourceIdFromRoute(route: string | null, normalizedRoute: string | null) {
  if (!route || !normalizedRoute) {
    return null;
  }

  const rawSegments = route.split("/").filter(Boolean);
  const normalizedSegments = normalizedRoute.split("/").filter(Boolean);

  for (let index = normalizedSegments.length - 1; index >= 0; index -= 1) {
    if (normalizedSegments[index] === ":id") {
      return rawSegments[index] ?? null;
    }
  }

  return null;
}

function extractResourceIdFromFields(event: LogEvent) {
  for (const [key, value] of Object.entries(event.fields)) {
    if (!value || RESOURCE_ID_EXCLUDE_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }

    if (RESOURCE_ID_FIELD_CANDIDATE_PATTERNS.some((pattern) => pattern.test(key))) {
      return value;
    }
  }

  return null;
}

function deriveFlowHint(event: LogEvent): DerivedFlowHint {
  const { method, route } = extractRouteAndMethod(event);
  const normalizedRoute = normalizeRoutePath(route);
  const family = deriveRouteFamily(normalizedRoute);
  const resourceId = extractResourceIdFromRoute(route, normalizedRoute) ?? extractResourceIdFromFields(event);

  if (!family) {
    return {
      correlationKind: null,
      correlationValue: null,
      family: null,
      method,
      normalizedRoute,
      rawRoute: route,
      resourceId,
    };
  }

  if (resourceId) {
    return {
      correlationKind: "resource",
      correlationValue: resourceId,
      family,
      method,
      normalizedRoute,
      rawRoute: route,
      resourceId,
    };
  }

  if (event.requestId) {
    return {
      correlationKind: "request",
      correlationValue: event.requestId,
      family,
      method,
      normalizedRoute,
      rawRoute: route,
      resourceId: null,
    };
  }

  if (event.traceId) {
    return {
      correlationKind: "trace",
      correlationValue: event.traceId,
      family,
      method,
      normalizedRoute,
      rawRoute: route,
      resourceId: null,
    };
  }

  return {
    correlationKind: null,
    correlationValue: null,
    family,
    method,
    normalizedRoute,
    rawRoute: route,
    resourceId,
  };
}

export function buildLevelCounts(events: LogEvent[]) {
  const counter = new Map<LogLevel, number>();

  for (const event of events) {
    counter.set(event.level, (counter.get(event.level) ?? 0) + 1);
  }

  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => levelRank(left.label) - levelRank(right.label));
}

export function buildTraceGroups(events: LogEvent[]) {
  const groups = new Map<string, MutableTraceGroup>();

  for (const event of events) {
    if (!event.traceId) {
      continue;
    }

    const current = groups.get(event.traceId) ?? {
      traceId: event.traceId,
      events: [],
      issueCount: 0,
      startMs: null,
      endMs: null,
    };

    current.events.push(event);
    current.issueCount += isIssueLevel(event.level) ? 1 : 0;

    if (event.timestampMs !== null) {
      current.startMs = current.startMs === null ? event.timestampMs : Math.min(current.startMs, event.timestampMs);
      current.endMs = current.endMs === null ? event.timestampMs : Math.max(current.endMs, event.timestampMs);
    }

    groups.set(event.traceId, current);
  }

  const traces: TraceGroup[] = [...groups.values()].map((group) => {
    const sorted = [...group.events].sort(compareEvents);
    const services = new Set<string>();
    const sources = new Set<string>();
    const levels = new Set<LogLevel>();
    const requestIds = new Set<string>();
    const uniqueSpans = new Set<string>();
    const eventIds: string[] = [];

    for (const event of sorted) {
      eventIds.push(event.id);
      sources.add(event.sourceLabel);
      levels.add(event.level);

      if (event.service) {
        services.add(event.service);
      }

      if (event.requestId) {
        requestIds.add(event.requestId);
      }

      if (event.spanId) {
        uniqueSpans.add(event.spanId);
      }
    }

    return {
      traceId: group.traceId,
      eventIds,
      services: [...services],
      sources: [...sources],
      levels: [...levels],
      requestIds: [...requestIds],
      eventCount: sorted.length,
      spanCount: uniqueSpans.size,
      issueCount: group.issueCount,
      startMs: group.startMs,
      endMs: group.endMs,
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

export function buildDerivedFlowGroups(events: LogEvent[]) {
  const groups = new Map<string, MutableDerivedFlowGroup>();

  for (const event of events) {
    const hint = deriveFlowHint(event);

    if (!hint.family || !hint.correlationKind || !hint.correlationValue) {
      continue;
    }

    const flowKey = `${hint.family}::${hint.correlationKind}:${hint.correlationValue}`;
    const current = groups.get(flowKey) ?? {
      correlationKind: hint.correlationKind,
      correlationValue: hint.correlationValue,
      eventCount: 0,
      eventIds: [],
      family: hint.family,
      flowKey,
      issueCount: 0,
      methods: new Set<string>(),
      resourceId: hint.resourceId,
      routes: new Set<string>(),
      services: new Set<string>(),
      sources: new Set<string>(),
      startMs: null,
      endMs: null,
    };

    current.eventCount += 1;
    current.eventIds.push(event.id);
    current.issueCount += isIssueLevel(event.level) ? 1 : 0;

    if (hint.method) {
      current.methods.add(hint.method);
    }

    if (hint.normalizedRoute) {
      current.routes.add(hint.normalizedRoute);
    }

    if (event.service) {
      current.services.add(event.service);
    }

    current.sources.add(event.sourceLabel);

    if (event.timestampMs !== null) {
      current.startMs = current.startMs === null ? event.timestampMs : Math.min(current.startMs, event.timestampMs);
      current.endMs = current.endMs === null ? event.timestampMs : Math.max(current.endMs, event.timestampMs);
    }

    groups.set(flowKey, current);
  }

  return [...groups.values()]
    .filter((group) => group.eventCount > 1)
    .map((group) => ({
      ...group,
      methods: [...group.methods],
      routes: [...group.routes],
      services: [...group.services],
      sources: [...group.sources],
    }))
    .sort((left, right) => (
      right.issueCount - left.issueCount
      || right.eventCount - left.eventCount
      || left.family.localeCompare(right.family)
      || left.correlationValue.localeCompare(right.correlationValue)
    ));
}

export function getDerivedFlowGroupForEvent(groups: DerivedFlowGroup[], selectedEvent: LogEvent | null) {
  if (!selectedEvent) {
    return null;
  }

  return groups.find((group) => group.eventIds.includes(selectedEvent.id)) ?? null;
}

export function buildTraceSourceCoverage(events: LogEvent[], traceId: string | null) {
  if (!traceId) {
    return [];
  }

  const grouped = new Map<string, MutableTraceSourceCoverage>();

  for (const event of events) {
    if (event.traceId !== traceId) {
      continue;
    }

    const current = grouped.get(event.sourceId) ?? {
      sourceId: event.sourceId,
      sourceLabel: event.sourceLabel,
      eventCount: 0,
      issueCount: 0,
      services: new Set<string>(),
    };

    current.eventCount += 1;
    current.issueCount += isIssueLevel(event.level) ? 1 : 0;

    if (event.service) {
      current.services.add(event.service);
    }

    grouped.set(event.sourceId, current);
  }

  return [...grouped.values()]
    .map((coverage) => ({
      ...coverage,
      services: [...coverage.services],
    }))
    .sort((left, right) => (
      right.issueCount - left.issueCount
      || right.eventCount - left.eventCount
      || left.sourceLabel.localeCompare(right.sourceLabel)
    ));
}

function getTraceDiffSelection(
  events: LogEvent[],
  selectedEvent: LogEvent | null,
  selectedDerivedFlowGroup: DerivedFlowGroup | null,
): { basis: TraceDiffBasis; events: LogEvent[] } | null {
  if (!selectedEvent) {
    return null;
  }

  if (selectedEvent.traceId) {
    return {
      basis: {
        kind: "trace",
        label: "Trace",
        value: selectedEvent.traceId,
      },
      events: events.filter((event) => event.traceId === selectedEvent.traceId),
    };
  }

  if (selectedEvent.requestId) {
    return {
      basis: {
        kind: "request",
        label: "Request",
        value: selectedEvent.requestId,
      },
      events: events.filter((event) => event.requestId === selectedEvent.requestId),
    };
  }

  if (!selectedDerivedFlowGroup) {
    return null;
  }

  const eventIds = new Set(selectedDerivedFlowGroup.eventIds);

  return {
    basis: {
      kind: "derivedFlow",
      label: "Derived flow",
      value: `${selectedDerivedFlowGroup.family} ${selectedDerivedFlowGroup.correlationKind}:${selectedDerivedFlowGroup.correlationValue}`,
    },
    events: events.filter((event) => eventIds.has(event.id)),
  };
}

export function buildTraceSourceDiff(
  events: LogEvent[],
  selectedEvent: LogEvent | null,
  selectedDerivedFlowGroup: DerivedFlowGroup | null = null,
): TraceSourceDiff | null {
  const selection = getTraceDiffSelection(events, selectedEvent, selectedDerivedFlowGroup);

  if (!selection || selection.events.length === 0) {
    return null;
  }

  const rows = new Map<string, MutableTraceSourceDiffRow>();
  const allServices = new Set<string>();
  const allSpanIds = new Set<string>();
  const allRoutes = new Set<string>();
  const allMethods = new Set<string>();
  let issueCount = 0;

  for (const event of selection.events.sort(compareEvents)) {
    const current = rows.get(event.sourceId) ?? {
      sourceId: event.sourceId,
      sourceLabel: event.sourceLabel,
      eventIds: [],
      eventCount: 0,
      issueCount: 0,
      selected: event.sourceId === selectedEvent?.sourceId,
      startMs: null,
      endMs: null,
      methods: new Set<string>(),
      routes: new Set<string>(),
      services: new Set<string>(),
      spanIds: new Set<string>(),
    };
    const routeAndMethod = extractRouteAndMethod(event);
    const normalizedRoute = normalizeRoutePath(routeAndMethod.route);
    const hasIssue = isIssueLevel(event.level);

    current.eventIds.push(event.id);
    current.eventCount += 1;
    current.issueCount += hasIssue ? 1 : 0;
    issueCount += hasIssue ? 1 : 0;

    if (event.timestampMs !== null) {
      current.startMs = current.startMs === null ? event.timestampMs : Math.min(current.startMs, event.timestampMs);
      current.endMs = current.endMs === null ? event.timestampMs : Math.max(current.endMs, event.timestampMs);
    }

    if (event.service) {
      current.services.add(event.service);
      allServices.add(event.service);
    }

    if (event.spanId) {
      current.spanIds.add(event.spanId);
      allSpanIds.add(event.spanId);
    }

    if (normalizedRoute) {
      current.routes.add(normalizedRoute);
      allRoutes.add(normalizedRoute);
    }

    if (routeAndMethod.method) {
      current.methods.add(routeAndMethod.method);
      allMethods.add(routeAndMethod.method);
    }

    rows.set(event.sourceId, current);
  }

  const materializedRows = [...rows.values()]
    .map((row) => ({
      ...row,
      methods: sortedSetValues(row.methods),
      missingMethods: getMissingValues(row.methods, allMethods),
      missingRoutes: getMissingValues(row.routes, allRoutes),
      missingServices: getMissingValues(row.services, allServices),
      missingSpanIds: getMissingValues(row.spanIds, allSpanIds),
      routes: sortedSetValues(row.routes),
      services: sortedSetValues(row.services),
      spanIds: sortedSetValues(row.spanIds),
    }))
    .sort((left, right) => (
      Number(right.selected) - Number(left.selected)
      || right.issueCount - left.issueCount
      || right.eventCount - left.eventCount
      || left.sourceLabel.localeCompare(right.sourceLabel)
    ));

  return {
    basis: selection.basis,
    eventCount: selection.events.length,
    issueCount,
    sourceCount: materializedRows.length,
    methods: sortedSetValues(allMethods),
    routes: sortedSetValues(allRoutes),
    services: sortedSetValues(allServices),
    spanIds: sortedSetValues(allSpanIds),
    rows: materializedRows,
  };
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

  return events
    .filter((event) => (
      event.sourceId === selectedEvent.sourceId
      && Math.abs(event.lineNumber - selectedEvent.lineNumber) <= 3
    ))
    .sort(compareEvents)
    .slice(0, limit);
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
    childIds: new Set<string>(),
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

function computeMaxDepth(nodes: SpanNode[]) {
  let maxDepth = 0;
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.pop();

    if (!node) {
      continue;
    }

    maxDepth = Math.max(maxDepth, node.depth);
    stack.push(...node.children);
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

    parent.childIds.add(spanId);
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
  const datePart = DATE_FORMATTER.format(date);
  const timePart = TIME_FORMATTER.format(date);

  return `${datePart} ${timePart}`;
}

export type { ChartPoint, FacetCount };
