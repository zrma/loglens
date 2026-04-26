import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, FileText, Filter, FolderOpen, GitBranch, ListTree } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsTab } from "@/features/log-explorer/components/EventsTab";
import { OverviewSection } from "@/features/log-explorer/components/OverviewSection";
import { SidebarSection } from "@/features/log-explorer/components/SidebarSection";
import {
  buildEventStreamColumns,
  DEFAULT_EVENT_STREAM_COLUMNS,
  normalizeBuiltinEventStreamColumns,
  type EventStreamBuiltinColumnId,
} from "@/features/log-explorer/event-stream-columns";
import { useLogSession } from "@/features/log-explorer/hooks/useLogSession";
import {
  type MetricCardProps,
  getDirectoryPath,
} from "@/features/log-explorer/presentation";
import {
  buildFacetCounts,
  buildDerivedFlowGroups,
  buildFieldKeyCounts,
  buildFieldValueCounts,
  buildHourlyChartData,
  buildLevelCounts,
  buildSpanForest,
  buildTraceSourceCoverage,
  buildTraceGroups,
  filterLogEvents,
  getDerivedFlowGroupForEvent,
  getRelatedEvents,
} from "@/lib/logs/analysis";
import { CANONICAL_LOG_ALIAS_FIELDS } from "@/lib/logs/aliases";
import type { FieldFilter, LogEvent, LogLevel } from "@/lib/logs/types";

const AnalysisTab = lazy(async () => {
  const module = await import("@/features/log-explorer/components/AnalysisTab");
  return { default: module.AnalysisTab };
});

const DIAGNOSTIC_LABELS = {
  invalid_json: "JSON fallback",
  multiline: "멀티라인 병합",
  timestamp_missing: "타임스탬프 누락",
} as const;

function pickPreferredEventId(events: LogEvent[]) {
  return events.find((event) => (
    event.timestampMs !== null
    && !event.parseIssues.some((issue) => issue.kind === "timestamp_missing")
  ))?.id ?? events[0]?.id ?? null;
}

function App() {
  const {
    aliasOverrides,
    errorMessage,
    loadProgress,
    loadSampleSession,
    parserPreset,
    parserPresetId,
    parserPresetOptions,
    resetAliasOverrides,
    selectLogFile,
    setAliasOverrides,
    setParserPresetId,
    session,
    sourceLabel,
    sourcePath,
  } = useLogSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [traceFilter, setTraceFilter] = useState<string | "all">("all");
  const [requestFilter, setRequestFilter] = useState<string | "all">("all");
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);
  const [facetFieldKey, setFacetFieldKey] = useState<string | "all">("all");
  const [hiddenFieldKeys, setHiddenFieldKeys] = useState<string[]>([]);
  const [eventStreamBuiltinColumns, setEventStreamBuiltinColumns] = useState<EventStreamBuiltinColumnId[]>([...DEFAULT_EVENT_STREAM_COLUMNS]);
  const [pinnedEventFieldColumns, setPinnedEventFieldColumns] = useState<string[]>([]);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("events");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setLevelFilter("all");
    setSourceFilter("all");
    setServiceFilter("all");
    setTraceFilter("all");
    setRequestFilter("all");
    setFieldFilters([]);
    setFacetFieldKey("all");
    setIssuesOnly(false);
  }, []);

  const events = useMemo(() => session?.events ?? [], [session]);
  const sharedFilters = useMemo(() => ({
    searchTerm: deferredSearchTerm,
    level: levelFilter,
    source: sourceFilter,
    service: serviceFilter,
    traceId: traceFilter,
    requestId: requestFilter,
    issuesOnly,
  }), [deferredSearchTerm, issuesOnly, levelFilter, requestFilter, serviceFilter, sourceFilter, traceFilter]);
  const scopedEvents = useMemo(() => filterLogEvents(events, {
    ...sharedFilters,
    fieldFilters: [],
  }), [events, sharedFilters]);
  const fieldFacetContextEvents = useMemo(() => filterLogEvents(events, {
    ...sharedFilters,
    fieldFilters: facetFieldKey === "all"
      ? fieldFilters
      : fieldFilters.filter((filter) => filter.key !== facetFieldKey),
  }), [events, facetFieldKey, fieldFilters, sharedFilters]);
  const filteredEvents = useMemo(() => filterLogEvents(events, {
    ...sharedFilters,
    fieldFilters,
  }), [events, fieldFilters, sharedFilters]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const traceGroups = useMemo(() => buildTraceGroups(events), [events]);
  const filteredTraceGroups = useMemo(() => buildTraceGroups(filteredEvents), [filteredEvents]);
  const derivedFlowGroups = useMemo(() => buildDerivedFlowGroups(events), [events]);
  const filteredDerivedFlowGroups = useMemo(() => buildDerivedFlowGroups(filteredEvents), [filteredEvents]);
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
  const diagnosticCounts = useMemo(() => buildFacetCounts(
    session?.diagnostics.map((diagnostic) => DIAGNOSTIC_LABELS[diagnostic.kind]) ?? [],
    "없음",
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
  const fieldKeyOptions = useMemo(() => buildFieldKeyCounts(scopedEvents), [scopedEvents]);
  const facetFieldKeyOptions = useMemo(() => {
    const counter = new Map(fieldKeyOptions.map(({ label, count }) => [label, count]));

    for (const filter of fieldFilters) {
      counter.set(filter.key, counter.get(filter.key) ?? 0);
    }

    return [...counter.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [fieldFilters, fieldKeyOptions]);
  const fieldValueOptions = useMemo(
    () => buildFieldValueCounts(fieldFacetContextEvents, facetFieldKey),
    [facetFieldKey, fieldFacetContextEvents],
  );
  const fieldFacetKeys = useMemo(() => facetFieldKeyOptions.slice(0, 8), [facetFieldKeyOptions]);
  const fieldLensKeys = useMemo(() => fieldKeyOptions.slice(0, 12), [fieldKeyOptions]);
  const eventColumnFieldOptions = useMemo(() => sessionFieldKeyOptions.slice(0, 10), [sessionFieldKeyOptions]);
  const eventStreamColumns = useMemo(
    () => buildEventStreamColumns(eventStreamBuiltinColumns, pinnedEventFieldColumns),
    [eventStreamBuiltinColumns, pinnedEventFieldColumns],
  );
  const traceOptions = useMemo(() => traceGroups.map((group) => group.traceId), [traceGroups]);
  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedEventId],
  );
  const selectedTraceGroup = useMemo(() => (
    selectedEvent?.traceId
      ? traceGroups.find((group) => group.traceId === selectedEvent.traceId) ?? null
      : null
  ), [selectedEvent?.traceId, traceGroups]);
  const selectedTraceSourceCoverage = useMemo(
    () => buildTraceSourceCoverage(events, selectedEvent?.traceId ?? null),
    [events, selectedEvent?.traceId],
  );
  const selectedDerivedFlowGroup = useMemo(
    () => getDerivedFlowGroupForEvent(derivedFlowGroups, selectedEvent),
    [derivedFlowGroups, selectedEvent],
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
    () => (traceFilter === "all" ? traceGroups : filteredTraceGroups).slice(0, 6),
    [filteredTraceGroups, traceFilter, traceGroups],
  );
  const topDerivedFlowGroups = useMemo(
    () => filteredDerivedFlowGroups.slice(0, 6),
    [filteredDerivedFlowGroups],
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
    () => Object.entries(selectedEvent?.fields ?? {}).filter(([key]) => !hiddenFieldKeys.includes(key)),
    [hiddenFieldKeys, selectedEvent?.fields],
  );
  const hiddenSelectedFieldKeys = useMemo(
    () => Object.keys(selectedEvent?.fields ?? {}).filter((key) => hiddenFieldKeys.includes(key)),
    [hiddenFieldKeys, selectedEvent?.fields],
  );
  const sessionTitle = sourceLabel ?? "세션 없음";
  const sourceCount = session?.sources.length ?? 0;
  const showSourceContext = sourceCount > 1;
  const metrics: MetricCardProps[] = useMemo(() => [
    {
      caption: sourceLabel ? "세션 전체" : "세션을 불러오면 집계됩니다",
      icon: FileText,
      iconClassName: "bg-accent text-primary",
      title: "전체 이벤트",
      value: events.length.toLocaleString(),
    },
    {
      caption: searchTerm || levelFilter !== "all" || sourceFilter !== "all" || serviceFilter !== "all" || traceFilter !== "all" || requestFilter !== "all" || fieldFilters.length > 0 || issuesOnly
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
  const preferredFilteredEventId = useMemo(
    () => pickPreferredEventId(filteredEvents),
    [filteredEvents],
  );
  const hasSelectedEvent = useMemo(
    () => (selectedEventId ? filteredEvents.some((event) => event.id === selectedEventId) : false),
    [filteredEvents, selectedEventId],
  );
  const toggleFieldVisibility = useCallback((fieldKey: string) => {
    setHiddenFieldKeys((current) => (
      current.includes(fieldKey)
        ? current.filter((key) => key !== fieldKey)
        : [...current, fieldKey]
    ));
  }, []);
  const hideAllFieldVisibility = useCallback(() => {
    setHiddenFieldKeys(fieldKeyOptions.map(({ label }) => label));
  }, [fieldKeyOptions]);
  const resetFieldVisibility = useCallback(() => {
    setHiddenFieldKeys([]);
  }, []);
  const addFieldFilter = useCallback((fieldKey: string, fieldValue: string, operator: FieldFilter["operator"] = "include") => {
    setFieldFilters((current) => {
      const next = current.filter((filter) => filter.key !== fieldKey);
      return [...next, { key: fieldKey, value: fieldValue, operator }];
    });
    setFacetFieldKey(fieldKey);
    setActiveTab("events");
  }, []);
  const removeFieldFilter = useCallback((fieldKey: string) => {
    setFieldFilters((current) => current.filter((filter) => filter.key !== fieldKey));
  }, []);
  const clearFieldFilters = useCallback(() => {
    setFieldFilters([]);
  }, []);
  const toggleBuiltinEventColumn = useCallback((columnId: EventStreamBuiltinColumnId) => {
    setEventStreamBuiltinColumns((current) => normalizeBuiltinEventStreamColumns(
      current.includes(columnId)
        ? current.filter((value) => value !== columnId)
        : [...current, columnId],
      pinnedEventFieldColumns,
    ));
  }, [pinnedEventFieldColumns]);
  const toggleEventFieldColumn = useCallback((fieldKey: string) => {
    setPinnedEventFieldColumns((current) => (
      current.includes(fieldKey)
        ? current.filter((value) => value !== fieldKey)
        : [...current, fieldKey]
    ));
  }, []);
  const resetEventColumns = useCallback(() => {
    setEventStreamBuiltinColumns([...DEFAULT_EVENT_STREAM_COLUMNS]);
    setPinnedEventFieldColumns([]);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    resetFilters();
    setHiddenFieldKeys([]);
    setSelectedEventId(pickPreferredEventId(session.events));
    setActiveTab("events");
  }, [resetFilters, session]);

  useEffect(() => {
    if (facetFieldKeyOptions.length === 0) {
      if (facetFieldKey !== "all") {
        setFacetFieldKey(fieldFilters[0]?.key ?? "all");
      }
      return;
    }

    if (facetFieldKey === "all") {
      setFacetFieldKey(fieldFilters[0]?.key ?? facetFieldKeyOptions[0]?.label ?? "all");
      return;
    }

    if (!facetFieldKeyOptions.some(({ label }) => label === facetFieldKey)) {
      setFacetFieldKey(fieldFilters[0]?.key ?? facetFieldKeyOptions[0]?.label ?? "all");
    }
  }, [facetFieldKey, facetFieldKeyOptions, fieldFilters]);

  useEffect(() => {
    if (!selectedEventId || !hasSelectedEvent) {
      setSelectedEventId(preferredFilteredEventId);
    }
  }, [hasSelectedEvent, preferredFilteredEventId, selectedEventId]);

  useEffect(() => {
    const availableFieldKeys = new Set(sessionFieldKeyOptions.map(({ label }) => label));

    setPinnedEventFieldColumns((current) => current.filter((fieldKey) => availableFieldKeys.has(fieldKey)));
  }, [sessionFieldKeyOptions]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%),radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_50%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <OverviewSection
          session={session}
          sourceLocation={sourceLocation}
          sessionTitle={sessionTitle}
          sources={session?.sources ?? []}
          sourceCount={sourceCount}
          servicesInSession={servicesInSession}
          errorCount={errorCount}
          multilineCount={multilineCount}
          formatBadges={formatBadges}
          metrics={metrics}
          errorMessage={errorMessage}
          aliasOverrides={aliasOverrides}
          activeAliasOverrideCount={activeAliasOverrideCount}
          parserPreset={parserPreset}
          parserPresetId={parserPresetId}
          parserPresetOptions={parserPresetOptions}
          loadProgress={loadProgress}
          onSelectLogFile={selectLogFile}
          onLoadSampleSession={loadSampleSession}
          onApplyAliasOverrides={setAliasOverrides}
          onResetAliasOverrides={resetAliasOverrides}
          onParserPresetChange={setParserPresetId}
        />

        <section className="grid gap-6 min-[1560px]:grid-cols-[280px_minmax(0,1fr)]">
          <SidebarSection
            hasSession={Boolean(session)}
            searchTerm={searchTerm}
            levelFilter={levelFilter}
            sourceFilter={sourceFilter}
            serviceFilter={serviceFilter}
            traceFilter={traceFilter}
            requestFilter={requestFilter}
            fieldFilters={fieldFilters}
            facetFieldKey={facetFieldKey}
            issuesOnly={issuesOnly}
            sourceOptions={sourceOptions}
            serviceOptions={serviceOptions}
            traceOptions={traceOptions}
            requestOptions={requestOptions}
            fieldKeyOptions={facetFieldKeyOptions}
            fieldValueOptions={fieldValueOptions}
            fieldFacetKeys={fieldFacetKeys}
            fieldLensKeys={fieldLensKeys}
            hiddenFieldKeys={hiddenFieldKeys}
            eventStreamBuiltinColumns={eventStreamBuiltinColumns}
            pinnedEventFieldColumns={pinnedEventFieldColumns}
            eventColumnFieldOptions={eventColumnFieldOptions}
            topTraceGroups={topTraceGroups}
            topDerivedFlowGroups={topDerivedFlowGroups}
            onSearchTermChange={setSearchTerm}
            onLevelFilterChange={setLevelFilter}
            onSourceFilterChange={setSourceFilter}
            onServiceFilterChange={setServiceFilter}
            onTraceFilterChange={setTraceFilter}
            onRequestFilterChange={setRequestFilter}
            onFacetFieldKeyChange={setFacetFieldKey}
            onIssuesOnlyChange={setIssuesOnly}
            onResetFilters={resetFilters}
            onAddFieldFilter={addFieldFilter}
            onRemoveFieldFilter={removeFieldFilter}
            onClearFieldFilters={clearFieldFilters}
            onToggleFieldVisibility={toggleFieldVisibility}
            onHideAllFieldVisibility={hideAllFieldVisibility}
            onResetFieldVisibility={resetFieldVisibility}
            onToggleBuiltinEventColumn={toggleBuiltinEventColumn}
            onToggleEventFieldColumn={toggleEventFieldColumn}
            onResetEventColumns={resetEventColumns}
            onSelectTraceGroup={(group) => {
              setTraceFilter(group.traceId);
              setActiveTab("events");
              setSelectedEventId(group.eventIds[0] ?? null);
            }}
            onSelectDerivedFlowGroup={(group) => {
              setActiveTab("events");
              setSelectedEventId(group.eventIds[0] ?? null);
            }}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 rounded-[30px] border border-border bg-card p-4 shadow-2xl shadow-black/5 backdrop-blur-xl dark:shadow-black/30">
            <div className="border-b border-border pb-4">
              <TabsList className="grid h-12 w-full max-w-[320px] grid-cols-2 rounded-full bg-muted p-1 text-muted-foreground">
                <TabsTrigger
                  value="events"
                  className="rounded-full border-0 font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <ListTree className="mr-2 size-4" />
                  이벤트 스트림
                </TabsTrigger>
                <TabsTrigger
                  value="analysis"
                  className="rounded-full border-0 font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="mr-2 size-4" />
                  연관 분석
                </TabsTrigger>
              </TabsList>
            </div>

            {!session ? (
              <div className="flex min-h-[500px] items-center justify-center px-4 py-10">
                <div className="max-w-md text-center animate-in zoom-in-95 fade-in-0 duration-700">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-accent text-primary shadow-inner">
                    <FolderOpen className="size-8" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-foreground">
                    분석을 시작하려면 로그를 선택하세요
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    이벤트 스트림, 트레이스 토폴로지 및 연관 분석 결과가 이곳에 표시됩니다. 좌측 패널에서 로컬 파일을 열거나 데모 데이터를 통해 기능들을 체험해보세요.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="events" className="mt-4">
                  <EventsTab
                    sessionTitle={sessionTitle}
                    filteredEvents={filteredEvents}
                    searchTerm={deferredSearchTerm}
                    traceFilter={traceFilter}
                    selectedEvent={selectedEvent}
                    selectedTraceGroup={selectedTraceGroup}
                    selectedTraceSourceCoverage={selectedTraceSourceCoverage}
                    selectedDerivedFlowGroup={selectedDerivedFlowGroup}
                    relatedEvents={relatedEvents}
                    spanForest={spanForest}
                    activeFieldFilters={fieldFilters}
                    eventStreamColumns={eventStreamColumns}
                    showSourceContext={showSourceContext}
                    visibleFieldEntries={visibleFieldEntries}
                    hiddenSelectedFieldKeys={hiddenSelectedFieldKeys}
                    onSelectEvent={setSelectedEventId}
                    onApplyTraceFilter={setTraceFilter}
                    onApplySourceFilter={setSourceFilter}
                    onApplyServiceFilter={setServiceFilter}
                    onApplyRequestFilter={setRequestFilter}
                    onAddFieldFilter={addFieldFilter}
                    onRemoveFieldFilter={removeFieldFilter}
                    onToggleFieldVisibility={toggleFieldVisibility}
                  />
                </TabsContent>

                <TabsContent value="analysis" className="mt-4">
                  <Suspense
                    fallback={(
                      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-border bg-card p-8 text-center">
                        <div>
                          <p className="text-lg font-medium tracking-[-0.03em] text-foreground">분석 뷰 준비 중</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            차트를 불러오고 있습니다.
                          </p>
                        </div>
                      </div>
                    )}
                  >
                    <AnalysisTab
                      hourlyChart={hourlyChart}
                      levelCounts={levelCounts}
                      serviceCounts={serviceCounts}
                      requestCounts={requestCounts}
                      diagnosticCounts={diagnosticCounts}
                      filteredTraceGroups={filteredTraceGroups}
                    />
                  </Suspense>
                </TabsContent>
              </>
            )}
          </Tabs>
        </section>
      </main>
    </div>
  );
}

export default App;
