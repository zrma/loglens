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
  fieldKeyFilter: string | "all";
  fieldValueFilter: string | "all";
  issuesOnly: boolean;
  serviceOptions: FacetCount[];
  traceOptions: string[];
  requestOptions: FacetCount[];
  fieldKeyOptions: FacetCount[];
  fieldValueOptions: FacetCount[];
  fieldLensKeys: FacetCount[];
  hiddenFieldKeys: string[];
  topTraceGroups: TraceGroup[];
  onSearchTermChange: (value: string) => void;
  onLevelFilterChange: (value: LogLevel | "all") => void;
  onServiceFilterChange: (value: string | "all") => void;
  onTraceFilterChange: (value: string | "all") => void;
  onRequestFilterChange: (value: string | "all") => void;
  onFieldKeyFilterChange: (value: string | "all") => void;
  onFieldValueFilterChange: (value: string | "all") => void;
  onIssuesOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
  onToggleFieldVisibility: (fieldKey: string) => void;
  onHideAllFieldVisibility: () => void;
  onResetFieldVisibility: () => void;
  onSelectTraceGroup: (group: TraceGroup) => void;
};

export function SidebarSection({
  hasSession,
  searchTerm,
  levelFilter,
  serviceFilter,
  traceFilter,
  requestFilter,
  fieldKeyFilter,
  fieldValueFilter,
  issuesOnly,
  serviceOptions,
  traceOptions,
  requestOptions,
  fieldKeyOptions,
  fieldValueOptions,
  fieldLensKeys,
  hiddenFieldKeys,
  topTraceGroups,
  onSearchTermChange,
  onLevelFilterChange,
  onServiceFilterChange,
  onTraceFilterChange,
  onRequestFilterChange,
  onFieldKeyFilterChange,
  onFieldValueFilterChange,
  onIssuesOnlyChange,
  onResetFilters,
  onToggleFieldVisibility,
  onHideAllFieldVisibility,
  onResetFieldVisibility,
  onSelectTraceGroup,
}: SidebarSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">탐색 필터</CardTitle>
          <CardDescription className="leading-6">
            검색어, level, service, trace, request, 필드 필터를 함께 조합해 탐색 범위를 좁힙니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="메시지, request id, trace id, service명, 필드 값으로 검색"
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

            <Select value={fieldKeyFilter} onValueChange={onFieldKeyFilterChange} disabled={!hasSession}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="필드 키" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 필드 키</SelectItem>
                {fieldKeyOptions.map(({ label, count }) => (
                  <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={fieldValueFilter}
              onValueChange={onFieldValueFilterChange}
              disabled={!hasSession || fieldKeyFilter === "all"}
            >
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="필드 값" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 필드 값</SelectItem>
                {fieldValueOptions.map(({ label, count }) => (
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl tracking-[-0.03em]">Field Lens</CardTitle>
              <CardDescription className="pt-1 leading-6">
                자주 등장하는 structured field를 기준으로 표시 여부를 조절합니다.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={onHideAllFieldVisibility}
                disabled={!hasSession || fieldKeyOptions.length === 0 || hiddenFieldKeys.length >= fieldKeyOptions.length}
              >
                전부 숨김
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={onResetFieldVisibility}
                disabled={!hasSession || hiddenFieldKeys.length === 0}
              >
                표시 복원
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fieldLensKeys.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {fieldLensKeys.map(({ label, count }) => {
                  const isHidden = hiddenFieldKeys.includes(label);

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onToggleFieldVisibility(label)}
                      disabled={!hasSession}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        isHidden
                          ? "border-dashed border-border/70 bg-white/50 text-muted-foreground"
                          : "border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                추출된 필드 섹션에서 숨길 키를 고를 수 있습니다. 현재 숨김 {hiddenFieldKeys.length}개
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              structured field가 충분히 추출되면 여기서 필드별 표시 토글이 활성화됩니다.
            </p>
          )}
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
