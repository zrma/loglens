import { AlertTriangle, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LogLevel, TraceGroup } from "@/lib/logs/types";
import type { FacetCount } from "@/lib/logs/analysis";
import { LEVEL_LABELS, formatTraceLabel } from "@/features/log-explorer/presentation";

type SidebarSectionProps = {
  hasSession: boolean;
  searchTerm: string;
  levelFilter: LogLevel | "all";
  serviceFilter: string | "all";
  traceFilter: string | "all";
  requestFilter: string | "all";
  issuesOnly: boolean;
  serviceOptions: FacetCount[];
  traceOptions: string[];
  requestOptions: FacetCount[];
  topTraceGroups: TraceGroup[];
  onSearchTermChange: (value: string) => void;
  onLevelFilterChange: (value: LogLevel | "all") => void;
  onServiceFilterChange: (value: string | "all") => void;
  onTraceFilterChange: (value: string | "all") => void;
  onRequestFilterChange: (value: string | "all") => void;
  onIssuesOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
  onSelectTraceGroup: (group: TraceGroup) => void;
};

export function SidebarSection({
  hasSession,
  searchTerm,
  levelFilter,
  serviceFilter,
  traceFilter,
  requestFilter,
  issuesOnly,
  serviceOptions,
  traceOptions,
  requestOptions,
  topTraceGroups,
  onSearchTermChange,
  onLevelFilterChange,
  onServiceFilterChange,
  onTraceFilterChange,
  onRequestFilterChange,
  onIssuesOnlyChange,
  onResetFilters,
  onSelectTraceGroup,
}: SidebarSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">탐색 필터</CardTitle>
          <CardDescription className="leading-6">
            검색어, level, service, trace, request, issue 토글을 함께 조합해 사건 범위를 좁힙니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="message, request id, trace id, service명으로 검색"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              disabled={!hasSession}
              className="h-12 rounded-2xl border-white/60 bg-white/85 pl-10 shadow-none"
            />
          </div>

          <div className="grid gap-3">
            <Select value={levelFilter} onValueChange={(value) => onLevelFilterChange(value as LogLevel | "all")} disabled={!hasSession}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 level</SelectItem>
                {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={onServiceFilterChange} disabled={!hasSession}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 service</SelectItem>
                {serviceOptions.map(({ label, count }) => (
                  <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={traceFilter} onValueChange={onTraceFilterChange} disabled={!hasSession}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="Trace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 trace</SelectItem>
                {traceOptions.map((traceId) => (
                  <SelectItem key={traceId} value={traceId}>{formatTraceLabel(traceId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={requestFilter} onValueChange={onRequestFilterChange} disabled={!hasSession}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="Request" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 request</SelectItem>
                {requestOptions.map(({ label, count }) => (
                  <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button
              variant="outline"
              className={cn(
                "h-11 rounded-2xl border-white/60 bg-white/85",
                issuesOnly && "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
              )}
              onClick={() => onIssuesOnlyChange(!issuesOnly)}
              disabled={!hasSession}
            >
              <AlertTriangle className="size-4" />
              {issuesOnly ? "문제 이벤트만" : "모든 이벤트"}
            </Button>
            <Button
              variant="ghost"
              className="h-11 rounded-2xl"
              onClick={onResetFilters}
              disabled={!hasSession}
            >
              <Filter className="size-4" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Trace Radar</CardTitle>
          <CardDescription className="leading-6">
            issue가 많거나 이벤트 수가 많은 trace를 우선 보여줍니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topTraceGroups.length > 0 ? topTraceGroups.map((group) => (
            <button
              key={group.traceId}
              type="button"
              onClick={() => onSelectTraceGroup(group)}
              className={cn(
                "w-full rounded-3xl border p-4 text-left transition-all",
                traceFilter === group.traceId
                  ? "border-primary/30 bg-primary/10 shadow-[0_20px_40px_-32px_rgba(8,145,178,0.5)]"
                  : "border-border/70 bg-white/80 hover:border-primary/20 hover:bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium tracking-[-0.02em] text-foreground">{formatTraceLabel(group.traceId)}</p>
                <span className="text-xs text-muted-foreground">{group.eventCount} events</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.services.slice(0, 2).map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                  >
                    {service}
                  </span>
                ))}
                {group.requestIds[0] && (
                  <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {group.requestIds[0]}
                  </span>
                )}
                {group.issueCount > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                    issue {group.issueCount}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                span {group.spanCount} · request {group.requestIds.length || 0}
              </p>
            </button>
          )) : (
            <p className="text-sm leading-6 text-muted-foreground">
              traceId가 포함된 이벤트가 아직 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
