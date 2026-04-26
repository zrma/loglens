import type { LogEvent } from "@/lib/logs/types";

export type AnalysisDrillDownFilter =
  | { kind: "hourBucket"; value: string }
  | { kind: "level"; value: string }
  | { kind: "service"; value: string }
  | { kind: "request"; value: string }
  | { kind: "diagnostic"; value: string };

export function getAnalysisDrillDownId(filter: AnalysisDrillDownFilter) {
  return `${filter.kind}:${filter.value}`;
}

export function describeAnalysisDrillDownFilter(filter: AnalysisDrillDownFilter) {
  switch (filter.kind) {
    case "hourBucket":
      return `시간 ${filter.value}`;
    case "level":
      return `Level ${filter.value.toUpperCase()}`;
    case "service":
      return `Service ${filter.value}`;
    case "request":
      return `Request ${filter.value}`;
    case "diagnostic":
      return `Diagnostic ${filter.value}`;
  }
}

function getEventHourBucket(event: LogEvent) {
  if (event.timestampMs === null) {
    return null;
  }

  const hour = new Date(event.timestampMs).getHours();
  return `${hour.toString().padStart(2, "0")}시`;
}

function matchesDrillDownFilter(event: LogEvent, filter: AnalysisDrillDownFilter) {
  switch (filter.kind) {
    case "hourBucket":
      return getEventHourBucket(event) === filter.value;
    case "level":
      return event.level === filter.value;
    case "service":
      return (event.service ?? "미지정") === filter.value;
    case "request":
      return (event.requestId ?? "none") === filter.value;
    case "diagnostic":
      return event.parseIssues.some((issue) => issue.kind === filter.value);
    default:
      return true;
  }
}

export function eventMatchesAnalysisDrillDownFilters(
  event: LogEvent,
  filters: AnalysisDrillDownFilter[],
) {
  return filters.every((filter) => matchesDrillDownFilter(event, filter));
}

export function applyAnalysisDrillDownFilters(
  events: LogEvent[],
  filters: AnalysisDrillDownFilter[],
) {
  if (filters.length === 0) {
    return events;
  }

  return events.filter((event) => eventMatchesAnalysisDrillDownFilters(event, filters));
}

export function upsertAnalysisDrillDownFilter(
  filters: AnalysisDrillDownFilter[],
  nextFilter: AnalysisDrillDownFilter,
) {
  const nextFilterId = getAnalysisDrillDownId(nextFilter);

  if (filters.some((filter) => getAnalysisDrillDownId(filter) === nextFilterId)) {
    return filters;
  }

  return [
    ...filters.filter((filter) => filter.kind !== nextFilter.kind),
    nextFilter,
  ];
}
