import { AlertCircle, FileJson2, FolderOpen, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCard, type MetricCardProps } from "@/features/log-explorer/presentation";
import type { LogAliasPreset, LogAliasPresetId } from "@/lib/logs/aliases";
import type { LogSource, ParsedLogSession } from "@/lib/logs/types";

type OverviewSectionProps = {
  session: ParsedLogSession | null;
  sourceLocation: string | null;
  sessionTitle: string;
  sources: LogSource[];
  sourceCount: number;
  servicesInSession: number;
  errorCount: number;
  multilineCount: number;
  formatBadges: Array<{ label: string; count: number }>;
  metrics: MetricCardProps[];
  errorMessage: string | null;
  parserPreset: LogAliasPreset;
  parserPresetId: LogAliasPresetId;
  parserPresetOptions: LogAliasPreset[];
  loadProgress: {
    currentSourceIndex: number;
    sourceLabel: string;
    totalSources: number;
    lineCount: number;
    eventCount: number;
    diagnosticCount: number;
  } | null;
  onSelectLogFile: () => void;
  onLoadSampleSession: () => void;
  onParserPresetChange: (value: LogAliasPresetId) => void;
};

export function OverviewSection({
  session,
  sourceLocation,
  sessionTitle,
  sources,
  sourceCount,
  servicesInSession,
  errorCount,
  multilineCount,
  formatBadges,
  metrics,
  errorMessage,
  parserPreset,
  parserPresetId,
  parserPresetOptions,
  loadProgress,
  onSelectLogFile,
  onLoadSampleSession,
  onParserPresetChange,
}: OverviewSectionProps) {
  return (
    <>
      <section>
        <Card className="relative z-10 overflow-hidden border-border bg-card shadow-2xl shadow-black/5 backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-500 dark:shadow-black/30">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Left side: Title, Description, and Parser Settings */}
              <div className="min-w-0 flex-1 space-y-5">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                    <Sparkles className="size-3.5" />
                    LogLens Diagnostics
                  </div>
                  <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.04em] text-foreground md:text-5xl md:leading-[1.15]">
                    복잡한 로그 속에서 <br className="hidden md:block" />
                    <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">시스템의 맥락</span>을 발견하세요
                  </h1>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
                    분산 환경의 로그를 단일 뷰로 통합하고, 단절된 트레이스 흐름을 자동으로 연결하여 문제의 근본 원인을 직관적으로 파악할 수 있습니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted p-4 sm:max-w-md">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-sm font-medium text-foreground">파서 프리셋:</span>
                    <Select
                      value={parserPresetId}
                      onValueChange={(value) => onParserPresetChange(value as LogAliasPresetId)}
                      disabled={Boolean(loadProgress)}
                    >
                      <SelectTrigger
                        aria-label="파서 프리셋"
                        className="h-9 flex-1 rounded-xl border-border bg-background text-sm"
                      >
                        <SelectValue placeholder="파서 프리셋" />
                      </SelectTrigger>
                      <SelectContent>
                        {parserPresetOptions.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {parserPreset.description}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-primary" />
                    {session
                      ? "변경 시 현재 세션을 즉시 다시 파싱합니다"
                      : "로그 파일은 오직 로컬 환경에서만 안전하게 처리됩니다"}
                  </div>
                </div>
              </div>

              {/* Right side: Primary Actions */}
              <div className="relative z-10 flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col lg:items-end">
                <Button
                  type="button"
                  size="lg"
                  onClick={onSelectLogFile}
                  disabled={Boolean(loadProgress)}
                  className="pointer-events-auto flex h-12 w-full items-center justify-center rounded-2xl px-6 text-sm font-semibold shadow-md transition-all active:scale-95 sm:w-48 lg:w-56"
                >
                  <FolderOpen className="mr-2 size-4" />
                  {loadProgress ? "데이터 파싱 중..." : "로컬 로그 파일 열기"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={onLoadSampleSession}
                  disabled={Boolean(loadProgress)}
                  className="pointer-events-auto flex h-12 w-full items-center justify-center rounded-2xl border-border bg-background px-6 text-sm font-semibold shadow-sm transition-all hover:bg-muted active:scale-95 sm:w-48 lg:w-56"
                >
                  <FileJson2 className="mr-2 size-4 text-muted-foreground" />
                  데모 데이터로 체험하기
                </Button>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">파일을 불러오는 중 문제가 발생했습니다.</p>
                  <p className="mt-1 break-all leading-6">{errorMessage}</p>
                </div>
              </div>
            )}

            {loadProgress && (
              <div className="mt-5 rounded-2xl border border-primary bg-accent px-4 py-3 text-sm text-foreground">
                <p className="font-medium">세션을 불러오는 중...</p>
                <p className="mt-1 break-all text-muted-foreground">
                  {loadProgress.totalSources > 1
                    ? `[${loadProgress.currentSourceIndex}/${loadProgress.totalSources}] ${loadProgress.sourceLabel}`
                    : loadProgress.sourceLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{loadProgress.lineCount.toLocaleString()} lines</span>
                  <span>{loadProgress.eventCount.toLocaleString()} events</span>
                  <span>{loadProgress.diagnosticCount.toLocaleString()} notes</span>
                </div>
              </div>
            )}

            {session && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-base font-semibold tracking-[-0.03em] text-foreground">
                      {sessionTitle}
                    </p>
                    {sourceLocation && (
                      <p className="mt-0.5 break-all text-xs text-muted-foreground">{sourceLocation}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      소스 {sourceCount}
                    </span>
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      서비스 {servicesInSession}
                    </span>
                    {errorCount > 0 && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        에러 {errorCount}
                      </span>
                    )}
                    {multilineCount > 0 && (
                      <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        멀티라인 {multilineCount}
                      </span>
                    )}
                    {formatBadges.filter(({ count }) => count > 0).map(({ label, count }) => (
                      <span
                        key={label}
                        className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {label} {count}
                      </span>
                    ))}
                  </div>
                </div>
                {sources.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {sources.slice(0, 8).map((source) => (
                      <span
                        key={source.id}
                        className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        title={source.path ?? source.label}
                      >
                        {source.label} · {source.eventCount}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>
    </>
  );
}
