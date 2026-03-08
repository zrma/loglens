import { type ReactNode, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock3,
  FileText,
  FolderOpen,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type ChartPoint = {
  hour: string;
  count: number;
};

type LogEntry = {
  line: string;
  lineNumber: number;
};

type MetricCardProps = {
  caption: string;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  value: string;
};

function parseLogTimestamp(line: string): Date | null {
  const isoLikeMatch = line.match(
    /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/,
  );

  if (isoLikeMatch) {
    const normalized = isoLikeMatch[0].includes("T")
      ? isoLikeMatch[0]
      : isoLikeMatch[0].replace(" ", "T");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const slashSeparatedMatch = line.match(/\b\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\b/);

  if (slashSeparatedMatch) {
    const normalized = slashSeparatedMatch[0].replace(/\//g, "-").replace(" ", "T");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function buildHourlyChartData(lines: string[]) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}시`,
    count: 0,
  }));

  let parsedLineCount = 0;

  for (const line of lines) {
    const parsedTimestamp = parseLogTimestamp(line);

    if (!parsedTimestamp) {
      continue;
    }

    counts[parsedTimestamp.getHours()].count += 1;
    parsedLineCount += 1;
  }

  return {
    data: counts satisfies ChartPoint[],
    parsedLineCount,
  };
}

function countKeywordMatches(lines: string[], pattern: RegExp) {
  return lines.reduce((count, line) => count + (pattern.test(line) ? 1 : 0), 0);
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function getPeakHour(data: ChartPoint[]) {
  const sorted = [...data].sort((left, right) => right.count - left.count);
  return sorted[0] && sorted[0].count > 0 ? sorted[0] : null;
}

function getTopHours(data: ChartPoint[]) {
  return [...data].filter(({ count }) => count > 0).sort((left, right) => right.count - left.count).slice(0, 3);
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

function App() {
  const [logFile, setLogFile] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("raw");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setLogFile(selected);

        try {
          await invoke("allow_file_access", { path: selected });
          const content = await readTextFile(selected);
          setErrorMessage(null);
          setLogLines(content.split("\n").filter((line) => line.trim() !== ""));
        } catch (readError) {
          setErrorMessage(readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.");
          setLogLines([]);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }

  const logEntries: LogEntry[] = logLines.map((line, index) => ({
    line,
    lineNumber: index + 1,
  }));

  const filteredEntries = logEntries.filter(({ line }) =>
    line.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredLines = filteredEntries.map(({ line }) => line);
  const chartData = buildHourlyChartData(filteredLines);
  const fileName = getFileName(logFile);
  const directoryPath = getDirectoryPath(logFile);
  const parsedCoverage = formatPercent(chartData.parsedLineCount, filteredEntries.length);
  const relationHints = countKeywordMatches(
    filteredLines,
    /\b(trace|span|request[-_ ]?id|correlation[-_ ]?id)\b/i,
  );
  const issueHints = countKeywordMatches(
    filteredLines,
    /\b(error|exception|fail(?:ed)?|fatal|panic|timeout)\b/i,
  );
  const peakHour = getPeakHour(chartData.data);
  const topHours = getTopHours(chartData.data);
  const metrics = [
    {
      caption: logFile ? "선택한 파일 전체 기준" : "파일을 열면 즉시 집계됩니다",
      icon: FileText,
      iconClassName: "bg-primary/10 text-primary",
      title: "로딩된 라인",
      value: logLines.length.toLocaleString(),
    },
    {
      caption: searchTerm ? "현재 검색 결과에 해당하는 라인" : "현재 화면에 노출되는 라인",
      icon: Search,
      iconClassName: "bg-secondary text-secondary-foreground",
      title: "현재 탐색 범위",
      value: filteredEntries.length.toLocaleString(),
    },
    {
      caption: searchTerm ? "검색 결과에서 추출한 타임스탬프 비율" : "현재 세션에서 파싱된 타임스탬프 비율",
      icon: Clock3,
      iconClassName: "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]",
      title: "시간 파싱 커버리지",
      value: parsedCoverage,
    },
    {
      caption: "trace/span/request ID 같은 상관관계 단서",
      icon: GitBranch,
      iconClassName: "bg-[color:var(--chart-3)]/15 text-[color:var(--chart-3)]",
      title: "관계 추적 후보",
      value: relationHints.toLocaleString(),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_10%_10%,rgba(55,160,150,0.18),transparent_34%),radial-gradient(circle_at_88%_2%,rgba(232,153,83,0.2),transparent_26%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
          <Card className="overflow-hidden border-white/60 bg-white/76 shadow-[0_28px_90px_-45px_rgba(11,37,53,0.5)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <CardContent className="p-0">
              <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                    <Sparkles className="size-3.5" />
                    Local Debugging Workbench
                  </div>

                  <div className="mt-6 space-y-4">
                    <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                      로그를 읽는 화면에서 끝내지 않고, 흐름을 추적하는 작업대로
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                      LogLens는 로컬 로그 파일을 바로 열고, 검색 결과를 좁혀 가며, 시간 분포와 관계 후보를 함께 훑을 수 있는
                      디버깅 중심 워크벤치를 목표로 합니다. 지금은 초기 단계지만, 화면 자체는 그 목적이 드러나도록 정리했습니다.
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-4 py-2 text-sm text-muted-foreground">
                      <ShieldCheck className="size-4 text-primary" />
                      선택한 파일만 Tauri scope에 허용
                    </div>
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
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Signal Map</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">이 화면이 강조하는 탐색 흐름</p>
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
                        description: "원본 로그와 분석 시점을 분리해 탐색 맥락이 덜 섞이게 구성했습니다.",
                        icon: Search,
                        title: "탐색 우선",
                      },
                      {
                        description: "시간대 분석은 검색 결과에 연동되어 드릴다운처럼 동작합니다.",
                        icon: BarChart3,
                        title: "컨텍스트 연동",
                      },
                      {
                        description: "trace/span/request ID 같은 관계 후보를 별도 지표로 드러냅니다.",
                        icon: GitBranch,
                        title: "관계 추적 준비",
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
                  <CardTitle className="mt-2 text-2xl tracking-[-0.04em]">현재 탐색 범위</CardTitle>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Activity className="size-5" />
                </div>
              </div>
              <CardDescription className="pt-2 text-sm leading-6">
                한 파일을 빠르게 열고, 검색 결과와 시간 분포를 같은 세션 안에서 번갈아 읽을 수 있도록 구성했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logFile ? (
                <>
                  <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-slate-50">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Loaded File</p>
                    <p className="mt-3 break-all text-xl font-semibold tracking-[-0.04em]">{fileName}</p>
                    {directoryPath && (
                      <p className="mt-2 break-all text-sm leading-6 text-slate-400">{directoryPath}</p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                      <p className="text-sm text-muted-foreground">분석 기준</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                        {searchTerm ? "검색 결과 드릴다운" : "전체 로그 세션"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                      <p className="text-sm text-muted-foreground">피크 시간대</p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">
                        {peakHour ? peakHour.hour : "아직 없음"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[28px] border border-dashed border-border/80 bg-white/70 p-5">
                  <p className="text-sm leading-7 text-muted-foreground">
                    아직 파일이 열리지 않았습니다. `.log` 또는 `.txt` 파일을 하나 고르면 원본 로그, 검색 결과, 시간 분포를
                    바로 확인할 수 있습니다.
                  </p>
                  <Button
                    variant="outline"
                    onClick={selectLogFile}
                    className="mt-5 h-11 rounded-full bg-white/90 px-5"
                  >
                    <FolderOpen className="size-4" />
                    첫 로그 열기
                  </Button>
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

        <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl tracking-[-0.03em]">탐색 컨트롤</CardTitle>
                <CardDescription className="leading-6">
                  검색 조건은 원본 로그와 시간대 분석에 동시에 반영됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="error, timeout, trace id 같은 키워드로 좁혀보기"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    disabled={!logFile}
                    className="h-12 rounded-2xl border-white/60 bg-white/85 pl-10 shadow-none"
                  />
                </div>

                <div className="rounded-3xl border border-border/70 bg-white/75 p-4">
                  <p className="text-sm text-muted-foreground">현재 탐색 힌트</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-foreground">
                    <div className="flex items-start justify-between gap-3">
                      <span>오류/실패 후보</span>
                      <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                        {issueHints.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span>관계 추적 후보</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                        {relationHints.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/72 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl tracking-[-0.03em]">현재 지원 범위</CardTitle>
                <CardDescription className="leading-6">
                  이 프로토타입은 기초 탐색에 집중되어 있고, 관계 추적은 다음 단계 작업입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    "YYYY-MM-DD HH:mm:ss",
                    "2026-03-08T10:21:32Z",
                    "YYYY/MM/DD HH:mm:ss",
                  ].map((format) => (
                    <span
                      key={format}
                      className="rounded-full border border-border/80 bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {format}
                    </span>
                  ))}
                </div>

                <div className="space-y-3">
                  {[
                    {
                      description: "현재는 시간 분포와 원본 라인 탐색이 중심입니다.",
                      icon: Clock3,
                      title: "시간 파악",
                    },
                    {
                      description: "다음 단계는 trace/span과 correlation ID를 연결하는 것입니다.",
                      icon: GitBranch,
                      title: "관계 시각화",
                    },
                  ].map(({ description, icon: Icon, title }) => (
                    <div
                      key={title}
                      className="rounded-3xl border border-border/70 bg-white/75 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-accent/80 p-2.5 text-accent-foreground">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="rounded-[30px] border border-white/60 bg-white/72 p-4 shadow-[0_28px_90px_-48px_rgba(11,37,53,0.55)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">현재 로그 세션</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {logFile
                    ? `${searchTerm ? "검색으로 좁힌 결과" : "전체 로그"}를 원본 라인과 시간 분포 사이에서 오가며 확인할 수 있습니다.`
                    : "파일을 열면 원본 로그와 분석 화면이 이 영역에 표시됩니다."}
                </p>
              </div>

              <TabsList className="grid h-11 w-full max-w-[300px] grid-cols-2 rounded-full bg-slate-950 p-1 text-slate-400">
                <TabsTrigger
                  value="raw"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <FileText className="size-4" />
                  원본 로그
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="rounded-full border-0 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  <BarChart3 className="size-4" />
                  분석
                </TabsTrigger>
              </TabsList>
            </div>

            {!logFile ? (
              <div className="flex min-h-[560px] items-center justify-center px-4 py-10">
                <div className="max-w-xl text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FolderOpen className="size-7" />
                  </div>
                  <h3 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                    로그 세션을 시작해 보세요
                  </h3>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    파일 하나를 열면 이 영역이 원본 로그 탐색기와 시간 분포 패널로 바뀝니다. 이후에는 검색어로 범위를 줄이고,
                    상관관계 후보를 따라가며 화면을 확장하면 됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="raw" className="mt-4">
                  <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
                    <CardHeader className="border-b border-border/70 pb-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardTitle className="text-2xl tracking-[-0.04em]">원본 로그 뷰</CardTitle>
                          <CardDescription className="pt-2 leading-6">
                            총 {filteredEntries.length.toLocaleString()}개 라인을 표시합니다.
                            {searchTerm && ` 검색어 "${searchTerm}"가 적용된 상태입니다.`}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-border/80 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground">
                            파일: {fileName}
                          </span>
                          {searchTerm && (
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              filter: {searchTerm}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[560px]">
                        {filteredEntries.length > 0 ? (
                          <Table className="table-fixed">
                            <TableHeader className="bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                              <TableRow className="border-border/70 hover:bg-transparent">
                                <TableHead className="sticky top-0 z-10 w-[110px] bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                  Line
                                </TableHead>
                                <TableHead className="sticky top-0 z-10 bg-white/95 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                  Raw Message
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredEntries.map(({ line, lineNumber }) => (
                                <TableRow
                                  key={`${lineNumber}-${line}`}
                                  className="border-border/60 align-top hover:bg-primary/5"
                                >
                                  <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                    {lineNumber.toString().padStart(4, "0")}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 font-mono text-[13px] leading-6 whitespace-pre-wrap break-all text-foreground">
                                    {highlightText(line, searchTerm)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="flex h-full items-center justify-center p-10">
                            <div className="max-w-md text-center">
                              <p className="text-lg font-medium tracking-[-0.03em] text-foreground">
                                조건에 맞는 로그 라인이 없습니다
                              </p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                검색어를 조금 더 넓게 잡거나, 다른 로그 파일을 열어 범위를 바꿔 보세요.
                              </p>
                            </div>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_280px]">
                    <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle className="text-2xl tracking-[-0.04em]">시간대 분포</CardTitle>
                        <CardDescription className="pt-2 leading-6">
                          파싱된 {chartData.parsedLineCount.toLocaleString()}개 라인을 기준으로 시간별 분포를 그립니다.
                          {searchTerm && " 현재 검색 결과만 반영됩니다."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="h-[430px] rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,247,0.92))] p-4">
                          {chartData.parsedLineCount > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={chartData.data}
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
                                  name="로그 개수"
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
                                  인식 가능한 타임스탬프가 없습니다
                                </p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  `YYYY-MM-DD HH:mm:ss`, ISO 형식, `YYYY/MM/DD HH:mm:ss` 같은 패턴이 있는 로그에서
                                  시간 분포를 계산합니다.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-white/60 bg-white/78 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl tracking-[-0.03em]">빠른 인사이트</CardTitle>
                        <CardDescription className="leading-6">
                          검색 결과를 기준으로 지금 눈에 띄는 신호를 요약합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="rounded-3xl bg-slate-950 px-4 py-4 text-slate-50">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Peak Hour</p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                            {peakHour ? peakHour.hour : "N/A"}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-border/70 bg-white/80 p-4">
                          <p className="text-sm text-muted-foreground">상위 활성 시간대</p>
                          <div className="mt-4 space-y-4">
                            {topHours.length > 0 ? topHours.map((point) => (
                              <div key={point.hour} className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="font-medium text-foreground">{point.hour}</span>
                                  <span className="text-muted-foreground">{point.count.toLocaleString()} lines</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-[color:var(--chart-1)]"
                                    style={{
                                      width: `${(point.count / (topHours[0]?.count ?? point.count)) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )) : (
                              <p className="text-sm leading-6 text-muted-foreground">
                                아직 차트를 만들 수 있는 시간 정보가 충분하지 않습니다.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-border/70 bg-white/80 p-4">
                          <p className="text-sm text-muted-foreground">다음 확장 포인트</p>
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            이 다음 단계는 trace/span, request ID, correlation ID를 추출해서 시간축과 연결하는 것입니다.
                            지금 UI는 그 방향으로 확장되도록 세션, 지표, 분석 패널을 나눠 두었습니다.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
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
