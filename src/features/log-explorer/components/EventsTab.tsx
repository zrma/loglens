import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, formatTimestamp } from "@/lib/logs/analysis";
import type { LogEvent, SpanForest, SpanNode, TraceGroup } from "@/lib/logs/types";
import { cn } from "@/lib/utils";
import { LevelBadge, formatTraceLabel, highlightText } from "@/features/log-explorer/presentation";

type EventsTabProps = {
  sessionTitle: string;
  filteredEvents: LogEvent[];
  searchTerm: string;
  traceFilter: string | "all";
  selectedEvent: LogEvent | null;
  selectedTraceGroup: TraceGroup | null;
  relatedEvents: LogEvent[];
  spanForest: SpanForest | null;
  onSelectEvent: (eventId: string) => void;
  onApplyTraceFilter: (traceId: string) => void;
  onApplyServiceFilter: (service: string) => void;
  onApplyRequestFilter: (requestId: string) => void;
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          const nextEventId = node.eventIds[0];

          if (nextEventId) {
            onSelectEvent(nextEventId);
          }
        }}
        className="w-full rounded-3xl border border-border/70 bg-white/90 p-4 text-left transition hover:border-primary/20 hover:bg-primary/5"
        style={{ marginLeft: `${node.depth * 18}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium tracking-[-0.02em] text-foreground">{node.service ?? "미지정 service"}</span>
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
  relatedEvents,
  spanForest,
  onSelectEvent,
  onApplyTraceFilter,
  onApplyServiceFilter,
  onApplyRequestFilter,
}: EventsTabProps) {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.04em]">이벤트 스트림</CardTitle>
              <CardDescription className="pt-2 leading-6">
                필터 적용 결과 {filteredEvents.length.toLocaleString()}개 이벤트를 표시합니다.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border/80 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground">
                source: {sessionTitle}
              </span>
              {traceFilter !== "all" && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  trace: {formatTraceLabel(traceFilter)}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[620px]">
            {filteredEvents.length > 0 ? (
              <Table className="table-fixed">
                <TableHeader className="bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                  <TableRow className="border-border/70 hover:bg-transparent">
                    <TableHead className="sticky top-0 z-10 w-[120px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Time
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 w-[110px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Level
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 w-[140px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Service
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Message
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      className={cn(
                        "cursor-pointer border-border/60 align-top hover:bg-primary/5",
                        selectedEvent?.id === event.id && "bg-primary/5",
                      )}
                      onClick={() => onSelectEvent(event.id)}
                    >
                      <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <div>{formatTimestamp(event.timestampMs)}</div>
                        <div className="mt-1 text-[11px]">
                          #{event.lineNumber}
                          {event.endLineNumber > event.lineNumber ? `-${event.endLineNumber}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <LevelBadge level={event.level} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-foreground">
                        {event.service ?? <span className="text-muted-foreground">미지정</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="space-y-2">
                          <p className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-all text-foreground">
                            {highlightText(event.message, searchTerm)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {event.isMultiLine && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                multiline
                              </span>
                            )}
                            {event.traceId && (
                              <span className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                                trace {formatTraceLabel(event.traceId)}
                              </span>
                            )}
                            {event.requestId && (
                              <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                req {event.requestId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-full items-center justify-center p-10">
                <div className="max-w-md text-center">
                  <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                    필터 조건에 맞는 이벤트가 없습니다
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    검색어를 넓히거나 trace/service/request 필터를 초기화해 보세요.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-2xl tracking-[-0.04em]">상세 이벤트</CardTitle>
          <CardDescription className="pt-2 leading-6">
            선택한 이벤트의 parse note와 span 관계를 빠르게 따라갈 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {selectedEvent ? (
            <>
              <div className="rounded-[28px] bg-slate-950 px-4 py-4 text-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected Event</p>
                    <p className="mt-2 break-all text-lg font-semibold tracking-[-0.03em]">
                      {selectedEvent.service ?? "미지정 서비스"}
                    </p>
                  </div>
                  <LevelBadge level={selectedEvent.level} />
                </div>
                <p className="mt-4 font-mono text-sm leading-6 text-slate-200">
                  {selectedEvent.message}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              {spanForest && (
                <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium tracking-[-0.02em] text-foreground">Span Topology</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        trace 내부 parent/child span 관계를 최소 트리 형태로 재구성합니다.
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
                            className="block w-full rounded-2xl border border-border/70 bg-secondary/40 px-3 py-3 text-left text-sm leading-6 text-muted-foreground"
                          >
                            {event.service ?? "미지정"} · {event.message}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium tracking-[-0.02em] text-foreground">
                    {selectedEvent.traceId ? "관련 trace 흐름" : "주변 이벤트"}
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
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {event.service ?? "미지정"}
                      </p>
                      <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
                        {event.message}
                      </p>
                      {(event.spanId || event.parentSpanId) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">이 이벤트에는 추가 parser note가 없습니다.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                <p className="font-medium tracking-[-0.02em] text-foreground">추출된 필드</p>
                <div className="mt-4 grid gap-3">
                  {Object.entries(selectedEvent.fields).slice(0, 12).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-sm">
                      <span className="font-mono text-muted-foreground">{key}</span>
                      <span className="break-all font-mono text-foreground">{value}</span>
                    </div>
                  ))}
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
                이벤트를 하나 선택하면 추출된 필드와 관련 trace 흐름을 여기서 보여줍니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
