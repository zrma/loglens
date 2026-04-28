import { useMemo } from "react";
import { AlertTriangle, FileText, Filter, GitBranch } from "lucide-react";
import {
  type AnalysisDrillDownFilter,
  eventMatchesAnalysisDrillDownFilters,
} from "@/features/log-explorer/analysis-drill-down";
import { useLogExplorerViewConfig } from "@/features/log-explorer/hooks/useLogExplorerViewConfig";
import {
  type MetricCardProps,
  getDirectoryPath,
} from "@/features/log-explorer/presentation";
import {
  buildFacetCounts,
  buildDerivedFlowGroupForEvent,
  buildFieldFacetSnapshot,
  buildFieldKeyCounts,
  buildHourlyChartData,
  buildLevelCounts,
  buildSpanForest,
  buildTopDerivedFlowGroupPreviews,
  buildTopTraceGroupPreviews,
  buildTraceSourceDiff,
  buildTraceGroups,
  createLogEventMatcher,
  getRelatedEvents,
} from "@/lib/logs/analysis";
import {
  CANONICAL_LOG_ALIAS_FIELDS,
  type LogFieldAliasOverrides,
} from "@/lib/logs/aliases";
import type { FieldFilter, LogEvent, LogFilters, ParsedLogSession } from "@/lib/logs/types";

type SharedLogFilters = Omit<LogFilters, "fieldFilters">;

type UseLogExplorerViewModelOptions = {
  activeTab: string;
  aliasOverrides: LogFieldAliasOverrides;
  analysisDrillDownFilters: AnalysisDrillDownFilter[];
  facetFieldKey: string;
  fieldFilters: FieldFilter[];
  issuesOnly: boolean;
  levelFilter: LogFilters["level"];
  requestFilter: LogFilters["requestId"];
  searchTerm: string;
  selectedEventId: string | null;
  serviceFilter: LogFilters["service"];
  session: ParsedLogSession | null;
  sharedFilters: SharedLogFilters;
  sourceFilter: LogFilters["source"];
  sourceLabel: string | null;
  sourcePath: string | null;
  traceFilter: LogFilters["traceId"];
};

const DIAGNOSTIC_LABELS = {
  alias_override_applied: "Alias override",
  correlation_field_missing: "Correlation 누락",
  field_collision: "필드 충돌",
  json_parse_failed: "JSON 파싱 실패",
  key_value_partial_parse: "Key/value 일부 파싱",
  multiline_merged: "멀티라인 병합",
  structured_parse_fallback: "구조화 fallback",
  timestamp_missing: "타임스탬프 누락",
  timestamp_parse_failed: "타임스탬프 파싱 실패",
} as const;

function buildDiagnosticCounts(kinds: string[]) {
  return buildFacetCounts(kinds, "없음").map(({ label, count }) => ({
    count,
    label: DIAGNOSTIC_LABELS[label as keyof typeof DIAGNOSTIC_LABELS] ?? label,
    value: label,
  }));
}

function filterLogEventsWithDrillDown(
  events: LogEvent[],
  filters: LogFilters,
  drillDownFilters: AnalysisDrillDownFilter[],
) {
  const matchesLogEvent = createLogEventMatcher(filters);

  if (drillDownFilters.length === 0) {
    return events.filter(matchesLogEvent);
  }

  return events.filter((event) => (
    matchesLogEvent(event)
    && eventMatchesAnalysisDrillDownFilters(event, drillDownFilters)
  ));
}

export function pickPreferredLogEventId(events: LogEvent[]) {
  return events.find((event) => (
    event.timestampMs !== null
    && !event.parseIssues.some((issue) => issue.kind === "timestamp_missing")
  ))?.id ?? events[0]?.id ?? null;
}

export function useLogExplorerViewModel({
  activeTab,
  aliasOverrides,
  analysisDrillDownFilters,
  facetFieldKey,
  fieldFilters,
  issuesOnly,
  levelFilter,
  requestFilter,
  searchTerm,
  selectedEventId,
  serviceFilter,
  session,
  sharedFilters,
  sourceFilter,
  sourceLabel,
  sourcePath,
  traceFilter,
}: UseLogExplorerViewModelOptions) {
  const events = useMemo(() => session?.events ?? [], [session]);
  const filteredEvents = useMemo(() => filterLogEventsWithDrillDown(events, {
    ...sharedFilters,
    fieldFilters,
  }, analysisDrillDownFilters), [analysisDrillDownFilters, events, fieldFilters, sharedFilters]);
  const scopedEventMatcher = useMemo(() => createLogEventMatcher({
    ...sharedFilters,
    fieldFilters: [],
  }), [sharedFilters]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const traceGroups = useMemo(() => buildTraceGroups(events), [events]);
  const topFilteredTraceGroups = useMemo(() => buildTopTraceGroupPreviews(filteredEvents, 4), [filteredEvents]);
  const topDerivedFlowGroups = useMemo(() => buildTopDerivedFlowGroupPreviews(filteredEvents, 6), [filteredEvents]);
  const levelCounts = useMemo(() => buildLevelCounts(filteredEvents), [filteredEvents]);
  const serviceCounts = useMemo(
    () => buildFacetCounts(filteredEvents.map((event) => event.service), "미지정"),
    [filteredEvents],
  );
  const requestCounts = useMemo(() => buildFacetCounts(
    filteredEvents
      .map((event) => event.requestId)
      .filter((requestId): requestId is string => Boolean(requestId)),
    "none",
  ), [filteredEvents]);
  const sessionDiagnosticCounts = useMemo(() => buildDiagnosticCounts(
    session?.diagnostics.map((diagnostic) => diagnostic.kind) ?? [],
  ), [session]);
  const diagnosticCounts = useMemo(() => buildDiagnosticCounts(
    filteredEvents.flatMap((event) => event.parseIssues.map((issue) => issue.kind)),
  ), [filteredEvents]);
  const diagnosticSeverityCounts = useMemo(() => buildFacetCounts(
    session?.diagnostics.map((diagnostic) => diagnostic.severity) ?? [],
    "none",
  ), [session]);
  const hourlyChart = useMemo(() => buildHourlyChartData(filteredEvents), [filteredEvents]);
  const serviceOptions = useMemo(
    () => buildFacetCounts(events.map((event) => event.service), "미지정"),
    [events],
  );
  const sourceOptions = useMemo(
    () => (session?.sources ?? []).map((source) => ({
      count: source.eventCount,
      label: source.label,
      value: source.id,
    })),
    [session],
  );
  const requestOptions = useMemo(
    () => buildFacetCounts(events.map((event) => event.requestId), "none"),
    [events],
  );
  const sessionFieldKeyOptions = useMemo(() => buildFieldKeyCounts(events), [events]);
  const fieldFacetSnapshot = useMemo(() => buildFieldFacetSnapshot(events, {
    fieldFilters,
    matchesBaseEvent: (event) => (
      scopedEventMatcher(event)
      && eventMatchesAnalysisDrillDownFilters(event, analysisDrillDownFilters)
    ),
    selectedFieldKey: facetFieldKey,
  }), [analysisDrillDownFilters, events, facetFieldKey, fieldFilters, scopedEventMatcher]);
  const fieldKeyOptions = fieldFacetSnapshot.fieldKeyCounts;
  const facetFieldKeyOptions = useMemo(() => {
    const counter = new Map(fieldKeyOptions.map(({ label, count }) => [label, count]));

    for (const filter of fieldFilters) {
      counter.set(filter.key, counter.get(filter.key) ?? 0);
    }

    return [...counter.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [fieldFilters, fieldKeyOptions]);
  const fieldValueOptions = fieldFacetSnapshot.fieldValueCounts;
  const fieldFacetKeys = useMemo(() => facetFieldKeyOptions.slice(0, 8), [facetFieldKeyOptions]);
  const fieldLensKeys = useMemo(() => fieldKeyOptions.slice(0, 12), [fieldKeyOptions]);
  const eventColumnFieldOptions = useMemo(() => sessionFieldKeyOptions.slice(0, 10), [sessionFieldKeyOptions]);
  const viewConfig = useLogExplorerViewConfig({
    fieldKeyOptions,
    sessionFieldKeyOptions,
  });
  const sourceCount = session?.sources.length ?? 0;
  const showSourceContext = sourceCount > 1;
  const shouldBuildEventDetails = activeTab === "events";
  const traceOptions = useMemo(() => traceGroups.map((group) => group.traceId), [traceGroups]);
  const selectedEvent = useMemo(
    () => {
      if (!shouldBuildEventDetails) {
        return null;
      }

      return filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null;
    },
    [filteredEvents, selectedEventId, shouldBuildEventDetails],
  );
  const selectedTraceGroup = useMemo(() => (
    selectedEvent?.traceId
      ? traceGroups.find((group) => group.traceId === selectedEvent.traceId) ?? null
      : null
  ), [selectedEvent?.traceId, traceGroups]);
  const selectedDerivedFlowGroup = useMemo(
    () => (
      shouldBuildEventDetails
        ? buildDerivedFlowGroupForEvent(events, selectedEvent)
        : null
    ),
    [events, selectedEvent, shouldBuildEventDetails],
  );
  const selectedTraceSourceDiff = useMemo(
    () => (
      shouldBuildEventDetails && showSourceContext
        ? buildTraceSourceDiff(events, selectedEvent, selectedDerivedFlowGroup)
        : null
    ),
    [events, selectedDerivedFlowGroup, selectedEvent, shouldBuildEventDetails, showSourceContext],
  );
  const relatedEvents = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    if (!selectedEvent.traceId && selectedDerivedFlowGroup) {
      return selectedDerivedFlowGroup.eventIds
        .map((eventId) => eventsById.get(eventId))
        .filter((event): event is LogEvent => Boolean(event))
        .slice(0, 10);
    }

    return getRelatedEvents(events, selectedEvent, 10);
  }, [events, eventsById, selectedDerivedFlowGroup, selectedEvent]);
  const spanForest = useMemo(
    () => buildSpanForest(events, selectedEvent?.traceId ?? null),
    [events, selectedEvent?.traceId],
  );
  const topTraceGroups = useMemo(
    () => buildTopTraceGroupPreviews(traceFilter === "all" ? events : filteredEvents, 6),
    [events, filteredEvents, traceFilter],
  );
  const servicesInSession = useMemo(
    () => new Set(events.map((event) => event.service).filter(Boolean)).size,
    [events],
  );
  const tracesInSession = traceGroups.length;
  const multilineCount = useMemo(
    () => events.filter((event) => event.isMultiLine).length,
    [events],
  );
  const parserNoteCount = session?.diagnostics.length ?? 0;
  const activeAliasOverrideCount = useMemo(() => (
    CANONICAL_LOG_ALIAS_FIELDS.reduce((total, field) => (
      total + (aliasOverrides[field]?.length ?? 0)
    ), 0)
  ), [aliasOverrides]);
  const errorCount = useMemo(
    () => events.filter((event) => event.level === "error" || event.level === "fatal").length,
    [events],
  );
  const formatBadges = useMemo(() => (
    session
      ? [
        { label: "JSON", count: session.formatCounts.json },
        { label: "KV", count: session.formatCounts.keyvalue },
        { label: "PLAIN", count: session.formatCounts.plain },
      ]
      : []
  ), [session]);
  const sourceLocation = useMemo(
    () => {
      if (sourcePath) {
        return getDirectoryPath(sourcePath);
      }

      if ((session?.sources.length ?? 0) > 1) {
        return `${session?.sources.length ?? 0}개 파일 병합 세션`;
      }

      return "샘플 세션";
    },
    [session?.sources.length, sourcePath],
  );
  const visibleFieldEntries = useMemo(
    () => Object.entries(selectedEvent?.fields ?? {}).filter(([key]) => !viewConfig.hiddenFieldKeys.includes(key)),
    [selectedEvent?.fields, viewConfig.hiddenFieldKeys],
  );
  const hiddenSelectedFieldKeys = useMemo(
    () => Object.keys(selectedEvent?.fields ?? {}).filter((key) => viewConfig.hiddenFieldKeys.includes(key)),
    [selectedEvent?.fields, viewConfig.hiddenFieldKeys],
  );
  const sessionTitle = sourceLabel ?? "세션 없음";
  const metrics: MetricCardProps[] = useMemo(() => [
    {
      caption: sourceLabel ? "세션 전체" : "세션을 불러오면 집계됩니다",
      icon: FileText,
      iconClassName: "bg-accent text-primary",
      title: "전체 이벤트",
      value: events.length.toLocaleString(),
    },
    {
      caption: searchTerm || levelFilter !== "all" || sourceFilter !== "all" || serviceFilter !== "all" || traceFilter !== "all" || requestFilter !== "all" || fieldFilters.length > 0 || analysisDrillDownFilters.length > 0 || issuesOnly
        ? "필터 적용 결과"
        : "현재 탐색 범위",
      icon: Filter,
      iconClassName: "bg-secondary text-secondary-foreground",
      title: "탐색 범위",
      value: filteredEvents.length.toLocaleString(),
    },
    {
      caption: "trace ID 기준 그룹",
      icon: GitBranch,
      iconClassName: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
      title: "Trace 그룹",
      value: tracesInSession.toLocaleString(),
    },
    {
      caption: "멀티라인 병합, 타임스탬프 누락 등",
      icon: AlertTriangle,
      iconClassName: "bg-[color:var(--chart-4)]/15 text-[color:var(--chart-4)]",
      title: "파서 노트",
      value: parserNoteCount.toLocaleString(),
    },
  ], [
    events.length,
    analysisDrillDownFilters.length,
    fieldFilters.length,
    filteredEvents.length,
    issuesOnly,
    levelFilter,
    parserNoteCount,
    requestFilter,
    searchTerm,
    serviceFilter,
    sourceLabel,
    sourceFilter,
    traceFilter,
    tracesInSession,
  ]);
  const preferredSessionEventId = useMemo(
    () => pickPreferredLogEventId(events),
    [events],
  );
  const preferredFilteredEventId = useMemo(
    () => pickPreferredLogEventId(filteredEvents),
    [filteredEvents],
  );
  const hasSelectedEvent = useMemo(
    () => (selectedEventId ? filteredEvents.some((event) => event.id === selectedEventId) : false),
    [filteredEvents, selectedEventId],
  );

  return {
    activeAliasOverrideCount,
    applyViewSnapshot: viewConfig.applyViewSnapshot,
    diagnosticCounts,
    diagnosticSeverityCounts,
    eventColumnFieldOptions,
    errorCount,
    eventStreamBuiltinColumns: viewConfig.eventStreamBuiltinColumns,
    eventStreamColumns: viewConfig.eventStreamColumns,
    facetFieldKeyOptions,
    fieldFacetKeys,
    fieldKeyOptions,
    fieldLensKeys,
    fieldValueOptions,
    filteredEvents,
    formatBadges,
    hasSelectedEvent,
    hiddenFieldKeys: viewConfig.hiddenFieldKeys,
    hiddenSelectedFieldKeys,
    hideAllFieldVisibility: viewConfig.hideAllFieldVisibility,
    hourlyChart,
    levelCounts,
    metrics,
    multilineCount,
    pinnedEventFieldColumns: viewConfig.pinnedEventFieldColumns,
    preferredFilteredEventId,
    preferredSessionEventId,
    relatedEvents,
    requestCounts,
    requestOptions,
    resetEventColumns: viewConfig.resetEventColumns,
    resetFieldVisibility: viewConfig.resetFieldVisibility,
    selectedDerivedFlowGroup,
    selectedEvent,
    selectedTraceGroup,
    selectedTraceSourceDiff,
    serviceCounts,
    serviceOptions,
    servicesInSession,
    sessionDiagnosticCounts,
    sessionTitle,
    showSourceContext,
    sourceCount,
    sourceLocation,
    sourceOptions,
    spanForest,
    toggleBuiltinEventColumn: viewConfig.toggleBuiltinEventColumn,
    toggleEventFieldColumn: viewConfig.toggleEventFieldColumn,
    toggleFieldVisibility: viewConfig.toggleFieldVisibility,
    topDerivedFlowGroups,
    topFilteredTraceGroups,
    topTraceGroups,
    traceOptions,
    visibleFieldEntries,
  };
}
