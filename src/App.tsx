import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { BarChart3, FolderOpen, ListTree } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsTab } from "@/features/log-explorer/components/EventsTab";
import { OverviewSection } from "@/features/log-explorer/components/OverviewSection";
import { SidebarSection } from "@/features/log-explorer/components/SidebarSection";
import { useLogSession } from "@/features/log-explorer/hooks/useLogSession";
import { useLogExplorerFilters } from "@/features/log-explorer/hooks/useLogExplorerFilters";
import { useLogExplorerViewModel } from "@/features/log-explorer/hooks/useLogExplorerViewModel";
import type { FieldFilter } from "@/lib/logs/types";

const AnalysisTab = lazy(async () => {
  const module = await import("@/features/log-explorer/components/AnalysisTab");
  return { default: module.AnalysisTab };
});

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
  const {
    analysisDrillDownFilters,
    applyAnalysisDrillDownFilter,
    clearAnalysisDrillDownFilters,
    clearFieldFilters,
    deferredSearchTerm,
    facetFieldKey,
    fieldFilters,
    issuesOnly,
    levelFilter,
    removeAnalysisDrillDownFilter,
    removeFieldFilter,
    requestFilter,
    resetFilters,
    searchTerm,
    serviceFilter,
    setFacetFieldKey,
    setIssuesOnly,
    setLevelFilter,
    setRequestFilter,
    setSearchTerm,
    setServiceFilter,
    setSourceFilter,
    setTraceFilter,
    addFieldFilter: addFieldFilterState,
    sharedFilters,
    sourceFilter,
    traceFilter,
  } = useLogExplorerFilters();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("events");

  const {
    activeAliasOverrideCount,
    diagnosticCounts,
    diagnosticSeverityCounts,
    eventColumnFieldOptions,
    errorCount,
    eventStreamBuiltinColumns,
    eventStreamColumns,
    facetFieldKeyOptions,
    fieldFacetKeys,
    fieldLensKeys,
    fieldValueOptions,
    filteredEvents,
    formatBadges,
    hasSelectedEvent,
    hiddenFieldKeys,
    hiddenSelectedFieldKeys,
    hideAllFieldVisibility,
    hourlyChart,
    levelCounts,
    metrics,
    multilineCount,
    pinnedEventFieldColumns,
    preferredFilteredEventId,
    preferredSessionEventId,
    relatedEvents,
    requestCounts,
    requestOptions,
    resetEventColumns,
    resetFieldVisibility,
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
    toggleBuiltinEventColumn,
    toggleEventFieldColumn,
    toggleFieldVisibility,
    topDerivedFlowGroups,
    topFilteredTraceGroups,
    topTraceGroups,
    traceOptions,
    visibleFieldEntries,
  } = useLogExplorerViewModel({
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
  });
  const addFieldFilter = useCallback((fieldKey: string, fieldValue: string, operator: FieldFilter["operator"] = "include") => {
    addFieldFilterState(fieldKey, fieldValue, operator);
    setActiveTab("events");
  }, [addFieldFilterState]);

  useEffect(() => {
    if (!session) {
      return;
    }

    resetFilters();
    resetFieldVisibility();
    setSelectedEventId(preferredSessionEventId);
    setActiveTab("events");
  }, [preferredSessionEventId, resetFieldVisibility, resetFilters, session]);

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
          diagnosticKindCounts={sessionDiagnosticCounts}
          diagnosticSeverityCounts={diagnosticSeverityCounts}
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
              setSelectedEventId(group.firstEventId);
            }}
            onSelectDerivedFlowGroup={(group) => {
              setActiveTab("events");
              setSelectedEventId(group.firstEventId);
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
                    selectedTraceSourceDiff={selectedTraceSourceDiff}
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
                      activeDrillDownFilters={analysisDrillDownFilters}
                      hourlyChart={hourlyChart}
                      levelCounts={levelCounts}
                      serviceCounts={serviceCounts}
                      requestCounts={requestCounts}
                      diagnosticCounts={diagnosticCounts}
                      filteredEventCount={filteredEvents.length}
                      topTraceGroups={topFilteredTraceGroups}
                      onApplyDrillDownFilter={applyAnalysisDrillDownFilter}
                      onClearDrillDownFilters={clearAnalysisDrillDownFilters}
                      onRemoveDrillDownFilter={removeAnalysisDrillDownFilter}
                      onResetAllFilters={resetFilters}
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
