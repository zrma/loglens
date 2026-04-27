import type {
  LogEvent,
  LogFieldMap,
  LogSource,
  LogSourceRef,
  ParseIssue,
  ParsedLogFormat,
  ParsedLogSession,
} from "@/lib/logs/types";
import {
  CANONICAL_LOG_ALIAS_FIELDS,
  buildLogFieldAliases,
  detectAutoAliasOverrides,
  extendLogFieldAliases,
  type LogAliasPresetId,
  type LogFieldAliases,
  type LogFieldAliasOverrides,
} from "@/lib/logs/aliases";

type RawRecord = {
  startLineNumber: number;
  endLineNumber: number;
  lines: string[];
  text: string;
};

type ParserProgress = {
  lineCount: number;
  eventCount: number;
  diagnosticCount: number;
};

type ParseSourceMeta = LogSourceRef;

type FieldLookup = {
  fields: LogFieldMap;
  normalizedValues: Map<string, { key: string; value: string }>;
};

type FieldMatch = {
  key: string;
  value: string;
};

type ParseLogOptions = {
  aliasOverrides?: LogFieldAliasOverrides;
  aliasPresetId?: LogAliasPresetId;
  source?: ParseSourceMeta;
};

const LEVEL_PATTERN = /\b(trace|debug|info|warn(?:ing)?|error|fatal|critical)\b/i;
const LEVEL_START_PATTERN = /^\s*(?:\[[A-Za-z0-9_.:-]+\]\s+)?(?:trace|debug|info|warn(?:ing)?|error|fatal|critical)\b/i;
const KV_PATTERN = /([A-Za-z0-9_.@-]+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
const TRACEPARENT_PATTERN = /\b[a-f0-9]{2}-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}\b/i;
const TIMESTAMP_PATTERN =
  /\b\d{4}(?:[-/])\d{2}(?:[-/])\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/;
const TIMESTAMP_START_PATTERN =
  /^\s*\[?\d{4}(?:[-/])\d{2}(?:[-/])\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?/;
const STACK_CONTINUATION_PATTERNS = [
  /^\s+at\b/,
  /^\s*\.\.\. \d+ more\b/i,
  /^\s*Caused by:/i,
  /^\s*Suppressed:/i,
  /^\s*goroutine \d+ \[[^\]]+\]:$/i,
  /^\s*(?:panic|fatal error):/i,
  /^\s*[\w./-]+\.[\w$<>-]+\([^)]*\)$/,
  /^\s*(?:\t| +)\/?.+:\d+(?: \+0x[0-9a-f]+)?$/i,
  /^\s*Traceback \(most recent call last\):/i,
  /^\s+File ".*", line \d+/,
  /^\s*\^+$/,
];
const EXCEPTION_LINE_PATTERN = /^[A-Za-z_$][\w.$]*(?:Error|Exception):/;
const STACK_CONTEXT_PATTERN = /(?:error|exception|traceback|panic|fatal|stack trace|caused by)/i;
const NUMERIC_TIMESTAMP_PATTERN = /^-?\d+(?:\.\d+)?$/;

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

function extractTraceparentContext(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(TRACEPARENT_PATTERN);

  if (!match) {
    return null;
  }

  const [, traceId, spanId] = match;
  return {
    spanId,
    traceId,
  };
}

function extractXrayTraceContext(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parts = new Map<string, string>();

  for (const part of value.split(";")) {
    const [rawKey, ...rawValueParts] = part.split("=");
    const key = rawKey?.trim().toLowerCase();
    const partValue = rawValueParts.join("=").trim();

    if (!key || !partValue) {
      continue;
    }

    parts.set(key, partValue);
  }

  const traceId = parts.get("root") ?? null;
  const spanId = parts.get("parent") ?? null;

  return traceId || spanId
    ? {
      spanId,
      traceId,
    }
    : null;
}

function normalizeEpochTimestamp(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000_000_000_000) {
    return Math.trunc(value / 1_000_000);
  }

  if (absoluteValue >= 1_000_000_000_000_000) {
    return Math.trunc(value / 1000);
  }

  if (absoluteValue >= 1_000_000_000_000) {
    return Math.trunc(value);
  }

  if (absoluteValue >= 1_000_000_000) {
    return Math.trunc(value * 1000);
  }

  return null;
}

function parseTimestamp(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return normalizeEpochTimestamp(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (NUMERIC_TIMESTAMP_PATTERN.test(trimmed)) {
      return normalizeEpochTimestamp(Number(trimmed));
    }

    const normalized = trimmed.includes("T")
      ? trimmed
      : trimmed.replace(/\//g, "-").replace(/\s+/, "T");
    const parsed = Date.parse(normalized);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenObject(value: unknown, prefix = "", acc: LogFieldMap = {}) {
  if (value === null || value === undefined) {
    return acc;
  }

  if (Array.isArray(value)) {
    if (value.every((item) => item === null || item === undefined || !isPlainRecord(item))) {
      if (prefix) {
        acc[prefix] = value.map((item) => (item === null || item === undefined ? "" : String(item))).join(", ");
      }

      return acc;
    }

    for (const [index, item] of value.entries()) {
      const nextKey = prefix ? `${prefix}.${index}` : String(index);
      flattenObject(item, nextKey, acc);
    }

    return acc;
  }

  if (isPlainRecord(value)) {
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

function createFieldLookup(fields: LogFieldMap): FieldLookup {
  const normalizedValues = new Map<string, FieldMatch>();

  for (const [key, value] of Object.entries(fields)) {
    let candidateKey = key.toLowerCase();

    while (candidateKey) {
      if (!normalizedValues.has(candidateKey)) {
        normalizedValues.set(candidateKey, { key, value });
      }

      const nextDotIndex = candidateKey.indexOf(".");
      if (nextDotIndex === -1) {
        break;
      }

      candidateKey = candidateKey.slice(nextDotIndex + 1);
    }
  }

  return {
    fields,
    normalizedValues,
  };
}

function pickFieldMatch(fieldLookup: FieldLookup, candidates: string[]): FieldMatch | null {
  const { fields, normalizedValues } = fieldLookup;

  for (const candidate of candidates) {
    const directValue = fields[candidate];

    if (directValue) {
      return {
        key: candidate,
        value: directValue,
      };
    }
  }

  for (const candidate of candidates) {
    const match = normalizedValues.get(candidate.toLowerCase());

    if (match) {
      return match;
    }
  }

  return null;
}

function pickField(fieldLookup: FieldLookup, candidates: string[]) {
  return pickFieldMatch(fieldLookup, candidates)?.value ?? null;
}

function collectFieldMatches(fieldLookup: FieldLookup, candidates: string[]) {
  const matches: FieldMatch[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const directValue = fieldLookup.fields[candidate];

    if (directValue && !seen.has(candidate)) {
      matches.push({ key: candidate, value: directValue });
      seen.add(candidate);
    }
  }

  for (const candidate of candidates) {
    const match = fieldLookup.normalizedValues.get(candidate.toLowerCase());

    if (match && !seen.has(match.key)) {
      matches.push(match);
      seen.add(match.key);
    }
  }

  return matches;
}

function parseKeyValueFields(rawLine: string) {
  const fields: LogFieldMap = {};

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

function lineLooksLikeStackContext(line: string) {
  return STACK_CONTEXT_PATTERN.test(line);
}

function formatMessageSummary(message: string, continuationLineCount: number) {
  if (continuationLineCount <= 0) {
    return message;
  }

  return `${message} (+${continuationLineCount} lines)`;
}

function deriveMessage(
  headerLine: string,
  fieldLookup: FieldLookup,
  continuationLineCount: number,
  aliases: LogFieldAliases,
) {
  const directMessage = pickField(fieldLookup, aliases.message);

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

function getDefaultSeverity(kind: ParseIssue["kind"]): ParseIssue["severity"] {
  switch (kind) {
    case "alias_override_applied":
    case "correlation_field_missing":
    case "multiline_merged":
    case "structured_parse_fallback":
      return "info";
    case "field_collision":
    case "json_parse_failed":
    case "key_value_partial_parse":
    case "timestamp_missing":
    case "timestamp_parse_failed":
      return "warning";
    default:
      return "warning";
  }
}

function createIssue(
  kind: ParseIssue["kind"],
  message: string,
  metadata?: ParseIssue["metadata"],
  severity: ParseIssue["severity"] = getDefaultSeverity(kind),
): ParseIssue {
  return {
    kind,
    message,
    metadata,
    severity,
  };
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
  fields: LogFieldMap,
  aliases: LogFieldAliases,
  baseIssues: ParseIssue[] = [],
  source: ParseSourceMeta = { id: "session", label: "session", path: null },
  aliasOverrides: LogFieldAliasOverrides = {},
): LogEvent {
  const headerLine = record.lines[0] ?? record.text;
  const issues = [...baseIssues];
  const continuationLineCount = Math.max(record.lines.length - 1, 0);
  const fieldLookup = createFieldLookup(fields);
  const timestampFieldMatch = pickFieldMatch(fieldLookup, aliases.timestamp);
  const timestampText = timestampFieldMatch?.value ?? headerLine.match(TIMESTAMP_PATTERN)?.[0] ?? null;
  const timestampMs = parseTimestamp(timestampText);
  const levelText = pickField(fieldLookup, aliases.level) ?? headerLine.match(LEVEL_PATTERN)?.[0] ?? null;
  const service = pickField(fieldLookup, aliases.service) ?? deriveServiceFromText(headerLine);
  const traceContext = extractTraceparentContext(
    pickField(fieldLookup, aliases.traceparent) ?? headerLine.match(TRACEPARENT_PATTERN)?.[0] ?? null,
  );
  const xrayTraceContext = extractXrayTraceContext(pickField(fieldLookup, aliases.xrayTraceId));
  const traceId = pickField(fieldLookup, aliases.traceId) ?? traceContext?.traceId ?? xrayTraceContext?.traceId ?? null;
  const spanId = pickField(fieldLookup, aliases.spanId) ?? traceContext?.spanId ?? xrayTraceContext?.spanId ?? null;
  const parentSpanId = pickField(fieldLookup, aliases.parentSpanId);
  const requestId = pickField(fieldLookup, aliases.requestId);

  if (record.lines.length > 1) {
    issues.push(createIssue("multiline_merged", `${record.lines.length}줄을 하나의 이벤트로 병합했습니다.`, {
      lineCount: record.lines.length,
    }));
  }

  if (!timestampText) {
    issues.push(createIssue("timestamp_missing", "timestamp 후보를 찾지 못해 시간 기반 정렬과 duration 계산이 제한됩니다.", {
      checkedKeys: aliases.timestamp.slice(0, 8).join(", "),
      hint: "필드 매핑에서 timestamp alias를 추가하면 해결될 수 있습니다.",
    }));
  } else if (timestampMs === null) {
    issues.push(createIssue("timestamp_parse_failed", "timestamp 후보를 찾았지만 지원하는 시간 포맷으로 파싱하지 못했습니다.", {
      key: timestampFieldMatch?.key ?? "raw",
      value: timestampText,
    }));
  }

  for (const field of CANONICAL_LOG_ALIAS_FIELDS) {
    const overrideAliases = aliasOverrides[field];

    if (!overrideAliases || overrideAliases.length === 0) {
      continue;
    }

    const match = pickFieldMatch(fieldLookup, overrideAliases);

    if (match) {
      issues.push(createIssue("alias_override_applied", `${field} 필드에 세션 alias override '${match.key}'를 적용했습니다.`, {
        alias: match.key,
        canonicalField: field,
      }));
    }
  }

  for (const field of CANONICAL_LOG_ALIAS_FIELDS) {
    const matches = collectFieldMatches(fieldLookup, aliases[field]);
    const distinctValues = new Set(matches.map((match) => match.value));

    if (distinctValues.size > 1) {
      issues.push(createIssue("field_collision", `${field} 후보 필드가 여러 값으로 충돌해 첫 번째 값을 사용했습니다.`, {
        canonicalField: field,
        keys: matches.map((match) => match.key).join(", "),
      }));
    }
  }

  if (!traceId && !spanId && !requestId) {
    issues.push(createIssue("correlation_field_missing", "trace/span/request 필드를 찾지 못해 연관 흐름 탐색이 제한됩니다.", {
      checkedKeys: [
        ...aliases.traceId.slice(0, 4),
        ...aliases.spanId.slice(0, 4),
        ...aliases.requestId.slice(0, 4),
      ].join(", "),
      hint: "필드 매핑에서 traceId, spanId, requestId alias를 추가하면 해결될 수 있습니다.",
    }));
  }

  return {
    id: `${source.id}:line-${record.startLineNumber}`,
    lineNumber: record.startLineNumber,
    endLineNumber: record.endLineNumber,
    sourceId: source.id,
    sourceLabel: source.label,
    sourcePath: source.path,
    rawLine: record.text,
    format,
    timestampMs,
    timestampText,
    level: normalizeLevel(levelText),
    service,
    message: deriveMessage(headerLine, fieldLookup, continuationLineCount, aliases),
    traceId,
    spanId,
    parentSpanId,
    requestId,
    isMultiLine: record.lines.length > 1,
    parseIssues: dedupeIssues(issues),
    fields,
  };
}

function resolveEventAliases(
  fields: LogFieldMap,
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
) {
  if (aliasPresetId !== "auto") {
    return aliases;
  }

  const autoOverrides = detectAutoAliasOverrides(fields);
  return Object.keys(autoOverrides).length > 0
    ? extendLogFieldAliases(aliases, autoOverrides)
    : aliases;
}

function parseJsonEvent(
  record: RawRecord,
  inheritedIssues: ParseIssue[],
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
  aliasOverrides: LogFieldAliasOverrides,
  source?: ParseSourceMeta,
) {
  const firstLine = record.lines[0]?.trimStart() ?? "";

  if (!firstLine.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(record.text) as unknown;

    if (!isPlainRecord(parsed)) {
      return null;
    }

    const fields = flattenObject(parsed);
    return createEvent(
      record,
      "json",
      fields,
      resolveEventAliases(fields, aliases, aliasPresetId),
      inheritedIssues,
      source,
      aliasOverrides,
    );
  } catch {
    inheritedIssues.push(
      createIssue("json_parse_failed", "JSON으로 보이는 입력을 파싱하지 못했습니다.", {
        hint: "따옴표, 쉼표, 중괄호가 유효한 JSON인지 확인하세요.",
      }),
      createIssue("structured_parse_fallback", "구조화 파싱 실패 후 다른 포맷으로 fallback 했습니다."),
    );
    return null;
  }
}

function hasUnclosedKeyValueQuote(rawLine: string) {
  return /(?:^|\s)[A-Za-z0-9_.@-]+=(["'])(?:(?!\1).)*$/.test(rawLine);
}

function parseKeyValueEvent(
  record: RawRecord,
  inheritedIssues: ParseIssue[],
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
  aliasOverrides: LogFieldAliasOverrides,
  source?: ParseSourceMeta,
) {
  const headerLine = record.lines[0] ?? record.text;
  const fields = parseKeyValueFields(headerLine);

  if (Object.keys(fields).length === 0) {
    if (headerLine.includes("=")) {
      inheritedIssues.push(
        createIssue("key_value_partial_parse", "key=value 형태의 입력을 완전히 구조화하지 못했습니다.", {
          hint: "따옴표가 닫혔는지, 값 사이 공백이 있는지 확인하세요.",
        }),
        createIssue("structured_parse_fallback", "key=value 파싱 실패 후 plain text로 fallback 했습니다."),
      );
    }

    return null;
  }

  if (hasUnclosedKeyValueQuote(headerLine)) {
    inheritedIssues.push(createIssue("key_value_partial_parse", "일부 key=value 필드만 파싱했습니다.", {
      hint: "닫히지 않은 따옴표 때문에 뒤쪽 필드가 누락될 수 있습니다.",
    }));
  }

  const timestampMatch = headerLine.match(TIMESTAMP_PATTERN);
  const effectiveAliases = resolveEventAliases(fields, aliases, aliasPresetId);
  const fieldLookup = createFieldLookup(fields);

  if (timestampMatch && !pickField(fieldLookup, effectiveAliases.timestamp)) {
    fields.timestamp = timestampMatch[0];
  }

  const levelMatch = headerLine.match(LEVEL_PATTERN);
  if (levelMatch && !pickField(fieldLookup, effectiveAliases.level)) {
    fields.level = levelMatch[0];
  }

  return createEvent(record, "keyvalue", fields, effectiveAliases, inheritedIssues, source, aliasOverrides);
}

function parsePlainEvent(
  record: RawRecord,
  inheritedIssues: ParseIssue[],
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
  aliasOverrides: LogFieldAliasOverrides,
  source?: ParseSourceMeta,
) {
  const headerLine = record.lines[0] ?? record.text;
  const fields: LogFieldMap = {};
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

  return createEvent(
    record,
    "plain",
    fields,
    resolveEventAliases(fields, aliases, aliasPresetId),
    inheritedIssues,
    source,
    aliasOverrides,
  );
}

function looksLikeEventStart(line: string) {
  const trimmed = line.trimStart();

  return trimmed.startsWith("{")
    || TIMESTAMP_START_PATTERN.test(trimmed)
    || LEVEL_START_PATTERN.test(trimmed);
}

function isContinuationLine(line: string, hasStackContext: boolean) {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (STACK_CONTINUATION_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }

  if (EXCEPTION_LINE_PATTERN.test(trimmed) && hasStackContext) {
    return true;
  }

  return /^\s{2,}\S/.test(line) && hasStackContext;
}

function createEmptySession(sources: LogSource[] = []): ParsedLogSession {
  return {
    events: [],
    formatCounts: {
      json: 0,
      keyvalue: 0,
      plain: 0,
    },
    diagnostics: [],
    sources,
  };
}

function appendEventToSession(session: ParsedLogSession, event: LogEvent) {
  session.events.push(event);
  session.formatCounts[event.format] += 1;

  event.parseIssues.forEach((issue, index) => {
    session.diagnostics.push({
      id: `${event.id}-${issue.kind}-${index}`,
      eventId: event.id,
      kind: issue.kind,
      lineNumber: event.lineNumber,
      endLineNumber: event.endLineNumber,
      metadata: issue.metadata,
      message: issue.message,
      severity: issue.severity,
      sourceId: event.sourceId,
    });
  });
}

function createSourceEntry(source: ParseSourceMeta): LogSource {
  return {
    id: source.id,
    label: source.label,
    path: source.path,
    eventCount: 0,
    diagnosticCount: 0,
  };
}

function createRecordAccumulator(onRecord: (record: RawRecord) => void) {
  let startLineNumber = 0;
  let currentLines: string[] = [];
  let hasStackContext = false;

  function flushRecord() {
    if (currentLines.length === 0) {
      return;
    }

    onRecord({
      startLineNumber,
      endLineNumber: startLineNumber + currentLines.length - 1,
      lines: [...currentLines],
      text: currentLines.join("\n"),
    });
    currentLines = [];
    startLineNumber = 0;
    hasStackContext = false;
  }

  function startRecord(line: string, lineNumber: number) {
    startLineNumber = lineNumber;
    currentLines = [line];
    hasStackContext = lineLooksLikeStackContext(line);
  }

  function pushLine(rawLine: string, lineNumber: number) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      if (currentLines.length > 0 && hasStackContext) {
        currentLines.push("");
      }

      return;
    }

    if (currentLines.length === 0) {
      startRecord(line, lineNumber);
      return;
    }

    if (isContinuationLine(line, hasStackContext)) {
      currentLines.push(line);
      hasStackContext = hasStackContext || lineLooksLikeStackContext(line);
      return;
    }

    if (looksLikeEventStart(line)) {
      flushRecord();
      startRecord(line, lineNumber);
      return;
    }

    flushRecord();
    startRecord(line, lineNumber);
  }

  return {
    finish: flushRecord,
    pushLine,
  };
}

function updateSourceCounts(session: ParsedLogSession) {
  if (session.sources[0]) {
    session.sources[0].eventCount = session.events.length;
    session.sources[0].diagnosticCount = session.diagnostics.length;
  }
}

function createSessionAccumulator(
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
  aliasOverrides: LogFieldAliasOverrides,
  source?: ParseSourceMeta,
) {
  const session = createEmptySession(source ? [createSourceEntry(source)] : []);
  const accumulator = createRecordAccumulator((record) => {
    appendEventToSession(session, parseLogRecord(record, aliases, aliasPresetId, aliasOverrides, source));
  });

  return {
    pushLine: accumulator.pushLine,
    finish() {
      accumulator.finish();
      updateSourceCounts(session);
      return session;
    },
    session,
  };
}

function forEachContentLine(content: string, onLine: (line: string, lineNumber: number) => void) {
  let lineNumber = 1;
  let lineStart = 0;

  for (let index = 0; index < content.length; index += 1) {
    const currentChar = content.charCodeAt(index);

    if (currentChar !== 10 && currentChar !== 13) {
      continue;
    }

    onLine(content.slice(lineStart, index), lineNumber);
    lineNumber += 1;

    if (currentChar === 13 && content.charCodeAt(index + 1) === 10) {
      index += 1;
    }

    lineStart = index + 1;
  }

  if (
    content.length === 0
    || lineStart < content.length
    || content.endsWith("\n")
    || content.endsWith("\r")
  ) {
    onLine(content.slice(lineStart), lineNumber);
  }
}

function parseLogRecord(
  record: RawRecord,
  aliases: LogFieldAliases,
  aliasPresetId: LogAliasPresetId,
  aliasOverrides: LogFieldAliasOverrides,
  source?: ParseSourceMeta,
) {
  const inheritedIssues: ParseIssue[] = [];

  return parseJsonEvent(record, inheritedIssues, aliases, aliasPresetId, aliasOverrides, source)
    ?? parseKeyValueEvent(record, inheritedIssues, aliases, aliasPresetId, aliasOverrides, source)
    ?? parsePlainEvent(record, inheritedIssues, aliases, aliasPresetId, aliasOverrides, source);
}

export function parseLogLine(rawLine: string, lineNumber: number, options: ParseLogOptions = {}) {
  const aliasPresetId = options.aliasPresetId ?? "auto";
  const aliases = buildLogFieldAliases(aliasPresetId, options.aliasOverrides);
  const normalizedLine = rawLine.trimEnd();

  return parseLogRecord({
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    lines: [normalizedLine],
    text: normalizedLine,
  }, aliases, aliasPresetId, options.aliasOverrides ?? {}, options.source);
}

export function parseLogContent(content: string, options: ParseLogOptions = {}): ParsedLogSession {
  const aliasPresetId = options.aliasPresetId ?? "auto";
  const aliases = buildLogFieldAliases(aliasPresetId, options.aliasOverrides);
  const sessionAccumulator = createSessionAccumulator(aliases, aliasPresetId, options.aliasOverrides ?? {}, options.source);

  forEachContentLine(content, sessionAccumulator.pushLine);
  return sessionAccumulator.finish();
}

export async function parseLogLineStream(
  lines: AsyncIterable<string>,
  options: {
    aliasOverrides?: LogFieldAliasOverrides;
    aliasPresetId?: LogAliasPresetId;
    onProgress?: (progress: ParserProgress) => void;
    reportInterval?: number;
    source?: ParseSourceMeta;
  } = {},
): Promise<ParsedLogSession> {
  const aliasPresetId = options.aliasPresetId ?? "auto";
  const aliases = buildLogFieldAliases(aliasPresetId, options.aliasOverrides);
  const sessionAccumulator = createSessionAccumulator(aliases, aliasPresetId, options.aliasOverrides ?? {}, options.source);
  const reportInterval = options.reportInterval ?? 1000;
  let lineCount = 0;

  for await (const line of lines) {
    lineCount += 1;
    sessionAccumulator.pushLine(line, lineCount);

    if (options.onProgress && lineCount % reportInterval === 0) {
      options.onProgress({
        lineCount,
        eventCount: sessionAccumulator.session.events.length,
        diagnosticCount: sessionAccumulator.session.diagnostics.length,
      });
    }
  }

  const session = sessionAccumulator.finish();
  options.onProgress?.({
    lineCount,
    eventCount: session.events.length,
    diagnosticCount: session.diagnostics.length,
  });

  return session;
}

function compareMergedEvents(left: LogEvent, right: LogEvent) {
  const leftTime = left.timestampMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.timestampMs ?? Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.sourceLabel !== right.sourceLabel) {
    return left.sourceLabel.localeCompare(right.sourceLabel);
  }

  if (left.lineNumber !== right.lineNumber) {
    return left.lineNumber - right.lineNumber;
  }

  return left.id.localeCompare(right.id);
}

export function mergeParsedSessions(sessions: ParsedLogSession[]): ParsedLogSession {
  const merged = createEmptySession();

  for (const session of sessions) {
    merged.events.push(...session.events);
    merged.diagnostics.push(...session.diagnostics);
    merged.sources.push(...session.sources);
    merged.formatCounts.json += session.formatCounts.json;
    merged.formatCounts.keyvalue += session.formatCounts.keyvalue;
    merged.formatCounts.plain += session.formatCounts.plain;
  }

  merged.events.sort(compareMergedEvents);
  merged.diagnostics.sort((left, right) => (
    left.lineNumber - right.lineNumber
    || left.endLineNumber - right.endLineNumber
    || left.id.localeCompare(right.id)
  ));

  return merged;
}

export type { ParserProgress };
