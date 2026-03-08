import type {
  LogEvent,
  ParseDiagnostic,
  ParseIssue,
  ParsedLogFormat,
  ParsedLogSession,
} from "@/lib/logs/types";

type RawRecord = {
  startLineNumber: number;
  endLineNumber: number;
  lines: string[];
  text: string;
};

const LEVEL_PATTERN = /\b(trace|debug|info|warn(?:ing)?|error|fatal|critical)\b/i;
const LEVEL_START_PATTERN = /^\s*(?:\[[A-Za-z0-9_.:-]+\]\s+)?(?:trace|debug|info|warn(?:ing)?|error|fatal|critical)\b/i;
const KV_PATTERN = /([A-Za-z0-9_.@-]+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
const TIMESTAMP_PATTERN =
  /\b\d{4}(?:[-/])\d{2}(?:[-/])\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/;
const TIMESTAMP_START_PATTERN =
  /^\s*\[?\d{4}(?:[-/])\d{2}(?:[-/])\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?/;
const TRACE_KEYS = ["traceId", "trace_id", "trace", "otel.trace_id"];
const SPAN_KEYS = ["spanId", "span_id", "span", "otel.span_id"];
const PARENT_SPAN_KEYS = ["parentSpanId", "parent_span_id", "parentSpan", "parent"];
const REQUEST_KEYS = ["requestId", "request_id", "reqId", "req_id", "correlationId", "correlation_id"];
const SERVICE_KEYS = ["service", "serviceName", "service.name", "svc", "logger", "component", "target"];
const MESSAGE_KEYS = ["message", "msg", "event", "body"];
const TIMESTAMP_KEYS = ["timestamp", "@timestamp", "time", "ts", "datetime"];
const LEVEL_KEYS = ["level", "severity", "lvl", "log.level"];
const STACK_CONTINUATION_PATTERNS = [
  /^\s+at\b/,
  /^\s*\.\.\. \d+ more\b/i,
  /^\s*Caused by:/i,
  /^\s*Suppressed:/i,
  /^\s*Traceback \(most recent call last\):/i,
  /^\s+File ".*", line \d+/,
  /^\s*\^+$/,
];
const EXCEPTION_LINE_PATTERN = /^[A-Za-z_$][\w.$]*(?:Error|Exception):/;

function stripQuotes(value: string) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLevel(value: string | null | undefined) {
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
    if (prefix) {
      acc[prefix] = value.join(", ");
    }

    return acc;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenObject(nestedValue, nextKey, acc);
    }

    return acc;
  }

  if (prefix) {
    acc[prefix] = String(value);
  }

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

function formatMessageSummary(message: string, continuationLineCount: number) {
  if (continuationLineCount <= 0) {
    return message;
  }

  return `${message} (+${continuationLineCount} lines)`;
}

function deriveMessage(headerLine: string, fields: Record<string, string>, continuationLineCount: number) {
  const directMessage = pickField(fields, MESSAGE_KEYS);

  if (directMessage) {
    return formatMessageSummary(directMessage, continuationLineCount);
  }

  let message = headerLine;

  const timestampMatch = headerLine.match(TIMESTAMP_PATTERN);
  if (timestampMatch) {
    message = message.replace(timestampMatch[0], "");
  }

  message = message.replace(KV_PATTERN, "");
  message = message.replace(/\[(trace|debug|info|warn(?:ing)?|error|fatal)\]/gi, "");
  message = message.replace(LEVEL_PATTERN, "");
  message = message.replace(/^[\s-:|]+/, "");

  const normalized = normalizeWhitespace(message) || headerLine;
  return formatMessageSummary(normalized, continuationLineCount);
}

function createIssue(kind: ParseIssue["kind"], message: string): ParseIssue {
  return { kind, message };
}

function dedupeIssues(issues: ParseIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.kind}:${issue.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createEvent(
  record: RawRecord,
  format: ParsedLogFormat,
  fields: Record<string, string>,
  baseIssues: ParseIssue[] = [],
): LogEvent {
  const headerLine = record.lines[0] ?? record.text;
  const issues = [...baseIssues];
  const continuationLineCount = Math.max(record.lines.length - 1, 0);
  const timestampText = pickField(fields, TIMESTAMP_KEYS) ?? headerLine.match(TIMESTAMP_PATTERN)?.[0] ?? null;
  const levelText = pickField(fields, LEVEL_KEYS) ?? headerLine.match(LEVEL_PATTERN)?.[0] ?? null;
  const service = pickField(fields, SERVICE_KEYS) ?? deriveServiceFromText(headerLine);
  const traceId = pickField(fields, TRACE_KEYS);
  const spanId = pickField(fields, SPAN_KEYS);
  const parentSpanId = pickField(fields, PARENT_SPAN_KEYS);
  const requestId = pickField(fields, REQUEST_KEYS);

  if (record.lines.length > 1) {
    issues.push(createIssue("multiline", `${record.lines.length}줄을 하나의 이벤트로 병합했습니다.`));
  }

  if (!timestampText) {
    issues.push(createIssue("timestamp_missing", "timestamp를 인식하지 못해 시간 기반 정렬과 duration 계산이 제한됩니다."));
  }

  return {
    id: `line-${record.startLineNumber}`,
    lineNumber: record.startLineNumber,
    endLineNumber: record.endLineNumber,
    rawLine: record.text,
    format,
    timestampMs: parseTimestamp(timestampText),
    timestampText,
    level: normalizeLevel(levelText),
    service,
    message: deriveMessage(headerLine, fields, continuationLineCount),
    traceId,
    spanId,
    parentSpanId,
    requestId,
    isMultiLine: record.lines.length > 1,
    parseIssues: dedupeIssues(issues),
    fields,
  };
}

function parseJsonEvent(record: RawRecord, inheritedIssues: ParseIssue[]) {
  const firstLine = record.lines[0]?.trimStart() ?? "";

  if (!firstLine.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(record.text) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const fields = flattenObject(parsed);
    return createEvent(record, "json", fields, inheritedIssues);
  } catch {
    inheritedIssues.push(
      createIssue("invalid_json", "JSON으로 보이는 입력을 파싱하지 못해 다른 포맷으로 fallback 했습니다."),
    );
    return null;
  }
}

function parseKeyValueEvent(record: RawRecord, inheritedIssues: ParseIssue[]) {
  const headerLine = record.lines[0] ?? record.text;
  const fields = parseKeyValueFields(headerLine);

  if (Object.keys(fields).length === 0) {
    return null;
  }

  const timestampMatch = headerLine.match(TIMESTAMP_PATTERN);
  if (timestampMatch && !pickField(fields, TIMESTAMP_KEYS)) {
    fields.timestamp = timestampMatch[0];
  }

  const levelMatch = headerLine.match(LEVEL_PATTERN);
  if (levelMatch && !pickField(fields, LEVEL_KEYS)) {
    fields.level = levelMatch[0];
  }

  return createEvent(record, "keyvalue", fields, inheritedIssues);
}

function parsePlainEvent(record: RawRecord, inheritedIssues: ParseIssue[]) {
  const headerLine = record.lines[0] ?? record.text;
  const fields: Record<string, string> = {};
  const timestampMatch = headerLine.match(TIMESTAMP_PATTERN);
  const levelMatch = headerLine.match(LEVEL_PATTERN);
  const traceMatch = headerLine.match(/\btrace(?:Id|_id)?[:= ]([A-Za-z0-9-_/.:]+)/i);
  const spanMatch = headerLine.match(/\bspan(?:Id|_id)?[:= ]([A-Za-z0-9-_/.:]+)/i);
  const parentSpanMatch = headerLine.match(/\bparent(?:SpanId|_span_id|Span)?[:= ]([A-Za-z0-9-_/.:]+)/i);
  const requestMatch = headerLine.match(/\b(?:request(?:Id|_id)?|correlation(?:Id|_id)?)[:= ]([A-Za-z0-9-_/.:]+)/i);
  const service = deriveServiceFromText(headerLine);

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

  return createEvent(record, "plain", fields, inheritedIssues);
}

function currentLooksLikeStack(lines: string[]) {
  return lines.some((line) =>
    /(?:error|exception|traceback|panic|fatal|stack trace|caused by)/i.test(line),
  );
}

function looksLikeEventStart(line: string) {
  const trimmed = line.trimStart();

  return trimmed.startsWith("{")
    || TIMESTAMP_START_PATTERN.test(trimmed)
    || LEVEL_START_PATTERN.test(trimmed);
}

function isContinuationLine(line: string, currentLines: string[]) {
  const trimmed = line.trim();

  if (!trimmed) {
    return currentLines.length > 0;
  }

  if (STACK_CONTINUATION_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }

  if (EXCEPTION_LINE_PATTERN.test(trimmed) && currentLooksLikeStack(currentLines)) {
    return true;
  }

  return /^\s{2,}\S/.test(line) && currentLooksLikeStack(currentLines);
}

function splitLogRecords(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trimEnd());
  const records: RawRecord[] = [];
  let startLineNumber = 0;
  let currentLines: string[] = [];

  function flushRecord() {
    if (currentLines.length === 0) {
      return;
    }

    records.push({
      startLineNumber,
      endLineNumber: startLineNumber + currentLines.length - 1,
      lines: [...currentLines],
      text: currentLines.join("\n"),
    });
    currentLines = [];
    startLineNumber = 0;
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (!line.trim()) {
      if (currentLines.length > 0 && currentLooksLikeStack(currentLines)) {
        currentLines.push("");
      }

      return;
    }

    if (currentLines.length === 0) {
      startLineNumber = lineNumber;
      currentLines = [line];
      return;
    }

    if (isContinuationLine(line, currentLines)) {
      currentLines.push(line);
      return;
    }

    if (looksLikeEventStart(line)) {
      flushRecord();
      startLineNumber = lineNumber;
      currentLines = [line];
      return;
    }

    flushRecord();
    startLineNumber = lineNumber;
    currentLines = [line];
  });

  flushRecord();
  return records;
}

function collectDiagnostics(events: LogEvent[]) {
  const diagnostics: ParseDiagnostic[] = [];

  for (const event of events) {
    for (const issue of event.parseIssues) {
      diagnostics.push({
        id: `${event.id}-${issue.kind}`,
        kind: issue.kind,
        lineNumber: event.lineNumber,
        endLineNumber: event.endLineNumber,
        message: issue.message,
      });
    }
  }

  return diagnostics;
}

function parseLogRecord(record: RawRecord) {
  const inheritedIssues: ParseIssue[] = [];

  return parseJsonEvent(record, inheritedIssues)
    ?? parseKeyValueEvent(record, inheritedIssues)
    ?? parsePlainEvent(record, inheritedIssues);
}

export function parseLogLine(rawLine: string, lineNumber: number) {
  return parseLogRecord({
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    lines: [rawLine.trimEnd()],
    text: rawLine.trimEnd(),
  });
}

export function parseLogContent(content: string): ParsedLogSession {
  const records = splitLogRecords(content);
  const events = records.map(parseLogRecord);
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
    diagnostics: collectDiagnostics(events),
  };
}
