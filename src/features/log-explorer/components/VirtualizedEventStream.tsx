import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEvent } from "@/lib/logs/types";
import { formatTimestamp } from "@/lib/logs/analysis";
import { cn } from "@/lib/utils";
import { LevelBadge, formatTraceLabel, highlightText } from "@/features/log-explorer/presentation";
import {
  getEventStreamGridTemplate,
  getEventStreamMinWidth,
  type EventStreamColumn,
} from "@/features/log-explorer/event-stream-columns";

type VirtualizedEventStreamProps = {
  columns: EventStreamColumn[];
  events: LogEvent[];
  searchTerm: string;
  selectedEventId: string | null;
  showSourceContext: boolean;
  onSelectEvent: (eventId: string) => void;
};

const EVENT_ROW_HEIGHT = 152;
const EVENT_HEADER_HEIGHT = 44;
const OVERSCAN = 6;

export function VirtualizedEventStream({
  columns,
  events,
  searchTerm,
  selectedEventId,
  showSourceContext,
  onSelectEvent,
}: VirtualizedEventStreamProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);
  const [viewportWidth, setViewportWidth] = useState(0);
  const gridTemplateColumns = useMemo(() => getEventStreamGridTemplate(columns), [columns]);
  const gridMinWidth = useMemo(() => getEventStreamMinWidth(columns), [columns]);
  const contentWidth = Math.max(gridMinWidth, viewportWidth);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(viewport.clientHeight);
      setViewportWidth(viewport.clientWidth);
    };

    updateViewportHeight();

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const selectedIndex = events.findIndex((event) => event.id === selectedEventId);

    if (selectedIndex === -1) {
      return;
    }

    const top = EVENT_HEADER_HEIGHT + (selectedIndex * EVENT_ROW_HEIGHT);
    const bottom = top + EVENT_ROW_HEIGHT;

    if (top < viewport.scrollTop) {
      viewport.scrollTop = top;
      return;
    }

    const viewportBottom = viewport.scrollTop + viewport.clientHeight;

    if (bottom > viewportBottom) {
      viewport.scrollTop = bottom - viewport.clientHeight;
    }
  }, [events, selectedEventId]);

  const rowScrollTop = Math.max(scrollTop - EVENT_HEADER_HEIGHT, 0);
  const rowViewportHeight = Math.max(viewportHeight - EVENT_HEADER_HEIGHT, 0);
  const startIndex = Math.max(Math.floor(rowScrollTop / EVENT_ROW_HEIGHT) - OVERSCAN, 0);
  const endIndex = Math.min(
    events.length,
    Math.ceil((rowScrollTop + rowViewportHeight) / EVENT_ROW_HEIGHT) + OVERSCAN,
  );
  const visibleEvents = events.slice(startIndex, endIndex);
  const totalHeight = Math.max((events.length * EVENT_ROW_HEIGHT) + EVENT_HEADER_HEIGHT, viewportHeight);

  function renderColumnCell(event: LogEvent, column: EventStreamColumn) {
    if (column.kind === "field") {
      const value = event.fields[column.fieldKey ?? ""] ?? "—";

      return (
        <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
          <span className="block truncate font-mono">{highlightText(value, searchTerm)}</span>
        </div>
      );
    }

    switch (column.id) {
      case "time":
        return (
          <div className="overflow-hidden px-4 py-3 font-mono text-xs text-muted-foreground">
            <div>{formatTimestamp(event.timestampMs)}</div>
            <div className="mt-1 text-[11px]">
              #{event.lineNumber}
              {event.endLineNumber > event.lineNumber ? `-${event.endLineNumber}` : ""}
            </div>
          </div>
        );
      case "level":
        return (
          <div className="overflow-hidden px-4 py-3">
            <LevelBadge level={event.level} />
          </div>
        );
      case "source":
        return (
          <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
            <span className="block truncate">{event.sourceLabel}</span>
          </div>
        );
      case "service":
        return (
          <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
            {event.service
              ? <span className="block truncate">{event.service}</span>
              : <span className="block truncate text-muted-foreground">미지정</span>}
          </div>
        );
      case "trace":
        return (
          <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
            <span className="block truncate font-mono">
              {event.traceId ? formatTraceLabel(event.traceId) : "—"}
            </span>
          </div>
        );
      case "request":
        return (
          <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
            <span className="block truncate font-mono">{event.requestId ?? "—"}</span>
          </div>
        );
      case "message":
      default:
        return (
          <div className="flex min-w-0 flex-col gap-2 overflow-hidden px-4 py-3">
            <p className="min-w-0 overflow-hidden font-mono text-[13px] leading-5 text-foreground break-all [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">
              {highlightText(event.message, searchTerm)}
            </p>
            <div className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
              {event.isMultiLine && (
                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  multiline
                </span>
              )}
              {!columns.some((nextColumn) => nextColumn.id === "trace") && event.traceId && (
                <span className="min-w-0 max-w-full truncate rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                  trace {formatTraceLabel(event.traceId)}
                </span>
              )}
              {!columns.some((nextColumn) => nextColumn.id === "request") && event.requestId && (
                <span className="min-w-0 max-w-full truncate rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  req {event.requestId}
                </span>
              )}
              {!columns.some((nextColumn) => nextColumn.id === "source") && showSourceContext && (
                <span className="min-w-0 max-w-full truncate rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  src {event.sourceLabel}
                </span>
              )}
            </div>
          </div>
        );
    }
  }

  return (
    <div
      ref={viewportRef}
      className="relative h-[640px] min-h-0 overflow-auto"
      role="listbox"
      aria-label="로그 이벤트 스트림"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: `${totalHeight}px`, width: `${contentWidth}px` }}>
        <div
          className="sticky top-0 z-10 grid border-b border-border/70 bg-white/95 text-xs uppercase tracking-[0.18em] text-muted-foreground"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column) => (
            <div key={column.id} className="px-4 py-3">{column.label}</div>
          ))}
        </div>

        <div className="relative" style={{ height: `${totalHeight - EVENT_HEADER_HEIGHT}px` }}>
          {visibleEvents.map((event, index) => {
            const absoluteIndex = startIndex + index;
            const top = EVENT_HEADER_HEIGHT + (absoluteIndex * EVENT_ROW_HEIGHT);

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event.id)}
                role="option"
                aria-selected={selectedEventId === event.id}
                className="absolute left-0 overflow-hidden border-b border-border/60 text-left"
                style={{ top: `${top}px`, height: `${EVENT_ROW_HEIGHT}px`, width: `${contentWidth}px` }}
              >
                <div
                  className={cn(
                    "grid h-full items-start overflow-hidden px-0 transition-colors hover:bg-primary/5",
                    selectedEventId === event.id ? "bg-primary/8" : "bg-white/70",
                  )}
                  style={{ gridTemplateColumns, width: `${contentWidth}px` }}
                >
                  {columns.map((column) => (
                    <div key={`${event.id}-${column.id}`} className="min-w-0">
                      {renderColumnCell(event, column)}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
