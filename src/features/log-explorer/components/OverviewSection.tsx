import { Activity, AlertCircle, FileJson2, FolderOpen, ListTree, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  sourceLabel: string | null;
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
  sourceLabel,
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
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <Card className="overflow-hidden border-white/60 bg-white/76 shadow-[0_28px_90px_-45px_rgba(11,37,53,0.5)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <CardContent className="p-0">
            <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  <Sparkles className="size-3.5" />
                  Structured Log Explorer
                </div>

                <div className="mt-6 space-y-4">
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                    로그를 이벤트와 trace로 읽는 워크스페이스
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                    구조화 필드, trace/span, 멀티라인 오류를 한 화면에서 확인합니다.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={onSelectLogFile}
                    disabled={Boolean(loadProgress)}
                    className="h-12 rounded-full px-6 text-[15px] font-semibold shadow-lg shadow-primary/20"
                  >
                    <FolderOpen className="size-4" />
                    {loadProgress ? "로그 파싱 중" : "로그 파일 열기"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={onLoadSampleSession}
                    disabled={Boolean(loadProgress)}
                    className="h-12 rounded-full border-white/70 bg-white/80 px-6 text-[15px] font-semibold"
                  >
                    <FileJson2 className="size-4" />
                    샘플 trace 세션 로드
                  </Button>
                </div>

                <div className="mt-5 rounded-3xl border border-border/70 bg-white/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Parser Preset</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{parserPreset.description}</p>
                    </div>
                    <div className="w-full md:w-[260px]">
                      <Select
                        value={parserPresetId}
                        onValueChange={(value) => onParserPresetChange(value as LogAliasPresetId)}
                        disabled={Boolean(loadProgress)}
                      >
                        <SelectTrigger className="h-11 rounded-2xl border-white/60 bg-white/85">
                          <SelectValue placeholder="Parser Preset" />
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
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {session ? "변경하면 현재 세션을 다시 읽습니다." : "다음 로드부터 적용됩니다."}
                  </p>
                </div>

                {errorMessage && (
                  <div className="mt-5 flex items-start gap-3 rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">파일을 불러오는 중 문제가 발생했습니다.</p>
                      <p className="mt-1 break-all leading-6">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {loadProgress && (
                  <div className="mt-5 rounded-3xl border border-primary/15 bg-primary/5 px-4 py-4 text-sm text-foreground">
                    <p className="font-medium">세션을 불러오는 중입니다.</p>
                    <p className="mt-1 break-all text-muted-foreground">
                      {loadProgress.totalSources > 1
                        ? `[${loadProgress.currentSourceIndex}/${loadProgress.totalSources}] ${loadProgress.sourceLabel}`
                        : loadProgress.sourceLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{loadProgress.lineCount.toLocaleString()} lines</span>
                      <span>{loadProgress.eventCount.toLocaleString()} events</span>
                      <span>{loadProgress.diagnosticCount.toLocaleString()} notes</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[28px] bg-slate-950/96 p-5 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Formats</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">지원 포맷</p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-300" />
                    <span className="size-2 rounded-full bg-amber-300" />
                    <span className="size-2 rounded-full bg-cyan-300" />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    {
                      description: "timestamp, level, service, trace, message 추출",
                      icon: FileJson2,
                      title: "JSON line",
                    },
                    {
                      description: "trace, span, request 후보 추출",
                      icon: ListTree,
                      title: "key=value",
                    },
                    {
                      description: "멀티라인 오류 병합과 parser note 보존",
                      icon: Activity,
                      title: "plain text",
                    },
                  ].map(({ description, icon: Icon, title }) => (
                    <div
                      key={title}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white/10 p-2.5 text-cyan-200">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,247,246,0.8))] shadow-[0_28px_90px_-48px_rgba(11,37,53,0.55)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Session</p>
                <CardTitle className="mt-2 text-2xl tracking-[-0.04em]">활성 세션 요약</CardTitle>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Activity className="size-5" />
              </div>
            </div>
            <CardDescription className="pt-2 text-sm leading-6">
              현재 세션의 소스와 파서 상태를 요약합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session ? (
              <>
                <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-slate-50">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Active Source</p>
                  <p className="mt-3 break-all text-xl font-semibold tracking-[-0.04em]">{sessionTitle}</p>
                  <p className="mt-2 break-all text-sm leading-6 text-slate-400">{sourceLocation ?? "샘플 세션"}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                    <p className="text-sm text-muted-foreground">소스 파일</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{sourceCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                    <p className="text-sm text-muted-foreground">서비스 수</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{servicesInSession.toLocaleString()}</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                    <p className="text-sm text-muted-foreground">문제 이벤트</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{errorCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                    <p className="text-sm text-muted-foreground">멀티라인 이벤트</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{multilineCount.toLocaleString()}</p>
                  </div>
                </div>

                {sources.length > 1 && (
                  <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                    <p className="text-sm text-muted-foreground">세션 소스</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sources.slice(0, 8).map((source) => (
                        <span
                          key={source.id}
                          className="rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-muted-foreground"
                          title={source.path ?? source.label}
                        >
                          {source.label} · {source.eventCount}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                  <p className="text-sm text-muted-foreground">파서 분류</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formatBadges.map(({ label, count }) => (
                      <span
                        key={label}
                        className="rounded-full border border-border/70 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {label} {count}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[28px] border border-dashed border-border/80 bg-white/70 p-5">
                <p className="text-sm leading-7 text-muted-foreground">
                  세션을 불러오면 소스와 파서 상태가 여기에 표시됩니다.
                </p>
              </div>
            )}

            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-4 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              선택한 파일만 Tauri scope에 허용
            </div>

            {!sourceLabel && !session && (
              <div className="rounded-3xl border border-dashed border-border/70 bg-white/70 p-4 text-sm leading-6 text-muted-foreground">
                아직 세션이 없습니다. 파일이나 샘플을 불러오세요.
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
