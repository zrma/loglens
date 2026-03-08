import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatTimestamp } from "@/lib/logs/analysis";
import type {
  DerivedFlowGroup,
  FieldFilter,
  LogEvent,
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

function flattenSpanNodes(nodes: SpanNode[]): SpanNode[] {
  return nodes.flatMap((node) => [node, ...flattenSpanNodes(node.children)]);
}

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
        className="w-full rounded-3xl border border-border/70 bg-white/90 p-4 text-left transition hover:border-primary/20 hover:bg-primary/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium tracking-[-0.02em] text-foreground">{node.service ?? "미지정 서비스"}</span>
              <span className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
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
            <div className="relative h-2 rounded-full bg-white/70">
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
  const timelineNodes = spanForest ? flattenSpanNodes(spanForest.roots) : [];

  return (
    <div className="min-w-0 grid gap-6 min-[1820px]:grid-cols-[minmax(0,1.28fr)_340px]">
      <Card className="min-w-0 overflow-hidden border-white/60 bg-white/78 shadow-none">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-2xl tracking-[-0.04em]">이벤트 스트림</CardTitle>
                <CardDescription className="pt-2 leading-6">
                  필터 결과 {filteredEvents.length.toLocaleString()}개 이벤트
                </CardDescription>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                <span className="max-w-full truncate rounded-full border border-border/80 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground">
                  source: {sessionTitle}
                </span>
                {traceFilter !== "all" && (
                  <span className="max-w-full truncate rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
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
                        : "border-primary/20 bg-primary/10 text-primary hover:border-primary/30 hover:bg-primary/15",
                    )}
                  >
                    {filter.key} {filter.operator === "exclude" ? "!=" : "="} {filter.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
            <div className="flex h-[620px] items-center justify-center p-10">
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

      <Card className="min-w-0 overflow-hidden border-white/60 bg-white/78 shadow-none min-[1820px]:sticky min-[1820px]:top-6 min-[1820px]:h-[calc(100vh-7rem)] min-[1820px]:self-start">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-2xl tracking-[-0.04em]">상세 이벤트</CardTitle>
          <CardDescription className="pt-2 leading-6">
            선택 이벤트와 관련 컨텍스트를 보여줍니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 min-[1820px]:min-h-0 min-[1820px]:flex-1 min-[1820px]:overflow-y-auto">
          {selectedEvent ? (
            <>
              <div className="min-w-0 rounded-[28px] bg-slate-950 px-4 py-4 text-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected Event</p>
                    <p className="mt-2 break-all text-lg font-semibold tracking-[-0.03em]">
                      {selectedEvent.service ?? "미지정 서비스"}
                    </p>
                  </div>
                  <LevelBadge level={selectedEvent.level} />
                </div>
                <p className="mt-4 font-mono text-sm leading-6 text-slate-200 break-all [overflow-wrap:anywhere]">
                  {selectedEvent.message}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {showSourceContext && (
                  <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                    <p className="text-sm text-muted-foreground">source</p>
                    <p className="mt-2 break-all text-sm font-medium text-foreground">
                      {selectedEvent.sourceLabel}
                    </p>
                  </div>
                )}
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <p className="text-sm text-muted-foreground">trace</p>
                  <p className="mt-2 break-all text-sm font-medium text-foreground">
                    {selectedEvent.traceId ?? "없음"}
                  </p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <p className="text-sm text-muted-foreground">span</p>
                  <p className="mt-2 break-all text-sm font-medium text-foreground">
                    {selectedEvent.spanId ?? "없음"}
                  </p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <p className="text-sm text-muted-foreground">request</p>
                  <p className="mt-2 break-all text-sm font-medium text-foreground">
                    {selectedEvent.requestId ?? "없음"}
                  </p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <p className="text-sm text-muted-foreground">라인 범위</p>
                  <p className="mt-2 break-all text-sm font-medium text-foreground">
                    {selectedEvent.lineNumber}
                    {selectedEvent.endLineNumber > selectedEvent.lineNumber ? `-${selectedEvent.endLineNumber}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {showSourceContext && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onApplySourceFilter(selectedEvent.sourceId)}
                  >
                    이 source만 보기
                  </Button>
                )}
                {selectedEvent.traceId && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onApplyTraceFilter(selectedEvent.traceId ?? "all")}
                  >
                    이 trace만 보기
                  </Button>
                )}
                {selectedEvent.service && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onApplyServiceFilter(selectedEvent.service ?? "all")}
                  >
                    이 service만 보기
                  </Button>
                )}
                {selectedEvent.requestId && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onApplyRequestFilter(selectedEvent.requestId ?? "all")}
                  >
                    이 request만 보기
                  </Button>
                )}
                {selectedDerivedFlowGroup && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      const nextEventId = selectedDerivedFlowGroup.eventIds[0];

                      if (nextEventId) {
                        onSelectEvent(nextEventId);
                      }
                    }}
                  >
                    이 flow로 이동
                  </Button>
                )}
              </div>

              {selectedDerivedFlowGroup && (
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium tracking-[-0.02em] text-foreground">Derived Flow</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        route와 resource/request 단서로 묶은 흐름입니다.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedDerivedFlowGroup.eventCount} events
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-white p-3">
                      <p className="text-sm text-muted-foreground">family</p>
                      <p className="mt-2 break-all text-sm font-medium text-foreground">
                        {selectedDerivedFlowGroup.family}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white p-3">
                      <p className="text-sm text-muted-foreground">correlation</p>
                      <p className="mt-2 break-all text-sm font-medium text-foreground">
                        {selectedDerivedFlowGroup.correlationKind} {selectedDerivedFlowGroup.correlationValue}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDerivedFlowGroup.methods.map((method) => (
                      <span
                        key={`${selectedDerivedFlowGroup.flowKey}-${method}`}
                        className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                      >
                        {method}
                      </span>
                    ))}
                    {selectedDerivedFlowGroup.routes.map((route) => (
                      <span
                        key={`${selectedDerivedFlowGroup.flowKey}-${route}`}
                        className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      >
                        {route}
                      </span>
                    ))}
                    {selectedDerivedFlowGroup.resourceId && (
                      <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        resource {selectedDerivedFlowGroup.resourceId}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {showSourceContext && selectedTraceSourceCoverage.length > 0 && (
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium tracking-[-0.02em] text-foreground">Source Coverage</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        선택한 trace의 파일별 분포입니다.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedTraceSourceCoverage.length} sources
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedTraceSourceCoverage.map((source) => (
                      <div
                        key={`${source.sourceId}-${selectedEvent.traceId ?? "none"}`}
                        className="rounded-3xl border border-border/70 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-all text-sm font-medium text-foreground">{source.sourceLabel}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{source.eventCount} events</span>
                              <span>{source.services.length} services</span>
                              {source.issueCount > 0 && <span>issue {source.issueCount}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => onApplySourceFilter(source.sourceId)}
                          >
                            이 source
                          </Button>
                        </div>
                        {source.services.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {source.services.slice(0, 4).map((service) => (
                              <span
                                key={`${source.sourceId}-${service}`}
                                className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {spanForest && (
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium tracking-[-0.02em] text-foreground">Span Topology</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        trace span 트리입니다.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {spanForest.totalSpans} spans · depth {spanForest.maxDepth + 1}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {spanForest.roots.map((root) => (
                      <SpanTopologyNode
                        key={root.spanId}
                        node={root}
                        selectedTraceGroup={selectedTraceGroup}
                        onSelectEvent={onSelectEvent}
                      />
                    ))}
                  </div>

                  {spanForest.orphanEvents.length > 0 && (
                    <div className="mt-4 rounded-3xl border border-dashed border-border/70 bg-white p-4">
                      <p className="font-medium tracking-[-0.02em] text-foreground">Span 미지정 이벤트</p>
                      <div className="mt-3 space-y-2">
                        {spanForest.orphanEvents.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => onSelectEvent(event.id)}
                            className="block w-full rounded-2xl border border-border/70 bg-secondary/40 px-3 py-3 text-left text-sm leading-6 text-muted-foreground break-all [overflow-wrap:anywhere]"
                          >
                            {event.service ?? "미지정"} · {event.message}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {spanForest && selectedTraceGroup && (
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium tracking-[-0.02em] text-foreground">Span Timeline</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        trace 기준 상대 시간입니다.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(selectedTraceGroup.startMs, selectedTraceGroup.endMs)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-3xl border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,248,247,0.95))] p-4">
                    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <span>Span</span>
                      <div className="flex items-center justify-between">
                        <span>{formatTimestamp(selectedTraceGroup.startMs)}</span>
                        <span>{formatTimestamp(selectedTraceGroup.endMs)}</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {timelineNodes.map((node) => {
                        const barStyle = buildSpanBarStyle(node, selectedTraceGroup);

                        return (
                          <button
                            key={`timeline-${node.spanId}`}
                            type="button"
                            onClick={() => {
                              const nextEventId = node.eventIds[0];

                              if (nextEventId) {
                                onSelectEvent(nextEventId);
                              }
                            }}
                            className="grid w-full grid-cols-[132px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left transition hover:border-primary/20 hover:bg-primary/5"
                          >
                            <div className="min-w-0" style={{ paddingLeft: `${Math.min(node.depth, 6) * 12}px` }}>
                              <p className="truncate text-sm font-medium text-foreground">{node.service ?? node.spanId}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{node.spanId}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="relative h-7 overflow-hidden rounded-full bg-secondary/75">
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:12.5%_100%]" />
                                {barStyle && (
                                  <div
                                    className={cn(
                                      "absolute top-1/2 h-4 -translate-y-1/2 rounded-full px-2 text-[10px] font-semibold leading-4 text-white",
                                      node.issueCount > 0
                                        ? "bg-[color:var(--chart-4)]"
                                        : "bg-[color:var(--chart-3)]",
                                    )}
                                    style={barStyle}
                                  >
                                    <span className="truncate">{node.label}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span>{node.eventCount} events</span>
                                <span>{formatDuration(node.startMs, node.endMs)}</span>
                                {node.requestIds[0] && <span>{node.requestIds[0]}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium tracking-[-0.02em] text-foreground">
                    {selectedEvent.traceId ? "관련 trace 흐름" : selectedDerivedFlowGroup ? "관련 flow 이벤트" : "주변 이벤트"}
                  </p>
                  {selectedTraceGroup && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTraceGroup.eventCount} events · {formatDuration(selectedTraceGroup.startMs, selectedTraceGroup.endMs)}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {relatedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event.id)}
                      className={cn(
                        "w-full rounded-3xl border p-3 text-left transition-all",
                        event.id === selectedEvent.id
                          ? "border-primary/30 bg-primary/10"
                          : "border-border/70 bg-white hover:border-primary/20 hover:bg-primary/5",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{formatTimestamp(event.timestampMs)}</span>
                        <LevelBadge level={event.level} />
                      </div>
                      <p className="mt-2 break-all text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                        {event.service ?? "미지정"}
                      </p>
                      {showSourceContext && (
                        <p className="mt-1 break-all text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                          source {event.sourceLabel}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground break-all [overflow-wrap:anywhere]">
                        {event.message}
                      </p>
                      {(event.spanId || event.parentSpanId) && (
                        <p className="mt-2 break-all text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                          span {event.spanId ?? "없음"} / parent {event.parentSpanId ?? "없음"}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <p className="font-medium tracking-[-0.02em] text-foreground">Parser Notes</p>
                <div className="mt-4 space-y-3">
                  {selectedEvent.parseIssues.length > 0 ? selectedEvent.parseIssues.map((issue) => (
                    <div
                      key={`${selectedEvent.id}-${issue.kind}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800"
                    >
                      {issue.message}
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">추가 메모가 없습니다.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium tracking-[-0.02em] text-foreground">추출된 필드</p>
                  <span className="text-xs text-muted-foreground">
                    {visibleFieldEntries.length} visible
                    {hiddenSelectedFieldKeys.length > 0 ? ` · ${hiddenSelectedFieldKeys.length} hidden` : ""}
                  </span>
                </div>
                {hiddenSelectedFieldKeys.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hiddenSelectedFieldKeys.map((fieldKey) => (
                      <button
                        key={fieldKey}
                        type="button"
                        onClick={() => onToggleFieldVisibility(fieldKey)}
                        className="rounded-full border border-dashed border-border/70 bg-white px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                      >
                        {fieldKey} 다시 표시
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-3">
                  {visibleFieldEntries.length > 0 ? visibleFieldEntries.slice(0, 16).map(([key, value]) => (
                    <div key={key} className="grid gap-2 rounded-2xl border border-border/60 bg-white/70 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-muted-foreground">{key}</span>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-3 text-xs"
                            onClick={() => onAddFieldFilter(key, value, "include")}
                          >
                            포함
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-3 text-xs text-amber-700 hover:text-amber-800"
                            onClick={() => onAddFieldFilter(key, value, "exclude")}
                          >
                            제외
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-3 text-xs"
                            onClick={() => onToggleFieldVisibility(key)}
                          >
                            숨김
                          </Button>
                        </div>
                      </div>
                      <span className="break-all font-mono text-foreground">{value}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">
                      현재 표시 중인 필드가 없습니다. Field Lens에서 숨김을 복원해 보세요.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <p className="font-medium tracking-[-0.02em] text-foreground">Raw Block</p>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                  {selectedEvent.rawLine}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-border/80 bg-white/70 p-5">
              <p className="text-sm leading-7 text-muted-foreground">
                이벤트를 선택하면 세부 정보가 여기에 표시됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
