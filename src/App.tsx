import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, FileText, Filter, FolderOpen, GitBranch, ListTree } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsTab } from "@/features/log-explorer/components/EventsTab";
import { OverviewSection } from "@/features/log-explorer/components/OverviewSection";
import { SidebarSection } from "@/features/log-explorer/components/SidebarSection";
import { useLogSession } from "@/features/log-explorer/hooks/useLogSession";
import {
  type MetricCardProps,
  getDirectoryPath,
} from "@/features/log-explorer/presentation";
import {
  buildFacetCounts,
  buildHourlyChartData,
  buildLevelCounts,
  buildSpanForest,
  buildTraceGroups,
  filterLogEvents,
  getRelatedEvents,
} from "@/lib/logs/analysis";
import type { LogLevel } from "@/lib/logs/types";

const AnalysisTab = lazy(async () => {
  const module = await import("@/features/log-explorer/components/AnalysisTab");
  return { default: module.AnalysisTab };
});

const DIAGNOSTIC_LABELS = {
  invalid_json: "JSON fallback",
  multiline: "multiline 병합",
  timestamp_missing: "timestamp 없음",
} as const;

function App() {
  const {
    errorMessage,
    loadProgress,
    loadSampleSession,
    selectLogFile,
    session,
    sourceLabel,
    sourcePath,
  } = useLogSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [traceFilter, setTraceFilter] = useState<string | "all">("all");
  const [requestFilter, setRequestFilter] = useState<string | "all">("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("events");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setLevelFilter("all");
    setServiceFilter("all");
    setTraceFilter("all");
    setRequestFilter("all");
    setIssuesOnly(false);
  }, []);

  const events = useMemo(() => session?.events ?? [], [session]);
  const filteredEvents = useMemo(() => filterLogEvents(events, {
    searchTerm: deferredSearchTerm,
    level: levelFilter,
    service: serviceFilter,
    traceId: traceFilter,
    requestId: requestFilter,
    issuesOnly,
  }), [deferredSearchTerm, events, issuesOnly, levelFilter, requestFilter, serviceFilter, traceFilter]);
  const traceGroups = useMemo(() => buildTraceGroups(events), [events]);
  const filteredTraceGroups = useMemo(() => buildTraceGroups(filteredEvents), [filteredEvents]);
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
  const requestOptions = useMemo(
    () => buildFacetCounts(events.map((event) => event.requestId), "none"),
    [events],
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
  const relatedEvents = useMemo(() => getRelatedEvents(events, selectedEvent, 10), [events, selectedEvent]);
  const spanForest = useMemo(
    () => buildSpanForest(events, selectedEvent?.traceId ?? null),
    [events, selectedEvent?.traceId],
  );
  const topTraceGroups = useMemo(
    () => (traceFilter === "all" ? traceGroups : filteredTraceGroups).slice(0, 6),
    [filteredTraceGroups, traceFilter, traceGroups],
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
    () => (sourcePath ? getDirectoryPath(sourcePath) : "샘플 세션"),
    [sourcePath],
  );
  const sessionTitle = sourceLabel ?? "No Active Session";
  const metrics: MetricCardProps[] = useMemo(() => [
    {
      caption: sourceLabel ? "현재 세션 전체 이벤트 수" : "파일 또는 샘플 세션을 불러오면 집계됩니다",
      icon: FileText,
      iconClassName: "bg-primary/10 text-primary",
      title: "이벤트 수",
      value: events.length.toLocaleString(),
    },
    {
      caption: searchTerm || levelFilter !== "all" || serviceFilter !== "all" || traceFilter !== "all" || requestFilter !== "all" || issuesOnly
        ? "현재 필터가 적용된 결과"
        : "지금 화면에 표시되는 탐색 범위",
      icon: Filter,
      iconClassName: "bg-secondary text-secondary-foreground",
      title: "현재 탐색 범위",
      value: filteredEvents.length.toLocaleString(),
    },
    {
      caption: "traceId가 있는 이벤트를 기준으로 그룹화",
      icon: GitBranch,
      iconClassName: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
      title: "추적 가능한 trace",
      value: tracesInSession.toLocaleString(),
    },
    {
      caption: "멀티라인 병합과 timestamp 누락 등 parser 진단 수",
      icon: AlertTriangle,
      iconClassName: "bg-[color:var(--chart-4)]/15 text-[color:var(--chart-4)]",
      title: "Parser Notes",
      value: parserNoteCount.toLocaleString(),
    },
  ], [
    events.length,
    filteredEvents.length,
    issuesOnly,
    levelFilter,
    parserNoteCount,
    requestFilter,
    searchTerm,
    serviceFilter,
    sourceLabel,
    traceFilter,
    tracesInSession,
  ]);
  const firstFilteredEventId = filteredEvents[0]?.id ?? null;
  const hasSelectedEvent = useMemo(
    () => (selectedEventId ? filteredEvents.some((event) => event.id === selectedEventId) : false),
    [filteredEvents, selectedEventId],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    resetFilters();
    setSelectedEventId(session.events[0]?.id ?? null);
    setActiveTab("events");
  }, [resetFilters, session]);

  useEffect(() => {
    if (!selectedEventId || !hasSelectedEvent) {
      setSelectedEventId(firstFilteredEventId);
    }
  }, [firstFilteredEventId, hasSelectedEvent, selectedEventId]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_12%_10%,rgba(55,160,150,0.18),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(232,153,83,0.2),transparent_26%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <OverviewSection
          session={session}
          sourceLabel={sourceLabel}
          sourceLocation={sourceLocation}
          sessionTitle={sessionTitle}
          servicesInSession={servicesInSession}
          errorCount={errorCount}
          multilineCount={multilineCount}
          formatBadges={formatBadges}
          metrics={metrics}
          errorMessage={errorMessage}
          loadProgress={loadProgress}
          onSelectLogFile={selectLogFile}
          onLoadSampleSession={loadSampleSession}
        />

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <SidebarSection
            hasSession={Boolean(session)}
            searchTerm={searchTerm}
            levelFilter={levelFilter}
            serviceFilter={serviceFilter}
            traceFilter={traceFilter}
            requestFilter={requestFilter}
            issuesOnly={issuesOnly}
            serviceOptions={serviceOptions}
            traceOptions={traceOptions}
            requestOptions={requestOptions}
            topTraceGroups={topTraceGroups}
            onSearchTermChange={setSearchTerm}
            onLevelFilterChange={setLevelFilter}
            onServiceFilterChange={setServiceFilter}
            onTraceFilterChange={setTraceFilter}
            onRequestFilterChange={setRequestFilter}
            onIssuesOnlyChange={setIssuesOnly}
            onResetFilters={resetFilters}
            onSelectTraceGroup={(group) => {
              setTraceFilter(group.traceId);
              setActiveTab("events");
              setSelectedEventId(group.eventIds[0] ?? null);
            }}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 rounded-[30px] border border-white/60 bg-white/72 p-4 shadow-[0_28px_90px_-48px_rgba(11,37,53,0.55)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">구조화 로그 세션</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  현재는 이벤트 목록, span 관계, parser note, trace 단서를 함께 보여주는 최소 탐색 루프를 제공합니다.
                </p>
              </div>

              <TabsList className="grid h-11 w-full max-w-[320px] grid-cols-2 rounded-full bg-slate-950 p-1 text-slate-400">
                <TabsTrigger
                  value="events"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <ListTree className="size-4" />
                  이벤트
                </TabsTrigger>
                <TabsTrigger
                  value="analysis"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <BarChart3 className="size-4" />
                  분석
                </TabsTrigger>
              </TabsList>
            </div>

            {!session ? (
              <div className="flex min-h-[580px] items-center justify-center px-4 py-10">
                <div className="max-w-xl text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FolderOpen className="size-7" />
                  </div>
                  <h3 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                    구조화 탐색 세션을 시작해 보세요
                  </h3>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    로그 파일을 열거나 샘플 세션을 불러오면, 문자열 라인이 아닌 이벤트 단위로 정리된 목록과 trace 요약이
                    여기에 표시됩니다.
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
                    relatedEvents={relatedEvents}
                    spanForest={spanForest}
                    onSelectEvent={setSelectedEventId}
                    onApplyTraceFilter={setTraceFilter}
                    onApplyServiceFilter={setServiceFilter}
                    onApplyRequestFilter={setRequestFilter}
                  />
                </TabsContent>

                <TabsContent value="analysis" className="mt-4">
                  <Suspense
                    fallback={(
                      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-white/70 p-8 text-center">
                        <div>
                          <p className="text-lg font-medium tracking-[-0.03em] text-foreground">분석 패널을 준비 중입니다</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            차트 모듈을 필요할 때만 로드하도록 분리했습니다.
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
