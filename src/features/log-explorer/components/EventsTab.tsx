import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatTimestamp } from "@/lib/logs/analysis";
import type {
  DerivedFlowGroup,
  FieldFilter,
  LogEvent,
  ParseIssue,
  SpanForest,
  SpanNode,
  TraceGroup,
  TraceSourceCoverage,
} from "@/lib/logs/types";
import { cn } from "@/lib/utils";
import { LevelBadge, formatTraceLabel } from "@/features/log-explorer/presentation";
import { VirtualizedEventStream } from "@/features/log-explorer/components/VirtualizedEventStream";
import type { EventStreamColumn } from "@/features/log-explorer/event-stream-columns";

type EventsTabProps = {
  sessionTitle: string;
  filteredEvents: LogEvent[];
  searchTerm: string;
  traceFilter: string | "all";
  selectedEvent: LogEvent | null;
  selectedTraceGroup: TraceGroup | null;
  selectedTraceSourceCoverage: TraceSourceCoverage[];
  selectedDerivedFlowGroup: DerivedFlowGroup | null;
  relatedEvents: LogEvent[];
  spanForest: SpanForest | null;
  activeFieldFilters: FieldFilter[];
  eventStreamColumns: EventStreamColumn[];
  showSourceContext: boolean;
  visibleFieldEntries: Array<[string, string]>;
  hiddenSelectedFieldKeys: string[];
  onSelectEvent: (eventId: string) => void;
  onApplyTraceFilter: (traceId: string) => void;
  onApplySourceFilter: (sourceId: string | "all") => void;
  onApplyServiceFilter: (service: string) => void;
  onApplyRequestFilter: (requestId: string) => void;
  onAddFieldFilter: (fieldKey: string, fieldValue: string, operator?: FieldFilter["operator"]) => void;
  onRemoveFieldFilter: (fieldKey: string) => void;
  onToggleFieldVisibility: (fieldKey: string) => void;
};

function buildSpanBarStyle(node: SpanNode, group: TraceGroup | null) {
  if (node.startMs === null || node.endMs === null || !group || group.startMs === null || group.endMs === null) {
    return null;
  }

  const traceDuration = Math.max(group.endMs - group.startMs, 1);
  const offset = ((node.startMs - group.startMs) / traceDuration) * 100;
  const width = Math.max(((node.endMs - node.startMs) / traceDuration) * 100, 8);

  return {
    left: `${Math.max(offset, 0)}%`,
    width: `${Math.min(width, 100 - Math.max(offset, 0))}%`,
  };
}

function getDiagnosticSeverityTone(severity: ParseIssue["severity"]) {
  switch (severity) {
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "info":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatDiagnosticSeverity(severity: ParseIssue["severity"]) {
  return severity.toUpperCase();
}

function SpanTopologyNode({
  node,
  selectedTraceGroup,
  onSelectEvent,
}: {
  node: SpanNode;
  selectedTraceGroup: TraceGroup | null;
  onSelectEvent: (eventId: string) => void;
}) {
  const barStyle = buildSpanBarStyle(node, selectedTraceGroup);
  const topologyIndent = Math.min(node.depth, 6) * 18;

  return (
    <div className="space-y-3" style={{ paddingLeft: `${topologyIndent}px` }}>
      <button
        type="button"
        onClick={() => {
          const nextEventId = node.eventIds[0];

          if (nextEventId) {
            onSelectEvent(nextEventId);
          }
        }}
        className="w-full rounded-3xl border border-border bg-card p-4 text-left transition hover:border-primary hover:bg-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium tracking-[-0.02em] text-foreground">{node.service ?? "(서비스 미지정)"}</span>
              <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                {node.spanId}
              </span>
              {node.issueCount > 0 && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                  issue {node.issueCount}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{node.label}</p>
          </div>
          <LevelBadge level={node.level} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span>events {node.eventCount}</span>
          <span>duration {formatDuration(node.startMs, node.endMs)}</span>
          {node.parentSpanId && <span>parent {node.parentSpanId}</span>}
          {node.requestIds[0] && <span>request {node.requestIds[0]}</span>}
        </div>

        {barStyle && (
          <div className="mt-4 rounded-full bg-secondary p-1">
            <div className="relative h-2 rounded-full bg-background">
              <div
                className="absolute top-0 h-2 rounded-full bg-[color:var(--chart-1)]"
                style={barStyle}
              />
            </div>
          </div>
        )}
      </button>

      {node.children.length > 0 && (
        <div className="space-y-3">
          {node.children.map((child) => (
            <SpanTopologyNode
              key={child.spanId}
              node={child}
              selectedTraceGroup={selectedTraceGroup}
              onSelectEvent={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventsTab({
  sessionTitle,
  filteredEvents,
  searchTerm,
  traceFilter,
  selectedEvent,
  selectedTraceGroup,
  selectedTraceSourceCoverage,
  selectedDerivedFlowGroup,
  relatedEvents,
  spanForest,
  activeFieldFilters,
  eventStreamColumns,
  showSourceContext,
  visibleFieldEntries,
  hiddenSelectedFieldKeys,
  onSelectEvent,
  onApplyTraceFilter,
  onApplySourceFilter,
  onApplyServiceFilter,
  onApplyRequestFilter,
  onAddFieldFilter,
  onRemoveFieldFilter,
  onToggleFieldVisibility,
}: EventsTabProps) {
  return (
    <div className="min-w-0 grid gap-6 min-[1820px]:grid-cols-[minmax(0,1.28fr)_340px]">
      <Card className="min-w-0 h-[clamp(34rem,72vh,52rem)] overflow-hidden border-border bg-card shadow-none min-[1820px]:h-[calc(100vh-7rem)]">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-[-0.04em]">이벤트 스트림</CardTitle>
                <CardDescription className="pt-2 leading-6">
                  필터 결과 {filteredEvents.length.toLocaleString()}개 이벤트
                </CardDescription>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                <span className="max-w-full truncate rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  source: {sessionTitle}
                </span>
                {traceFilter !== "all" && (
                  <span className="max-w-full truncate rounded-full border border-primary bg-accent px-3 py-1 text-xs font-medium text-primary">
                    trace: {formatTraceLabel(traceFilter)}
                  </span>
                )}
              </div>
            </div>
            {activeFieldFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFieldFilters.map((filter) => (
                  <button
                    key={`${filter.key}:${filter.operator}:${filter.value}`}
                    type="button"
                    onClick={() => onRemoveFieldFilter(filter.key)}
                    className={cn(
                      "max-w-full rounded-full border px-3 py-1 text-xs font-medium transition",
                      filter.operator === "exclude"
                        ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                        : "border-primary bg-accent text-primary hover:border-primary hover:bg-accent",
                    )}
                  >
                    {filter.key} {filter.operator === "exclude" ? "!=" : "="} {filter.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {filteredEvents.length > 0 ? (
            <VirtualizedEventStream
              columns={eventStreamColumns}
              events={filteredEvents}
              searchTerm={searchTerm}
              selectedEventId={selectedEvent?.id ?? null}
              showSourceContext={showSourceContext}
              onSelectEvent={onSelectEvent}
            />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-10">
              <div className="max-w-md text-center">
                <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                  필터 조건에 맞는 이벤트가 없습니다
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  검색어나 필터를 조정해 보세요.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-border bg-card shadow-none min-[1820px]:sticky min-[1820px]:top-6 min-[1820px]:h-[calc(100vh-7rem)] min-[1820px]:self-start">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xl tracking-[-0.03em]">이벤트 상세 분석</CardTitle>
          <CardDescription className="pt-1 text-xs leading-5">
            로그 원문과 추출된 맥락 정보를 분석합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-5 min-[1820px]:min-h-0 min-[1820px]:flex-1 min-[1820px]:overflow-y-auto">
          {selectedEvent ? (
            <>
              {/* 1. 핵심 메시지 */}
              <div className="min-w-0 rounded-3xl bg-slate-950 px-5 py-5 text-slate-50 shadow-xl shadow-slate-900/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <LevelBadge level={selectedEvent.level} />
                      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Selected Event</span>
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight text-white">
                      {selectedEvent.service ?? "Service Unspecified"}
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white/5 p-4">
                  <p className="font-mono text-[15px] leading-relaxed text-slate-100 break-all [overflow-wrap:anywhere]">
                    {selectedEvent.message}
                  </p>
                </div>
              </div>

              {selectedEvent.parseIssues.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">이벤트 Diagnostics</p>
                    <span className="text-[10px] font-medium text-amber-700">{selectedEvent.parseIssues.length} notes</span>
                  </div>
                  <div className="space-y-2">
                    {selectedEvent.parseIssues.map((issue, index) => (
                      <div
                        key={`${selectedEvent.id}-${issue.kind}-${index}`}
                        className="rounded-xl border border-amber-200 bg-card px-3 py-2 text-[11px] leading-relaxed text-foreground"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDiagnosticSeverityTone(issue.severity)}`}>
                            {formatDiagnosticSeverity(issue.severity)}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">{issue.kind}</span>
                        </div>
                        <p>{issue.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. 주요 맥락 (Context) 및 필터 액션 */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">컨텍스트 및 필터</p>
                <div className="grid gap-2">
                  {[
                    { label: "Source", value: selectedEvent.sourceLabel, action: () => onApplySourceFilter(selectedEvent.sourceId), show: showSourceContext },
                    { label: "Trace ID", value: selectedEvent.traceId, action: () => onApplyTraceFilter(selectedEvent.traceId!), show: !!selectedEvent.traceId },
                    { label: "Service", value: selectedEvent.service, action: () => onApplyServiceFilter(selectedEvent.service!), show: !!selectedEvent.service },
                    { label: "Request ID", value: selectedEvent.requestId, action: () => onApplyRequestFilter(selectedEvent.requestId!), show: !!selectedEvent.requestId },
                  ].filter(item => item.show).map((item) => (
                    <div key={item.label} className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted p-3 transition-colors hover:border-primary hover:bg-background">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
                        <p className="truncate font-mono text-xs font-semibold text-foreground">{item.value}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 rounded-full border-primary bg-background px-3 text-[10px] font-bold text-primary opacity-0 shadow-sm transition-all hover:border-primary hover:bg-accent group-hover:opacity-100"
                        onClick={item.action}
                      >
                        필터 추가
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-muted-foreground">Line Number</p>
                      <p className="font-mono text-xs font-semibold text-foreground">
                        #{selectedEvent.lineNumber}
                        {selectedEvent.endLineNumber > selectedEvent.lineNumber ? `-${selectedEvent.endLineNumber}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. 분석 인사이트 (Trace & Flow) */}
              {(spanForest || selectedDerivedFlowGroup) && (
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">분석 정보</p>
                  
                  {selectedDerivedFlowGroup && (
                    <div className="rounded-2xl border border-primary bg-accent p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-primary">추론된 흐름: {selectedDerivedFlowGroup.family}</p>
                        <span className="text-[10px] font-medium text-primary">{selectedDerivedFlowGroup.eventCount} evt</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-primary">
                        {selectedDerivedFlowGroup.correlationKind} 기반 연관 분석 결과
                      </p>
                    </div>
                  )}

                  {spanForest && (
                    <div className="rounded-2xl border border-border bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground">Span 토폴로지</p>
                        <span className="text-[10px] text-muted-foreground">{spanForest.totalSpans} spans</span>
                      </div>
                      <div className="mt-3 max-h-[320px] overflow-y-auto pr-2">
                        {spanForest.roots.map((root) => (
                          <SpanTopologyNode
                            key={root.spanId}
                            node={root}
                            selectedTraceGroup={selectedTraceGroup}
                            onSelectEvent={onSelectEvent}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {showSourceContext && selectedTraceSourceCoverage.length > 0 && (
                    <div className="rounded-2xl border border-border bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground">Source 커버리지</p>
                        <span className="text-[10px] text-muted-foreground">{selectedTraceSourceCoverage.length} sources</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedTraceSourceCoverage.map((source) => (
                          <div
                            key={source.sourceId}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-foreground">{source.sourceLabel}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {source.eventCount} events
                                {source.issueCount > 0 ? ` · issue ${source.issueCount}` : ""}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 rounded-full border-primary bg-background px-3 text-[10px] font-bold text-primary"
                              onClick={() => onApplySourceFilter(source.sourceId)}
                            >
                              이 소스
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. 추출된 필드 데이터 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">추출된 데이터</p>
                  <span className="text-[10px] text-muted-foreground">{visibleFieldEntries.length} items</span>
                </div>
                {hiddenSelectedFieldKeys.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {hiddenSelectedFieldKeys.map((fieldKey) => (
                      <button
                        key={fieldKey}
                        type="button"
                        onClick={() => onToggleFieldVisibility(fieldKey)}
                        className="rounded-full border border-dashed border-border bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground transition hover:border-primary hover:bg-accent hover:text-foreground"
                      >
                        {fieldKey} 다시 표시
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid gap-2">
                  {visibleFieldEntries.length > 0 ? visibleFieldEntries.slice(0, 20).map(([key, value]) => (
                    <div key={key} className="group relative rounded-xl border border-border bg-muted p-3 transition-colors hover:bg-background">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10px] font-bold text-muted-foreground">{key}</span>
                        <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => onAddFieldFilter(key, value, "include")} className="rounded-full border border-primary bg-background px-2.5 py-0.5 text-[10px] font-bold text-primary shadow-sm transition-colors hover:bg-accent">포함</button>
                          <button onClick={() => onAddFieldFilter(key, value, "exclude")} className="rounded-full border border-amber-200/50 bg-background px-2.5 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm transition-colors hover:bg-amber-50">제외</button>
                        </div>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-foreground">{value}</p>
                    </div>
                  )) : (
                    <p className="text-center text-xs text-muted-foreground py-4">추출된 필드가 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 5. 관련 이벤트 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">관련 이벤트</p>
                  <span className="text-[10px] text-muted-foreground">{relatedEvents.length} items</span>
                </div>
                <div className="space-y-2">
                  {relatedEvents.length > 0 ? relatedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event.id)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition-colors",
                        event.id === selectedEvent.id ? "border-primary bg-accent" : "border-border bg-card hover:border-primary hover:bg-background",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-foreground">{event.service ?? "(서비스 미지정)"}</p>
                        <span className="text-[10px] text-muted-foreground">{formatTimestamp(event.timestampMs)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {event.message}
                      </p>
                    </button>
                  )) : (
                    <p className="text-center text-xs text-muted-foreground py-4">연관 이벤트가 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 6. 원문 데이터 */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">로그 원문 (Raw)</p>
                <div className="rounded-2xl bg-muted p-4">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {selectedEvent.rawLine}
                  </pre>
                </div>
              </div>

            </>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                분석할 로그를 선택하세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
