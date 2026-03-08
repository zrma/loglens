import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributionRow, formatTraceLabel } from "@/features/log-explorer/presentation";
import { formatDuration } from "@/lib/logs/analysis";
import type { ChartPoint, FacetCount } from "@/lib/logs/analysis";
import type { TraceGroup } from "@/lib/logs/types";

type AnalysisTabProps = {
  hourlyChart: {
    data: ChartPoint[];
    parsedCount: number;
  };
  levelCounts: FacetCount[];
  serviceCounts: FacetCount[];
  requestCounts: FacetCount[];
  diagnosticCounts: FacetCount[];
  filteredTraceGroups: TraceGroup[];
};

export function AnalysisTab({
  hourlyChart,
  levelCounts,
  serviceCounts,
  requestCounts,
  diagnosticCounts,
  filteredTraceGroups,
}: AnalysisTabProps) {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_340px]">
      <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-2xl tracking-[-0.04em]">시간대 분포</CardTitle>
          <CardDescription className="pt-2 leading-6">
            필터 결과 기준 {hourlyChart.parsedCount.toLocaleString()}개 이벤트의 timestamp를 집계합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[430px] rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,247,0.92))] p-4">
            {hourlyChart.parsedCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={hourlyChart.data}
                  margin={{ top: 18, right: 18, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="rgba(30,41,59,0.08)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    stroke="rgba(71,85,105,0.9)"
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    stroke="rgba(71,85,105,0.9)"
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(15,118,110,0.18)", strokeWidth: 18 }}
                    contentStyle={{
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: "18px",
                      boxShadow: "0 24px 60px -30px rgba(15,23,42,0.45)",
                    }}
                    labelStyle={{ color: "rgba(15,23,42,0.92)", fontWeight: 600 }}
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
              <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-white/60 p-8 text-center">
                <div className="max-w-sm">
                  <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                    timestamp를 인식한 이벤트가 없습니다
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    JSON line, key=value, plain timestamp prefix 중 하나에 맞는 로그에서 시간 분포를 계산합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl tracking-[-0.03em]">Level 분포</CardTitle>
            <CardDescription className="leading-6">
              구조화 결과에서 추출한 level 기준입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {levelCounts.length > 0 ? levelCounts.map(({ label, count }) => (
              <DistributionRow
                key={label}
                label={label.toUpperCase()}
                count={count}
                maxCount={levelCounts[0]?.count ?? count}
              />
            )) : (
              <p className="text-sm text-muted-foreground">표시할 level 분포가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl tracking-[-0.03em]">Service 분포</CardTitle>
            <CardDescription className="leading-6">
              현재 필터 결과에서 이벤트가 많은 service 순서입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceCounts.slice(0, 5).map(({ label, count }) => (
              <DistributionRow
                key={label}
                label={label}
                count={count}
                maxCount={serviceCounts[0]?.count ?? count}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl tracking-[-0.03em]">Request 분포</CardTitle>
            <CardDescription className="leading-6">
              correlation/request 단위로 얼마나 쏠리는지 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestCounts.slice(0, 4).map(({ label, count }) => (
              <DistributionRow
                key={label}
                label={label}
                count={count}
                maxCount={requestCounts[0]?.count ?? count}
              />
            ))}
            {requestCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">request id가 추출된 이벤트가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl tracking-[-0.03em]">Parser Notes</CardTitle>
            <CardDescription className="leading-6">
              멀티라인 병합, timestamp 누락, JSON fallback 같은 진단 요약입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnosticCounts.slice(0, 4).map(({ label, count }) => (
              <DistributionRow
                key={label}
                label={label}
                count={count}
                maxCount={diagnosticCounts[0]?.count ?? count}
              />
            ))}
            {diagnosticCounts.length === 0 && (
              <p className="text-sm text-muted-foreground">현재 세션에는 parser note가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl tracking-[-0.03em]">Trace 요약</CardTitle>
            <CardDescription className="leading-6">
              현재 필터 결과에서 trace 단위로 묶인 흐름입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredTraceGroups.slice(0, 4).map((group) => (
              <div
                key={group.traceId}
                className="rounded-3xl border border-border/70 bg-white/85 p-4"
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
            {filteredTraceGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">현재 필터에서 묶을 trace가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
