import type { LogEvent, LogLevel, ParsedLogFormat, ParsedLogSession } from "@/lib/logs/types";

const LEVEL_PATTERN = /\b(trace|debug|info|warn(?:ing)?|error|fatal|critical)\b/i;
const KV_PATTERN = /([A-Za-z0-9_.@-]+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
const TIMESTAMP_PATTERN =
  /\b\d{4}(?:[-/])\d{2}(?:[-/])\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/;
const TRACE_KEYS = ["traceId", "trace_id", "trace", "otel.trace_id"];
const SPAN_KEYS = ["spanId", "span_id", "span", "otel.span_id"];
const PARENT_SPAN_KEYS = ["parentSpanId", "parent_span_id", "parentSpan", "parent"];
const REQUEST_KEYS = ["requestId", "request_id", "reqId", "req_id", "correlationId", "correlation_id"];
const SERVICE_KEYS = ["service", "serviceName", "service.name", "svc", "logger", "component", "target"];
const MESSAGE_KEYS = ["message", "msg", "event", "body"];
const TIMESTAMP_KEYS = ["timestamp", "@timestamp", "time", "ts", "datetime"];
const LEVEL_KEYS = ["level", "severity", "lvl", "log.level"];

function stripQuotes(value: string) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLevel(value: string | null | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "trace":
      return "trace";
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
    case "warning":
      return "warn";
    case "error":
      return "error";
    case "fatal":
    case "critical":
      return "fatal";
    default:
      return "unknown";
  }
}

function parseTimestamp(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return value;
    }

    if (value > 1_000_000_000) {
      return value * 1000;
    }
  }

  if (typeof value === "string") {
    const normalized = value.includes("T")
      ? value
      : value.replace(/\//g, "-").replace(" ", "T");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return null;
}

function flattenObject(value: unknown, prefix = "", acc: Record<string, string> = {}) {
  if (value === null || value === undefined) {
    return acc;
  }

  if (Array.isArray(value)) {
    acc[prefix] = value.join(", ");
    return acc;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenObject(nestedValue, nextKey, acc);
    }

    return acc;
  }

  acc[prefix] = String(value);
  return acc;
}

function pickField(fields: Record<string, string>, candidates: string[]) {
  const entries = Object.entries(fields);

  for (const candidate of candidates) {
    if (fields[candidate]) {
      return fields[candidate];
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const match = entries.find(([key]) => {
      const normalizedKey = key.toLowerCase();
      return normalizedKey === normalizedCandidate || normalizedKey.endsWith(`.${normalizedCandidate}`);
    });

    if (match) {
      return match[1];
    }
  }

  return null;
}

function parseKeyValueFields(rawLine: string) {
  const fields: Record<string, string> = {};

  for (const match of rawLine.matchAll(KV_PATTERN)) {
    const [, key, rawValue] = match;

    if (!key || !rawValue) {
      continue;
    }

    fields[key] = stripQuotes(rawValue);
  }

  return fields;
}

function deriveServiceFromText(rawLine: string) {
  const bracketMatch = rawLine.match(/\[(?!trace|debug|info|warn|warning|error|fatal)([A-Za-z0-9_.:-]+)\]/i);

  if (bracketMatch?.[1]) {
    return bracketMatch[1];
  }

  const inlineMatch = rawLine.match(/\b(?:trace|debug|info|warn(?:ing)?|error|fatal)\b\s+([A-Za-z][A-Za-z0-9_.:-]{1,40})/i);
  return inlineMatch?.[1] ?? null;
}

function deriveMessage(rawLine: string, fields: Record<string, string>) {
  const directMessage = pickField(fields, MESSAGE_KEYS);

  if (directMessage) {
    return directMessage;
  }

  let message = rawLine;

  const timestampMatch = rawLine.match(TIMESTAMP_PATTERN);
  if (timestampMatch) {
    message = message.replace(timestampMatch[0], "");
  }

  message = message.replace(KV_PATTERN, "");
  message = message.replace(/\[(trace|debug|info|warn(?:ing)?|error|fatal)\]/gi, "");
  message = message.replace(LEVEL_PATTERN, "");
  message = message.replace(/^[\s\-:|]+/, "");

  const normalized = normalizeWhitespace(message);
  return normalized || rawLine;
}

function createEvent(
  lineNumber: number,
  rawLine: string,
  format: ParsedLogFormat,
  fields: Record<string, string>,
): LogEvent {
  const timestampText = pickField(fields, TIMESTAMP_KEYS) ?? rawLine.match(TIMESTAMP_PATTERN)?.[0] ?? null;
  const levelText = pickField(fields, LEVEL_KEYS) ?? rawLine.match(LEVEL_PATTERN)?.[0] ?? null;
  const service = pickField(fields, SERVICE_KEYS) ?? deriveServiceFromText(rawLine);
  const traceId = pickField(fields, TRACE_KEYS);
  const spanId = pickField(fields, SPAN_KEYS);
  const parentSpanId = pickField(fields, PARENT_SPAN_KEYS);
  const requestId = pickField(fields, REQUEST_KEYS);

  return {
    id: `line-${lineNumber}`,
    lineNumber,
    rawLine,
    format,
    timestampMs: parseTimestamp(timestampText),
    timestampText,
    level: normalizeLevel(levelText),
    service,
    message: deriveMessage(rawLine, fields),
    traceId,
    spanId,
    parentSpanId,
    requestId,
    fields,
  };
}

function parseJsonEvent(rawLine: string, lineNumber: number) {
  if (!rawLine.trim().startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawLine) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const fields = flattenObject(parsed);
    return createEvent(lineNumber, rawLine, "json", fields);
  } catch {
    return null;
  }
}

function parseKeyValueEvent(rawLine: string, lineNumber: number) {
  const fields = parseKeyValueFields(rawLine);

  if (Object.keys(fields).length === 0) {
    return null;
  }

  const timestampMatch = rawLine.match(TIMESTAMP_PATTERN);
  if (timestampMatch && !pickField(fields, TIMESTAMP_KEYS)) {
    fields.timestamp = timestampMatch[0];
  }

  const levelMatch = rawLine.match(LEVEL_PATTERN);
  if (levelMatch && !pickField(fields, LEVEL_KEYS)) {
    fields.level = levelMatch[0];
  }

  return createEvent(lineNumber, rawLine, "keyvalue", fields);
}

function parsePlainEvent(rawLine: string, lineNumber: number) {
  const fields: Record<string, string> = {};
  const timestampMatch = rawLine.match(TIMESTAMP_PATTERN);
  const levelMatch = rawLine.match(LEVEL_PATTERN);
  const traceMatch = rawLine.match(/\btrace(?:Id|_id)?[:= ]([A-Za-z0-9-_/.:]+)/i);
  const spanMatch = rawLine.match(/\bspan(?:Id|_id)?[:= ]([A-Za-z0-9-_/.:]+)/i);
  const parentSpanMatch = rawLine.match(/\bparent(?:SpanId|_span_id|Span|)[:= ]([A-Za-z0-9-_/.:]+)/i);
  const requestMatch = rawLine.match(/\b(?:request(?:Id|_id)?|correlation(?:Id|_id)?)[:= ]([A-Za-z0-9-_/.:]+)/i);
  const service = deriveServiceFromText(rawLine);

  if (timestampMatch) {
    fields.timestamp = timestampMatch[0];
  }

  if (levelMatch) {
    fields.level = levelMatch[0];
  }

  if (traceMatch?.[1]) {
    fields.traceId = traceMatch[1];
  }

  if (spanMatch?.[1]) {
    fields.spanId = spanMatch[1];
  }

  if (parentSpanMatch?.[1]) {
    fields.parentSpanId = parentSpanMatch[1];
  }

  if (requestMatch?.[1]) {
    fields.requestId = requestMatch[1];
  }

  if (service) {
    fields.service = service;
  }

  return createEvent(lineNumber, rawLine, "plain", fields);
}

export function parseLogLine(rawLine: string, lineNumber: number) {
  return parseJsonEvent(rawLine, lineNumber)
    ?? parseKeyValueEvent(rawLine, lineNumber)
    ?? parsePlainEvent(rawLine, lineNumber);
}

export function parseLogContent(content: string): ParsedLogSession {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  const events = lines.map((line, index) => parseLogLine(line, index + 1));
  const formatCounts: Record<ParsedLogFormat, number> = {
    json: 0,
    keyvalue: 0,
    plain: 0,
  };

  for (const event of events) {
    formatCounts[event.format] += 1;
  }

  return {
    events,
    formatCounts,
  };
}
