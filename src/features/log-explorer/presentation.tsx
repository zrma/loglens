import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/logs/types";

export type MetricCardProps = {
  caption: string;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  value: string;
};

export const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
  unknown: "UNKNOWN",
};

export function getLevelTone(level: LogLevel) {
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

export function formatTraceLabel(traceId: string | null) {
  if (!traceId) {
    return "untracked";
  }

  if (traceId.length <= 20) {
    return traceId;
  }

  return `${traceId.slice(0, 8)}…${traceId.slice(-6)}`;
}

export function getFileName(path: string | null) {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? path;
}

export function getDirectoryPath(path: string | null) {
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

export function highlightText(text: string, term: string): ReactNode {
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
          className="rounded-md bg-primary/25 px-1 py-0.5 font-semibold text-foreground"
        >
          {part}
        </mark>
      )
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

export function MetricCard({
  caption,
  icon: Icon,
  iconClassName,
  title,
  value,
}: MetricCardProps) {
  return (
    <Card className="group overflow-hidden border-white/60 bg-white/72 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_-36px_rgba(15,23,42,0.45)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption}</p>
          </div>
          <div className={`rounded-2xl p-3 transition-colors ${iconClassName}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-[0.15em]",
        getLevelTone(level),
      )}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

export function DistributionRow({
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
