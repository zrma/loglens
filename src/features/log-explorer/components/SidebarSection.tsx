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
import type { FacetCount } from "@/lib/logs/analysis";
import type { FieldFilter, LogLevel, TraceGroup } from "@/lib/logs/types";
import { LEVEL_LABELS, formatTraceLabel } from "@/features/log-explorer/presentation";

type SidebarSectionProps = {
  hasSession: boolean;
  searchTerm: string;
  levelFilter: LogLevel | "all";
  sourceFilter: string | "all";
  serviceFilter: string | "all";
  traceFilter: string | "all";
  requestFilter: string | "all";
  fieldFilters: FieldFilter[];
  facetFieldKey: string | "all";
  issuesOnly: boolean;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  serviceOptions: FacetCount[];
  traceOptions: string[];
  requestOptions: FacetCount[];
  fieldKeyOptions: FacetCount[];
  fieldValueOptions: FacetCount[];
  fieldFacetKeys: FacetCount[];
  fieldLensKeys: FacetCount[];
  hiddenFieldKeys: string[];
  topTraceGroups: TraceGroup[];
  onSearchTermChange: (value: string) => void;
  onLevelFilterChange: (value: LogLevel | "all") => void;
  onSourceFilterChange: (value: string | "all") => void;
  onServiceFilterChange: (value: string | "all") => void;
  onTraceFilterChange: (value: string | "all") => void;
  onRequestFilterChange: (value: string | "all") => void;
  onFacetFieldKeyChange: (value: string | "all") => void;
  onIssuesOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
  onAddFieldFilter: (fieldKey: string, fieldValue: string, operator?: FieldFilter["operator"]) => void;
  onRemoveFieldFilter: (fieldKey: string) => void;
  onClearFieldFilters: () => void;
  onToggleFieldVisibility: (fieldKey: string) => void;
  onHideAllFieldVisibility: () => void;
  onResetFieldVisibility: () => void;
  onSelectTraceGroup: (group: TraceGroup) => void;
};

export function SidebarSection({
  hasSession,
  searchTerm,
  levelFilter,
  sourceFilter,
  serviceFilter,
  traceFilter,
  requestFilter,
  fieldFilters,
  facetFieldKey,
  issuesOnly,
  sourceOptions,
  serviceOptions,
  traceOptions,
  requestOptions,
  fieldKeyOptions,
  fieldValueOptions,
  fieldFacetKeys,
  fieldLensKeys,
  hiddenFieldKeys,
  topTraceGroups,
  onSearchTermChange,
  onLevelFilterChange,
  onSourceFilterChange,
  onServiceFilterChange,
  onTraceFilterChange,
  onRequestFilterChange,
  onFacetFieldKeyChange,
  onIssuesOnlyChange,
  onResetFilters,
  onAddFieldFilter,
  onRemoveFieldFilter,
  onClearFieldFilters,
  onToggleFieldVisibility,
  onHideAllFieldVisibility,
  onResetFieldVisibility,
  onSelectTraceGroup,
}: SidebarSectionProps) {
  const activeFacetFilter = fieldFilters.find((filter) => filter.key === facetFieldKey) ?? null;
  const previewFieldValues = fieldValueOptions.slice(0, 12);
  const remainingFieldValueCount = Math.max(fieldValueOptions.length - previewFieldValues.length, 0);

  return (
    <div className="space-y-6">
      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">탐색 필터</CardTitle>
          <CardDescription className="leading-6">
            검색과 핵심 필터로 범위를 좁힙니다.
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

            <Select value={sourceFilter} onValueChange={onSourceFilterChange} disabled={!hasSession || sourceOptions.length === 0}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 source</SelectItem>
                {sourceOptions.map(({ value, label, count }) => (
                  <SelectItem key={value} value={value}>{label} ({count})</SelectItem>
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl tracking-[-0.03em]">Field Facets</CardTitle>
              <CardDescription className="pt-1 leading-6">
                필드 값 기준으로 조건을 누적합니다.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={onClearFieldFilters}
              disabled={!hasSession || fieldFilters.length === 0}
            >
              조건 해제
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fieldFilters.map((filter) => (
                <button
                  key={`${filter.key}:${filter.operator}:${filter.value}`}
                  type="button"
                  onClick={() => onRemoveFieldFilter(filter.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    filter.operator === "exclude"
                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                      : "border-primary/20 bg-primary/10 text-primary hover:border-primary/30 hover:bg-primary/15",
                  )}
                >
                  {filter.key} {filter.operator === "exclude" ? "!=" : "="} {filter.value} 닫기
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              활성 필드 조건이 없습니다.
            </p>
          )}

          <Select value={facetFieldKey} onValueChange={onFacetFieldKeyChange} disabled={!hasSession || fieldKeyOptions.length === 0}>
            <SelectTrigger className="h-11 w-full rounded-2xl border-white/60 bg-white/85">
              <SelectValue placeholder="facet key 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">facet key 선택</SelectItem>
              {fieldKeyOptions.map(({ label, count }) => (
                <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {fieldFacetKeys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fieldFacetKeys.map(({ label, count }) => {
                const isActive = facetFieldKey === label;

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onFacetFieldKeyChange(label)}
                    disabled={!hasSession}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/70 bg-white/70 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground",
                    )}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {facetFieldKey !== "all" ? (
            previewFieldValues.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {previewFieldValues.map(({ label, count }) => {
                    const isActive = activeFacetFilter?.value === label;
                    const isExcluded = isActive && activeFacetFilter?.operator === "exclude";

                    return (
                      <div
                        key={`${facetFieldKey}:${label}`}
                        className={cn(
                          "rounded-2xl border px-3 py-3",
                          isActive
                            ? isExcluded
                              ? "border-amber-200 bg-amber-50"
                              : "border-primary/30 bg-primary/10"
                            : "border-border/70 bg-white/80",
                        )}
                      >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block break-all text-xs font-medium text-foreground [overflow-wrap:anywhere]">{label}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">{count} events</span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => onAddFieldFilter(facetFieldKey, label, "include")}
                          disabled={!hasSession}
                        >
                          포함
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs text-amber-700 hover:text-amber-800"
                          onClick={() => onAddFieldFilter(facetFieldKey, label, "exclude")}
                          disabled={!hasSession}
                        >
                          제외
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  같은 key는 마지막 선택으로 교체됩니다.
                  {remainingFieldValueCount > 0 ? ` 상위 ${previewFieldValues.length}개만 표시 중입니다.` : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                현재 범위에 남아 있는 값이 없습니다.
              </p>
            )
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              key를 고르면 value facet이 열립니다.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl tracking-[-0.03em]">Field Lens</CardTitle>
              <CardDescription className="pt-1 leading-6">
                상세 패널에 보일 필드를 조절합니다.
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
                현재 범위 기준 상위 key만 표시합니다. 숨김 {hiddenFieldKeys.length}개
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              구조화 필드가 추출되면 여기서 토글할 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Trace Radar</CardTitle>
          <CardDescription className="leading-6">
            이벤트 수나 이슈가 큰 trace를 먼저 보여줍니다.
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
                {group.sources.slice(0, 2).map((source) => (
                  <span
                    key={`${group.traceId}-${source}`}
                    className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {source}
                  </span>
                ))}
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
              trace id가 추출되면 상위 trace가 이곳에 나타납니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
