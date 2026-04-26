import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AnalysisDrillDownFilter,
  describeAnalysisDrillDownFilter,
  getAnalysisDrillDownId,
} from "@/features/log-explorer/analysis-drill-down";
import { DistributionRow, formatTraceLabel } from "@/features/log-explorer/presentation";
import { formatDuration } from "@/lib/logs/analysis";
import type { ChartPoint, FacetCount } from "@/lib/logs/analysis";
import type { TraceGroupPreview } from "@/lib/logs/types";

type AnalysisFacetCount = FacetCount & {
  value?: string;
};

type AnalysisTabProps = {
  hourlyChart: {
    data: ChartPoint[];
    parsedCount: number;
  };
  levelCounts: FacetCount[];
  serviceCounts: FacetCount[];
  requestCounts: FacetCount[];
  diagnosticCounts: AnalysisFacetCount[];
  topTraceGroups: TraceGroupPreview[];
  activeDrillDownFilters: AnalysisDrillDownFilter[];
  filteredEventCount: number;
  onApplyDrillDownFilter: (filter: AnalysisDrillDownFilter) => void;
  onClearDrillDownFilters: () => void;
  onRemoveDrillDownFilter: (filter: AnalysisDrillDownFilter) => void;
  onResetAllFilters: () => void;
};

function hasActiveDrillDownFilter(
  activeDrillDownFilters: AnalysisDrillDownFilter[],
  filter: AnalysisDrillDownFilter,
) {
  const filterId = getAnalysisDrillDownId(filter);
  return activeDrillDownFilters.some((activeFilter) => getAnalysisDrillDownId(activeFilter) === filterId);
}

export function AnalysisTab({
  activeDrillDownFilters,
  hourlyChart,
  levelCounts,
  serviceCounts,
  requestCounts,
  diagnosticCounts,
  topTraceGroups,
  filteredEventCount,
  onApplyDrillDownFilter,
  onClearDrillDownFilters,
  onRemoveDrillDownFilter,
  onResetAllFilters,
}: AnalysisTabProps) {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_340px]">
      <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.04em]">시간대별 분포</CardTitle>
              <CardDescription className="pt-2 leading-6">
                {hourlyChart.parsedCount.toLocaleString()}개 이벤트 기준 · 현재 범위 {filteredEventCount.toLocaleString()}개
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={activeDrillDownFilters.length === 0}
                onClick={onClearDrillDownFilters}
              >
                분석 조건만 해제
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onResetAllFilters}
              >
                모든 조건 초기화
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-muted p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">현재 분석 범위</span>
              {activeDrillDownFilters.length > 0 ? activeDrillDownFilters.map((filter) => (
                <button
                  key={getAnalysisDrillDownId(filter)}
                  type="button"
                  onClick={() => onRemoveDrillDownFilter(filter)}
                  className="max-w-full truncate rounded-full border border-primary bg-accent px-3 py-1 text-xs font-medium text-primary transition hover:bg-background"
                >
                  {describeAnalysisDrillDownFilter(filter)}
                </button>
              )) : (
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  전체 분석 범위
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[430px] rounded-[26px] border border-border bg-[linear-gradient(180deg,var(--card),var(--muted))] p-4">
            {hourlyChart.parsedCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={hourlyChart.data}
                  onClick={(state) => {
                    const activeLabel = typeof state?.activeLabel === "string" ? state.activeLabel : null;

                    if (activeLabel) {
                      onApplyDrillDownFilter({ kind: "hourBucket", value: activeLabel });
                    }
                  }}
                  margin={{ top: 18, right: 18, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--primary)", strokeOpacity: 0.15, strokeWidth: 18 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                      boxShadow: "0 24px 60px -30px rgba(0,0,0,0.3)",
                    }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="이벤트 수"
                    stroke="var(--chart-1)"
                    strokeWidth={3}
                    dot={{ fill: "var(--chart-1)", r: 2.5 }}
                    activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "white", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-border bg-card p-8 text-center">
                <div className="max-w-sm">
                  <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                    타임스탬프가 인식된 이벤트가 없습니다
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    시간 필드가 포함된 로그가 필요합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Level 분포</CardTitle>
          <CardDescription className="leading-6">
            로그 레벨별 이벤트 비율
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            {levelCounts.length > 0 ? levelCounts.map(({ label, count }) => (
              <DistributionRow
                key={label}
                actionLabel={`${label} level 분석 범위 적용`}
                active={hasActiveDrillDownFilter(activeDrillDownFilters, { kind: "level", value: label })}
                label={label.toUpperCase()}
                count={count}
                maxCount={levelCounts[0]?.count ?? count}
                onClick={() => onApplyDrillDownFilter({ kind: "level", value: label })}
              />
            )) : (
              <p className="text-sm text-muted-foreground">레벨 정보가 있는 이벤트가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Service 분포</CardTitle>
          <CardDescription className="leading-6">
            상위 service별 이벤트 비율
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            {serviceCounts.slice(0, 5).map(({ label, count }) => (
              <DistributionRow
                key={label}
                actionLabel={`${label} service 분석 범위 적용`}
                active={hasActiveDrillDownFilter(activeDrillDownFilters, { kind: "service", value: label })}
                label={label}
                count={count}
                maxCount={serviceCounts[0]?.count ?? count}
                onClick={() => onApplyDrillDownFilter({ kind: "service", value: label })}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Request 분포</CardTitle>
          <CardDescription className="leading-6">
            상위 request별 이벤트 수
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            {requestCounts.slice(0, 4).map(({ label, count }) => (
              <DistributionRow
                key={label}
                actionLabel={`${label} request 분석 범위 적용`}
                active={hasActiveDrillDownFilter(activeDrillDownFilters, { kind: "request", value: label })}
                label={label}
                count={count}
                maxCount={requestCounts[0]?.count ?? count}
                onClick={() => onApplyDrillDownFilter({ kind: "request", value: label })}
              />
            ))}
            {requestCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">request ID가 포함된 이벤트가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Parser Diagnostics</CardTitle>
          <CardDescription className="leading-6">
            파싱 과정에서 발생한 diagnostic kind별 분포
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            {diagnosticCounts.slice(0, 4).map(({ label, count, value }) => (
              <DistributionRow
                key={label}
                actionLabel={`${label} diagnostic 분석 범위 적용`}
                active={hasActiveDrillDownFilter(activeDrillDownFilters, { kind: "diagnostic", value: value ?? label })}
                label={label}
                count={count}
                maxCount={diagnosticCounts[0]?.count ?? count}
                onClick={() => onApplyDrillDownFilter({ kind: "diagnostic", value: value ?? label })}
              />
            ))}
            {diagnosticCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">파서 노트가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-[-0.03em]">Trace 요약</CardTitle>
          <CardDescription className="leading-6">
            현재 범위의 trace 그룹 요약
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-3">
            {topTraceGroups.map((group) => (
              <div
                key={group.traceId}
                className="rounded-3xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium tracking-[-0.02em] text-foreground">
                    {formatTraceLabel(group.traceId)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {group.eventCount} events
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {group.services.join(", ") || "미지정"} · {formatDuration(group.startMs, group.endMs)}
                </p>
              </div>
            ))}
            {topTraceGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">현재 범위에 trace 그룹이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
