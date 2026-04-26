import type { LogFieldMap } from "@/lib/logs/types";

export type LogAliasField =
  | "traceId"
  | "traceparent"
  | "spanId"
  | "parentSpanId"
  | "requestId"
  | "service"
  | "message"
  | "timestamp"
  | "level";

export type LogFieldAliases = Record<LogAliasField, string[]>;

export type LogFieldAliasOverrides = Partial<LogFieldAliases>;

export const CANONICAL_LOG_ALIAS_FIELDS = [
  "timestamp",
  "level",
  "service",
  "message",
  "traceId",
  "spanId",
  "parentSpanId",
  "requestId",
] as const satisfies readonly LogAliasField[];

export type CanonicalLogAliasField = (typeof CANONICAL_LOG_ALIAS_FIELDS)[number];

export type LogAliasPresetId = "auto" | "default" | "zap-short-json";

export type LogAliasPreset = {
  id: LogAliasPresetId;
  label: string;
  description: string;
  aliases?: LogFieldAliasOverrides;
};

const BASE_LOG_FIELD_ALIASES: LogFieldAliases = {
  traceId: ["traceId", "trace_id", "trace", "trace.id", "context.trace_id", "dd.trace_id", "otel.trace_id"],
  traceparent: ["traceparent", "headers.traceparent", "context.traceparent"],
  spanId: ["spanId", "span_id", "span", "span.id", "trace.span_id", "context.span_id", "dd.span_id", "otel.span_id"],
  parentSpanId: ["parentSpanId", "parent_span_id", "parentSpan", "parent", "parent.id", "trace.parent_id", "span.parent_id"],
  requestId: [
    "requestId",
    "request_id",
    "reqId",
    "req_id",
    "request.id",
    "http.request.id",
    "correlationId",
    "correlation_id",
    "correlation.id",
  ],
  service: [
    "service",
    "serviceName",
    "service_name",
    "service.name",
    "resource.service.name",
    "attributes.service.name",
    "svc",
    "logger",
    "component",
    "target",
  ],
  message: ["message", "msg", "event", "body", "log", "error.message"],
  timestamp: ["timestamp", "@timestamp", "time", "ts", "datetime", "event.time", "log.timestamp"],
  level: ["level", "severity", "severity_text", "lvl", "log.level"],
};

const ZAP_SHORT_JSON_ALIASES: LogFieldAliasOverrides = {
  level: ["L"],
  message: ["M"],
  requestId: ["rid"],
  service: ["N"],
  timestamp: ["T"],
};
const ZAP_SHORT_JSON_KEYS = ["T", "L", "N", "M", "rid"] as const;

export const LOG_ALIAS_PRESETS: LogAliasPreset[] = [
  {
    id: "auto",
    label: "자동",
    description: "기본 필드를 우선 읽고, zap-style short JSON도 자동 감지합니다.",
  },
  {
    id: "default",
    label: "기본",
    description: "일반적인 JSON, key=value, plain text 필드만 사용합니다.",
  },
  {
    id: "zap-short-json",
    label: "Zap Short JSON",
    description: "T/L/N/M/rid 같은 짧은 키를 항상 별칭으로 사용합니다.",
    aliases: ZAP_SHORT_JSON_ALIASES,
  },
];

function uniqueAliases(aliases: string[]) {
  return [...new Set(aliases)];
}

function cloneAliasSet(aliases: LogFieldAliases): LogFieldAliases {
  return {
    traceId: [...aliases.traceId],
    traceparent: [...aliases.traceparent],
    spanId: [...aliases.spanId],
    parentSpanId: [...aliases.parentSpanId],
    requestId: [...aliases.requestId],
    service: [...aliases.service],
    message: [...aliases.message],
    timestamp: [...aliases.timestamp],
    level: [...aliases.level],
  };
}

function mergeAliasSets(
  baseAliases: LogFieldAliases,
  nextAliases: LogFieldAliasOverrides,
  prepend = false,
) {
  const merged = cloneAliasSet(baseAliases);

  for (const [field, aliases] of Object.entries(nextAliases) as Array<[LogAliasField, string[] | undefined]>) {
    if (!aliases || aliases.length === 0) {
      continue;
    }

    const current = merged[field] ?? [];
    merged[field] = prepend
      ? uniqueAliases([...aliases, ...current])
      : uniqueAliases([...current, ...aliases]);
  }

  return merged;
}

export function extendLogFieldAliases(
  aliases: LogFieldAliases,
  nextAliases: LogFieldAliasOverrides,
  prepend = false,
) {
  return mergeAliasSets(aliases, nextAliases, prepend);
}

export function getLogAliasPreset(presetId: LogAliasPresetId) {
  return LOG_ALIAS_PRESETS.find((preset) => preset.id === presetId) ?? LOG_ALIAS_PRESETS[0];
}

export function buildLogFieldAliases(
  presetId: LogAliasPresetId = "auto",
  aliasOverrides: LogFieldAliasOverrides = {},
) {
  const preset = getLogAliasPreset(presetId);
  let aliases = cloneAliasSet(BASE_LOG_FIELD_ALIASES);

  if (preset.id !== "auto" && preset.aliases) {
    aliases = mergeAliasSets(aliases, preset.aliases);
  }

  return mergeAliasSets(aliases, aliasOverrides, true);
}

export function detectAutoAliasOverrides(fields: LogFieldMap): LogFieldAliasOverrides {
  const hasZapShortKey = ZAP_SHORT_JSON_KEYS.some((key) => Object.prototype.hasOwnProperty.call(fields, key));

  return hasZapShortKey ? ZAP_SHORT_JSON_ALIASES : {};
}
