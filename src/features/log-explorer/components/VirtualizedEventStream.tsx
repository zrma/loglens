import { useEffect, useRef, useState } from "react";
import type { LogEvent } from "@/lib/logs/types";
import { formatTimestamp } from "@/lib/logs/analysis";
import { cn } from "@/lib/utils";
import { LevelBadge, formatTraceLabel, highlightText } from "@/features/log-explorer/presentation";

type VirtualizedEventStreamProps = {
  events: LogEvent[];
  searchTerm: string;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
};

const EVENT_ROW_HEIGHT = 152;
const OVERSCAN = 6;
const EVENT_GRID_COLUMNS = "grid-cols-[96px_88px_112px_minmax(0,1fr)] xl:grid-cols-[120px_110px_140px_minmax(0,1fr)]";

export function VirtualizedEventStream({
  events,
  searchTerm,
  selectedEventId,
  onSelectEvent,
}: VirtualizedEventStreamProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(viewport.clientHeight);
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

    const top = selectedIndex * EVENT_ROW_HEIGHT;
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

  const startIndex = Math.max(Math.floor(scrollTop / EVENT_ROW_HEIGHT) - OVERSCAN, 0);
  const endIndex = Math.min(
    events.length,
    Math.ceil((scrollTop + viewportHeight) / EVENT_ROW_HEIGHT) + OVERSCAN,
  );
  const visibleEvents = events.slice(startIndex, endIndex);
  const totalHeight = Math.max(events.length * EVENT_ROW_HEIGHT, viewportHeight);

  return (
    <div className="flex h-[640px] min-h-0 flex-col">
      <div className={cn("grid shrink-0 border-b border-border/70 bg-white/95 text-xs uppercase tracking-[0.18em] text-muted-foreground", EVENT_GRID_COLUMNS)}>
        <div className="px-4 py-3">Time</div>
        <div className="px-4 py-3">Level</div>
        <div className="px-4 py-3">Service</div>
        <div className="px-4 py-3">Message</div>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-auto"
        role="listbox"
        aria-label="로그 이벤트 스트림"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {visibleEvents.map((event, index) => {
            const absoluteIndex = startIndex + index;
            const top = absoluteIndex * EVENT_ROW_HEIGHT;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event.id)}
                role="option"
                aria-selected={selectedEventId === event.id}
                className="absolute inset-x-0 overflow-hidden border-b border-border/60 text-left"
                style={{ top: `${top}px`, height: `${EVENT_ROW_HEIGHT}px` }}
              >
                <div
                  className={cn(
                    "grid h-full items-start overflow-hidden px-0 transition-colors hover:bg-primary/5",
                    EVENT_GRID_COLUMNS,
                    selectedEventId === event.id ? "bg-primary/8" : "bg-white/70",
                  )}
                >
                  <div className="overflow-hidden px-4 py-3 font-mono text-xs text-muted-foreground">
                    <div>{formatTimestamp(event.timestampMs)}</div>
                    <div className="mt-1 text-[11px]">
                      #{event.lineNumber}
                      {event.endLineNumber > event.lineNumber ? `-${event.endLineNumber}` : ""}
                    </div>
                  </div>

                  <div className="overflow-hidden px-4 py-3">
                    <LevelBadge level={event.level} />
                  </div>

                  <div className="min-w-0 overflow-hidden px-4 py-3 text-sm text-foreground">
                    {event.service
                      ? <span className="block truncate">{event.service}</span>
                      : <span className="block truncate text-muted-foreground">미지정</span>}
                  </div>

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
                      {event.traceId && (
                        <span className="min-w-0 max-w-full truncate rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                          trace {formatTraceLabel(event.traceId)}
                        </span>
                      )}
                      {event.requestId && (
                        <span className="min-w-0 max-w-full truncate rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          req {event.requestId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
