import { type ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock3,
  FileJson2,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  ListTree,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  buildFacetCounts,
  buildHourlyChartData,
  buildLevelCounts,
  buildTraceGroups,
  filterLogEvents,
  formatDuration,
  formatTimestamp,
  getRelatedEvents,
} from "@/lib/logs/analysis";
import { parseLogContent } from "@/lib/logs/parser";
import { SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME } from "@/lib/logs/sample";
import type { LogLevel, ParsedLogSession, TraceGroup } from "@/lib/logs/types";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type MetricCardProps = {
  caption: string;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  value: string;
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
  unknown: "UNKNOWN",
};

function getLevelTone(level: LogLevel) {
  switch (level) {
    case "fatal":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "info":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "debug":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "trace":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatTraceLabel(traceId: string | null) {
  if (!traceId) {
    return "untracked";
  }

  if (traceId.length <= 20) {
    return traceId;
  }

  return `${traceId.slice(0, 8)}…${traceId.slice(-6)}`;
}

function getFileName(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? path;
}

function getDirectoryPath(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\\/g, "/");
  const lastSlashIndex = normalized.lastIndexOf("/");
  return lastSlashIndex > 0 ? normalized.slice(0, lastSlashIndex) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, term: string): ReactNode {
  const normalizedTerm = term.trim();

  if (!normalizedTerm) {
    return text;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedTerm)})`, "ig");

  return text.split(matcher).map((part, index) => (
    part.toLowerCase() === normalizedTerm.toLowerCase()
      ? (
        <mark
          key={`${part}-${index}`}
          className="rounded-md bg-primary/15 px-1 py-0.5 text-foreground"
        >
          {part}
        </mark>
      )
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function MetricCard({
  caption,
  icon: Icon,
  iconClassName,
  title,
  value,
}: MetricCardProps) {
  return (
    <Card className="overflow-hidden border-white/60 bg-white/72 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{caption}</p>
          </div>
          <div className={`rounded-2xl p-3 ${iconClassName}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em]",
        getLevelTone(level),
      )}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

function DistributionRow({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  const width = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[color:var(--chart-1)] transition-[width]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<ParsedLogSession | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [traceFilter, setTraceFilter] = useState<string | "all">("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("events");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function loadSession(content: string, label: string, path: string | null) {
    const parsedSession = parseLogContent(content);

    setSession(parsedSession);
    setSourceLabel(label);
    setSourcePath(path);
    setSearchTerm("");
    setLevelFilter("all");
    setServiceFilter("all");
    setTraceFilter("all");
    setSelectedEventId(parsedSession.events[0]?.id ?? null);
    setActiveTab("events");
    setErrorMessage(null);
  }

  async function selectLogFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Log Files",
          extensions: ["log", "txt"],
        }],
        defaultPath: "~/",
        directory: false,
      });

      if (selected && !Array.isArray(selected)) {
        try {
          await invoke("allow_file_access", { path: selected });
          const content = await readTextFile(selected);
          loadSession(content, getFileName(selected) ?? selected, selected);
        } catch (readError) {
          setErrorMessage(readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.");
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }

  function loadSampleSession() {
    loadSession(SAMPLE_LOG_CONTENT, SAMPLE_LOG_FILE_NAME, null);
  }

  const events = session?.events ?? [];
  const filters = {
    searchTerm,
    level: levelFilter,
    service: serviceFilter,
    traceId: traceFilter,
  };
  const filteredEvents = filterLogEvents(events, filters);
  const traceGroups = buildTraceGroups(events);
  const filteredTraceGroups = buildTraceGroups(filteredEvents);
  const levelCounts = buildLevelCounts(filteredEvents);
  const serviceCounts = buildFacetCounts(filteredEvents.map((event) => event.service), "미지정");
  const hourlyChart = buildHourlyChartData(filteredEvents);
  const serviceOptions = buildFacetCounts(events.map((event) => event.service), "미지정");
  const traceOptions = traceGroups.map((group) => group.traceId);
  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null;
  const relatedEvents = getRelatedEvents(events, selectedEvent, 10);
  const selectedTraceGroup = selectedEvent?.traceId
    ? traceGroups.find((group) => group.traceId === selectedEvent.traceId) ?? null
    : null;
  const topTraceGroups = (traceFilter === "all" ? traceGroups : filteredTraceGroups).slice(0, 6);
  const servicesInSession = new Set(events.map((event) => event.service).filter(Boolean)).size;
  const tracesInSession = traceGroups.length;
  const timestampCoverage = events.length > 0
    ? `${Math.round((events.filter((event) => event.timestampMs !== null).length / events.length) * 100)}%`
    : "0%";
  const errorCount = events.filter((event) => event.level === "error" || event.level === "fatal").length;
  const formatBadges = session
    ? [
      { label: "JSON", count: session.formatCounts.json },
      { label: "KV", count: session.formatCounts.keyvalue },
      { label: "PLAIN", count: session.formatCounts.plain },
    ]
    : [];
  const sourceLocation = sourcePath ? getDirectoryPath(sourcePath) : "샘플 세션";
  const sessionTitle = sourceLabel ?? "No Active Session";
  const metrics = [
    {
      caption: sourceLabel ? "현재 세션 전체 이벤트 수" : "파일 또는 샘플 세션을 불러오면 집계됩니다",
      icon: FileText,
      iconClassName: "bg-primary/10 text-primary",
      title: "이벤트 수",
      value: events.length.toLocaleString(),
    },
    {
      caption: searchTerm || levelFilter !== "all" || serviceFilter !== "all" || traceFilter !== "all"
        ? "현재 필터가 적용된 결과"
        : "지금 화면에 표시되는 탐색 범위",
      icon: Filter,
      iconClassName: "bg-secondary text-secondary-foreground",
      title: "현재 탐색 범위",
      value: filteredEvents.length.toLocaleString(),
    },
    {
      caption: "traceId가 있는 이벤트를 기준으로 그룹화",
      icon: GitBranch,
      iconClassName: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
      title: "추적 가능한 trace",
      value: tracesInSession.toLocaleString(),
    },
    {
      caption: "timestamp가 인식된 비율",
      icon: Clock3,
      iconClassName: "bg-[color:var(--chart-3)]/15 text-[color:var(--chart-3)]",
      title: "시간 파싱 커버리지",
      value: timestampCoverage,
    },
  ];

  useEffect(() => {
    if (!selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(filteredEvents[0]?.id ?? null);
    }
  }, [filteredEvents, selectedEventId]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_12%_10%,rgba(55,160,150,0.18),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(232,153,83,0.2),transparent_26%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
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
                      문자열 덤프를 넘어서, 이벤트와 trace 단위로 읽는 로그 워크스페이스
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                      이제 LogLens는 로그 라인을 그대로 보여주는 수준을 넘어서, 구조화 필드 추출, trace/span 후보 탐색,
                      관련 이벤트 묶음을 한 화면에서 읽을 수 있는 방향으로 넘어갑니다.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button
                      size="lg"
                      onClick={selectLogFile}
                      className="h-12 rounded-full px-6 text-[15px] font-semibold shadow-lg shadow-primary/20"
                    >
                      <FolderOpen className="size-4" />
                      로그 파일 열기
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={loadSampleSession}
                      className="h-12 rounded-full border-white/70 bg-white/80 px-6 text-[15px] font-semibold"
                    >
                      <FileJson2 className="size-4" />
                      샘플 trace 세션 로드
                    </Button>
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
                </div>

                <div className="rounded-[28px] bg-slate-950/96 p-5 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">MVP Scope</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">지원하는 구조화 입력</p>
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
                        description: "timestamp, level, service, traceId, spanId, message를 우선 추출합니다.",
                        icon: FileJson2,
                        title: "JSON line",
                      },
                      {
                        description: "key=value 로그에서 trace/span/request 단서를 최대한 살립니다.",
                        icon: ListTree,
                        title: "key=value",
                      },
                      {
                        description: "plain text는 timestamp + level + id 토큰 추출까지만 MVP 범위로 제한합니다.",
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
                현재는 단일 세션 기준으로 필터, trace 그룹, 상세 이벤트를 함께 읽도록 구성했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {session ? (
                <>
                  <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-slate-50">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Active Source</p>
                    <p className="mt-3 break-all text-xl font-semibold tracking-[-0.04em]">{sessionTitle}</p>
                    <p className="mt-2 break-all text-sm leading-6 text-slate-400">{sourceLocation}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                      <p className="text-sm text-muted-foreground">서비스 수</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{servicesInSession.toLocaleString()}</p>
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                      <p className="text-sm text-muted-foreground">문제 이벤트</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{errorCount.toLocaleString()}</p>
                    </div>
                  </div>

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
                    로그 파일을 열거나 샘플 세션을 불러오면, 여기서 현재 소스와 파서 분류 상태를 확인할 수 있습니다.
                  </p>
                </div>
              )}

              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-4 py-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                선택한 파일만 Tauri scope에 허용
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl tracking-[-0.03em]">탐색 필터</CardTitle>
                <CardDescription className="leading-6">
                  검색어, level, service, trace를 동시에 좁혀서 이벤트를 탐색할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="message, request id, trace id, service명으로 검색"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    disabled={!session}
                    className="h-12 rounded-2xl border-white/60 bg-white/85 pl-10 shadow-none"
                  />
                </div>

                <div className="grid gap-3">
                  <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LogLevel | "all")} disabled={!session}>
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

                  <Select value={serviceFilter} onValueChange={setServiceFilter} disabled={!session}>
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

                  <Select value={traceFilter} onValueChange={setTraceFilter} disabled={!session}>
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
                </div>

                <Button
                  variant="ghost"
                  className="h-10 w-full rounded-2xl"
                  onClick={() => {
                    setSearchTerm("");
                    setLevelFilter("all");
                    setServiceFilter("all");
                    setTraceFilter("all");
                  }}
                  disabled={!session}
                >
                  필터 초기화
                </Button>
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
                    onClick={() => {
                      setTraceFilter(group.traceId);
                      setActiveTab("events");
                      setSelectedEventId(group.eventIds[0] ?? null);
                    }}
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
                      {group.issueCount > 0 && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                          issue {group.issueCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {formatDuration(group.startMs, group.endMs)} · span {group.spanCount}
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="rounded-[30px] border border-white/60 bg-white/72 p-4 shadow-[0_28px_90px_-48px_rgba(11,37,53,0.55)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">구조화 로그 세션</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  현재는 이벤트 목록, trace 단서, 상세 이벤트 패널을 함께 보여주는 최소 탐색 루프를 제공합니다.
                </p>
              </div>

              <TabsList className="grid h-11 w-full max-w-[320px] grid-cols-2 rounded-full bg-slate-950 p-1 text-slate-400">
                <TabsTrigger
                  value="events"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <ListTree className="size-4" />
                  이벤트
                </TabsTrigger>
                <TabsTrigger
                  value="analysis"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <BarChart3 className="size-4" />
                  분석
                </TabsTrigger>
              </TabsList>
            </div>

            {!session ? (
              <div className="flex min-h-[580px] items-center justify-center px-4 py-10">
                <div className="max-w-xl text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FolderOpen className="size-7" />
                  </div>
                  <h3 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                    구조화 탐색 세션을 시작해 보세요
                  </h3>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    로그 파일을 열거나 샘플 세션을 불러오면, 문자열 라인이 아닌 이벤트 단위로 정리된 목록과 trace 요약이
                    여기에 표시됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="events" className="mt-4">
                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
                    <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <CardTitle className="text-2xl tracking-[-0.04em]">이벤트 스트림</CardTitle>
                            <CardDescription className="pt-2 leading-6">
                              필터 적용 결과 {filteredEvents.length.toLocaleString()}개 이벤트를 표시합니다.
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-border/80 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground">
                              source: {sessionTitle}
                            </span>
                            {traceFilter !== "all" && (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                trace: {formatTraceLabel(traceFilter)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-[620px]">
                          {filteredEvents.length > 0 ? (
                            <Table className="table-fixed">
                              <TableHeader className="bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                                <TableRow className="border-border/70 hover:bg-transparent">
                                  <TableHead className="sticky top-0 z-10 w-[120px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    Time
                                  </TableHead>
                                  <TableHead className="sticky top-0 z-10 w-[110px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    Level
                                  </TableHead>
                                  <TableHead className="sticky top-0 z-10 w-[140px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    Service
                                  </TableHead>
                                  <TableHead className="sticky top-0 z-10 bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    Message
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredEvents.map((event) => (
                                  <TableRow
                                    key={event.id}
                                    className={cn(
                                      "cursor-pointer border-border/60 align-top hover:bg-primary/5",
                                      selectedEvent?.id === event.id && "bg-primary/5",
                                    )}
                                    onClick={() => setSelectedEventId(event.id)}
                                  >
                                    <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                      <div>{formatTimestamp(event.timestampMs)}</div>
                                      <div className="mt-1 text-[11px]">#{event.lineNumber}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                      <LevelBadge level={event.level} />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-foreground">
                                      {event.service ?? <span className="text-muted-foreground">미지정</span>}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                      <div className="space-y-2">
                                        <p className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-all text-foreground">
                                          {highlightText(event.message, searchTerm)}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {event.traceId && (
                                            <span className="rounded-full border border-border/70 bg-secondary/55 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                                              trace {formatTraceLabel(event.traceId)}
                                            </span>
                                          )}
                                          {event.requestId && (
                                            <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                              req {event.requestId}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="flex h-full items-center justify-center p-10">
                              <div className="max-w-md text-center">
                                <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                                  필터 조건에 맞는 이벤트가 없습니다
                                </p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  검색어를 넓히거나 trace/service 필터를 초기화해 보세요.
                                </p>
                              </div>
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle className="text-2xl tracking-[-0.04em]">상세 이벤트</CardTitle>
                        <CardDescription className="pt-2 leading-6">
                          선택한 이벤트와 같은 trace 흐름을 빠르게 따라갈 수 있습니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5 p-5">
                        {selectedEvent ? (
                          <>
                            <div className="rounded-[28px] bg-slate-950 px-4 py-4 text-slate-50">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected Event</p>
                                  <p className="mt-2 break-all text-lg font-semibold tracking-[-0.03em]">
                                    {selectedEvent.service ?? "미지정 서비스"}
                                  </p>
                                </div>
                                <LevelBadge level={selectedEvent.level} />
                              </div>
                              <p className="mt-4 font-mono text-sm leading-6 text-slate-200">
                                {selectedEvent.message}
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                                <p className="text-sm text-muted-foreground">trace</p>
                                <p className="mt-2 break-all text-sm font-medium text-foreground">
                                  {selectedEvent.traceId ?? "없음"}
                                </p>
                              </div>
                              <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                                <p className="text-sm text-muted-foreground">span</p>
                                <p className="mt-2 break-all text-sm font-medium text-foreground">
                                  {selectedEvent.spanId ?? "없음"}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {selectedEvent.traceId && (
                                <Button
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => {
                                    setTraceFilter(selectedEvent.traceId ?? "all");
                                    setActiveTab("events");
                                  }}
                                >
                                  이 trace만 보기
                                </Button>
                              )}
                              {selectedEvent.service && (
                                <Button
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => setServiceFilter(selectedEvent.service ?? "all")}
                                >
                                  이 service만 보기
                                </Button>
                              )}
                            </div>

                            <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium tracking-[-0.02em] text-foreground">
                                  {selectedEvent.traceId ? "관련 trace 흐름" : "주변 이벤트"}
                                </p>
                                {selectedTraceGroup && (
                                  <span className="text-xs text-muted-foreground">
                                    {selectedTraceGroup.eventCount} events · {formatDuration(selectedTraceGroup.startMs, selectedTraceGroup.endMs)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-4 space-y-3">
                                {relatedEvents.map((event) => (
                                  <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => setSelectedEventId(event.id)}
                                    className={cn(
                                      "w-full rounded-3xl border p-3 text-left transition-all",
                                      event.id === selectedEvent.id
                                        ? "border-primary/30 bg-primary/10"
                                        : "border-border/70 bg-white hover:border-primary/20 hover:bg-primary/5",
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xs text-muted-foreground">{formatTimestamp(event.timestampMs)}</span>
                                      <LevelBadge level={event.level} />
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-foreground">
                                      {event.service ?? "미지정"}
                                    </p>
                                    <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
                                      {event.message}
                                    </p>
                                    {(event.spanId || event.parentSpanId) && (
                                      <p className="mt-2 text-[11px] text-muted-foreground">
                                        span {event.spanId ?? "없음"} / parent {event.parentSpanId ?? "없음"}
                                      </p>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                              <p className="font-medium tracking-[-0.02em] text-foreground">추출된 필드</p>
                              <div className="mt-4 grid gap-3">
                                {Object.entries(selectedEvent.fields).slice(0, 10).map(([key, value]) => (
                                  <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-sm">
                                    <span className="font-mono text-muted-foreground">{key}</span>
                                    <span className="break-all font-mono text-foreground">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-3xl border border-border/70 bg-white/85 p-4">
                              <p className="font-medium tracking-[-0.02em] text-foreground">Raw Line</p>
                              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                                {selectedEvent.rawLine}
                              </pre>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-[28px] border border-dashed border-border/80 bg-white/70 p-5">
                            <p className="text-sm leading-7 text-muted-foreground">
                              이벤트를 하나 선택하면 추출된 필드와 관련 trace 흐름을 여기서 보여줍니다.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="analysis" className="mt-4">
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
                          <CardTitle className="text-xl tracking-[-0.03em]">Trace 요약</CardTitle>
                          <CardDescription className="leading-6">
                            현재 필터 결과에서 trace 단위로 묶인 흐름입니다.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {filteredTraceGroups.slice(0, 4).map((group: TraceGroup) => (
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
                </TabsContent>
              </>
            )}
          </Tabs>
        </section>
      </main>
    </div>
  );
}

export default App;
