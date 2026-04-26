import { AlertTriangle, Filter, Layers, Network, Search, Settings2 } from "lucide-react";
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
import type { DerivedFlowGroupPreview, FieldFilter, LogLevel, TraceGroupPreview } from "@/lib/logs/types";
import {
  EVENT_STREAM_BUILTIN_COLUMNS,
  type EventStreamBuiltinColumnId,
} from "@/features/log-explorer/event-stream-columns";
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
  eventStreamBuiltinColumns: EventStreamBuiltinColumnId[];
  pinnedEventFieldColumns: string[];
  eventColumnFieldOptions: FacetCount[];
  topDerivedFlowGroups: DerivedFlowGroupPreview[];
  topTraceGroups: TraceGroupPreview[];
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
  onToggleBuiltinEventColumn: (columnId: EventStreamBuiltinColumnId) => void;
  onToggleEventFieldColumn: (fieldKey: string) => void;
  onResetEventColumns: () => void;
  onSelectDerivedFlowGroup: (group: DerivedFlowGroupPreview) => void;
  onSelectTraceGroup: (group: TraceGroupPreview) => void;
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
  eventStreamBuiltinColumns,
  pinnedEventFieldColumns,
  eventColumnFieldOptions,
  topDerivedFlowGroups,
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
  onToggleBuiltinEventColumn,
  onToggleEventFieldColumn,
  onResetEventColumns,
  onSelectDerivedFlowGroup,
  onSelectTraceGroup,
}: SidebarSectionProps) {
  const activeFacetFilter = fieldFilters.find((filter) => filter.key === facetFieldKey) ?? null;
  const previewFieldValues = fieldValueOptions.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* 1. 검색 및 기본 필터 */}
      <Card className="border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
              <Search className="size-4 text-primary" />
              검색 및 조건 필터
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border bg-muted px-3 text-[11px] font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-background hover:text-foreground"
              onClick={onResetFilters}
              disabled={!hasSession}
            >
              <Filter className="mr-1.5 size-3.5" />
              초기화
            </Button>
          </div>
          <CardDescription className="text-xs leading-6">
            검색어와 주요 속성을 조합하여 로그를 좁혀보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="로그 검색"
              placeholder="메시지, ID, 서비스명 검색..."
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              disabled={!hasSession}
              className="h-12 rounded-2xl border-border bg-background pl-10 shadow-none focus-visible:ring-primary"
            />
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={levelFilter} onValueChange={(value) => onLevelFilterChange(value as LogLevel | "all")} disabled={!hasSession}>
                <SelectTrigger aria-label="로그 레벨 필터" className="h-11 rounded-2xl border-border bg-background">
                  <SelectValue placeholder="로그 레벨" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 레벨</SelectItem>
                  {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className={cn(
                  "h-11 rounded-2xl border-border bg-background font-medium",
                  issuesOnly && "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 hover:text-red-800",
                )}
                onClick={() => onIssuesOnlyChange(!issuesOnly)}
                disabled={!hasSession}
              >
                <AlertTriangle className="mr-1.5 size-4" />
                {issuesOnly ? "이슈만" : "모든 로그"}
              </Button>
            </div>

            <Select value={sourceFilter} onValueChange={onSourceFilterChange} disabled={!hasSession || sourceOptions.length === 0}>
              <SelectTrigger aria-label="소스 필터" className="h-11 w-full rounded-2xl border-border bg-background">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-muted-foreground">Source:</span>
                  <SelectValue placeholder="선택" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 소스</SelectItem>
                {sourceOptions.map(({ value, label, count }) => (
                  <SelectItem key={value} value={value}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={onServiceFilterChange} disabled={!hasSession}>
              <SelectTrigger aria-label="서비스 필터" className="h-11 w-full rounded-2xl border-border bg-background">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-muted-foreground">Service:</span>
                  <SelectValue placeholder="선택" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 서비스</SelectItem>
                {serviceOptions.map(({ label, count }) => (
                  <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={traceFilter} onValueChange={onTraceFilterChange} disabled={!hasSession}>
              <SelectTrigger aria-label="트레이스 필터" className="h-11 w-full rounded-2xl border-border bg-background">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-muted-foreground">Trace:</span>
                  <SelectValue placeholder="선택" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 트레이스</SelectItem>
                {traceOptions.map((traceId) => (
                  <SelectItem key={traceId} value={traceId}>{formatTraceLabel(traceId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={requestFilter} onValueChange={onRequestFilterChange} disabled={!hasSession}>
              <SelectTrigger aria-label="요청 필터" className="h-11 w-full rounded-2xl border-border bg-background">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-muted-foreground">Request:</span>
                  <SelectValue placeholder="선택" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 요청</SelectItem>
                {requestOptions.map(({ label, count }) => (
                  <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 2. 필드 값 필터 (Facets) */}
      <Card className="border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
              <Layers className="size-4 text-[color:var(--chart-1)]" />
              데이터 패싯
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border bg-muted px-3 text-[11px] font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-background hover:text-foreground"
              onClick={onClearFieldFilters}
              disabled={!hasSession || fieldFilters.length === 0}
            >
              조건 초기화
            </Button>
          </div>
          <CardDescription className="text-xs leading-6">
            추출된 필드의 고유값을 기준으로 정밀하게 필터링합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={facetFieldKey} onValueChange={onFacetFieldKeyChange} disabled={!hasSession || fieldKeyOptions.length === 0}>
            <SelectTrigger aria-label="필드 패싯 선택" className="h-11 w-full rounded-2xl border-border bg-background">
              <SelectValue placeholder="필드 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">필드 선택</SelectItem>
              {fieldKeyOptions.map(({ label, count }) => (
                <SelectItem key={label} value={label}>{label} ({count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {facetFieldKey !== "all" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {previewFieldValues.map(({ label, count }) => {
                  const isActive = activeFacetFilter?.value === label;
                  const isExcluded = isActive && activeFacetFilter?.operator === "exclude";

                  return (
                    <div
                      key={`${facetFieldKey}:${label}`}
                      className={cn(
                        "w-full rounded-2xl border p-3 transition-colors",
                        isActive
                          ? isExcluded
                            ? "border-amber-200 bg-amber-50"
                            : "border-primary bg-accent"
                          : "border-border bg-card hover:border-primary",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block break-all text-xs font-semibold text-foreground [overflow-wrap:anywhere]">{label}</span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">{count} events</span>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-full border-primary bg-background px-2.5 text-[10px] font-bold text-primary shadow-sm transition-all hover:border-primary hover:bg-accent"
                            onClick={() => onAddFieldFilter(facetFieldKey, label, "include")}
                          >
                            포함
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-full border-amber-200/50 bg-background px-2.5 text-[10px] font-bold text-amber-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50"
                            onClick={() => onAddFieldFilter(facetFieldKey, label, "exclude")}
                          >
                            제외
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fieldFacetKeys.map(({ label, count }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onFacetFieldKeyChange(label)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          )}

          {fieldFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {fieldFilters.map((filter) => (
                <button
                  key={`${filter.key}:${filter.operator}:${filter.value}`}
                  type="button"
                  onClick={() => onRemoveFieldFilter(filter.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition",
                    filter.operator === "exclude"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-primary bg-accent text-primary",
                  )}
                >
                  {filter.key} {filter.operator === "exclude" ? "!=" : "="} {filter.value} &times;
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. 주요 인사이트 (Radar & Flows) */}
      <Card className="border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
            <Network className="size-4 text-[color:var(--chart-2)]" />
            주요 흐름 및 인사이트
          </CardTitle>
          <CardDescription className="text-xs leading-6">
            중요도가 높거나 서로 연관된 흐름을 자동으로 추출합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">주요 트레이스 (Trace)</p>
            {topTraceGroups.length > 0 ? topTraceGroups.slice(0, 3).map((group) => (
              <button
                key={group.traceId}
                type="button"
                onClick={() => onSelectTraceGroup(group)}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition-all",
                  traceFilter === group.traceId
                    ? "border-primary bg-accent"
                    : "border-border bg-muted hover:border-primary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-xs font-semibold text-foreground">{formatTraceLabel(group.traceId)}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{group.eventCount} evt</span>
                </div>
                {group.issueCount > 0 && (
                  <div className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700 uppercase">
                    ISSUE {group.issueCount}
                  </div>
                )}
              </button>
            )) : <p className="text-xs text-muted-foreground">데이터가 부족합니다.</p>}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">자동 추론된 흐름</p>
            {topDerivedFlowGroups.length > 0 ? topDerivedFlowGroups.slice(0, 3).map((group) => (
              <button
                key={group.flowKey}
                type="button"
                onClick={() => onSelectDerivedFlowGroup(group)}
                className="w-full rounded-2xl border border-border bg-muted p-3 text-left transition-all hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-foreground">{group.family}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{group.eventCount} evt</span>
                </div>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  {group.correlationKind}: {group.correlationValue}
                </p>
              </button>
            )) : <p className="text-xs text-muted-foreground">데이터가 부족합니다.</p>}
          </div>
        </CardContent>
      </Card>

      {/* 4. 보기 설정 (Columns & Lens) */}
      <Card className="border-border bg-card opacity-80 shadow-xl shadow-black/5 backdrop-blur-xl transition-opacity hover:opacity-100 dark:shadow-black/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
              <Settings2 className="size-4 text-muted-foreground" />
              뷰(View) 설정
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">리스트 컬럼</p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 rounded-full border-border bg-muted px-2.5 text-[10px] font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-background hover:text-foreground"
                onClick={onResetEventColumns}
              >
                초기화
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_STREAM_BUILTIN_COLUMNS.map((column) => {
                const isActive = eventStreamBuiltinColumns.includes(column.id);
                return (
                  <button
                    key={column.id}
                    onClick={() => onToggleBuiltinEventColumn(column.id)}
                    title={column.label}
                    className={cn(
                      "min-w-0 max-w-full overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-medium leading-tight transition",
                      isActive ? "border-primary bg-accent text-primary" : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="block truncate whitespace-nowrap">{column.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">필드 컬럼 고정</p>
            </div>
            {eventColumnFieldOptions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {eventColumnFieldOptions.slice(0, 10).map(({ label }) => {
                  const isPinned = pinnedEventFieldColumns.includes(label);

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onToggleEventFieldColumn(label)}
                      title={label}
                      className={cn(
                        "min-w-0 max-w-full overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-medium leading-tight transition",
                        isPinned ? "border-primary bg-accent text-primary" : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <span className="block truncate whitespace-nowrap">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">고정할 구조화 필드가 없습니다.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">상세 필드 표시</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 rounded-full border-border bg-muted px-2.5 text-[10px] font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-background hover:text-foreground"
                  onClick={onHideAllFieldVisibility}
                  disabled={!hasSession || fieldLensKeys.length === 0 || hiddenFieldKeys.length >= fieldLensKeys.length}
                >
                  전부 숨김
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 rounded-full border-border bg-muted px-2.5 text-[10px] font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-background hover:text-foreground"
                  onClick={onResetFieldVisibility}
                  disabled={!hasSession || hiddenFieldKeys.length === 0}
                >
                  복원
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fieldLensKeys.slice(0, 10).map(({ label }) => {
                const isHidden = hiddenFieldKeys.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => onToggleFieldVisibility(label)}
                    title={label}
                    className={cn(
                      "min-w-0 max-w-full overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-medium leading-tight transition",
                      isHidden ? "border-dashed border-border text-muted-foreground" : "border-primary bg-accent text-primary"
                    )}
                  >
                    <span className="block truncate whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
