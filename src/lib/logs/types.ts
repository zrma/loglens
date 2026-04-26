export const LOG_LEVEL_VALUES = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "unknown",
] as const;

export type LogLevel = (typeof LOG_LEVEL_VALUES)[number];

export const PARSED_LOG_FORMAT_VALUES = ["json", "keyvalue", "plain"] as const;

export type ParsedLogFormat = (typeof PARSED_LOG_FORMAT_VALUES)[number];

export const PARSE_ISSUE_KIND_VALUES = [
  "alias_override_applied",
  "correlation_field_missing",
  "field_collision",
  "json_parse_failed",
  "key_value_partial_parse",
  "multiline_merged",
  "structured_parse_fallback",
  "timestamp_missing",
  "timestamp_parse_failed",
] as const;

export type ParseIssueKind = (typeof PARSE_ISSUE_KIND_VALUES)[number];

export const PARSER_DIAGNOSTIC_SEVERITY_VALUES = [
  "info",
  "warning",
  "error",
] as const;

export type ParserDiagnosticSeverity = (typeof PARSER_DIAGNOSTIC_SEVERITY_VALUES)[number];

export type LogFieldMap = Record<string, string>;

export type LogSourceRef = Pick<LogSource, "id" | "label" | "path">;

const LOG_LEVEL_SET = new Set<string>(LOG_LEVEL_VALUES);
const PARSE_ISSUE_KIND_SET = new Set<string>(PARSE_ISSUE_KIND_VALUES);

export function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVEL_SET.has(value);
}

export function isParseIssueKind(value: string): value is ParseIssueKind {
  return PARSE_ISSUE_KIND_SET.has(value);
}

export type ParseIssue = {
  kind: ParseIssueKind;
  message: string;
  metadata?: Record<string, string | number | boolean>;
  severity: ParserDiagnosticSeverity;
};

export type ParseDiagnostic = {
  id: string;
  kind: ParseIssueKind;
  severity: ParserDiagnosticSeverity;
  sourceId?: string;
  eventId?: string;
  lineNumber: number;
  endLineNumber: number;
  message: string;
  metadata?: Record<string, string | number | boolean>;
};

export type LogSource = {
  id: string;
  label: string;
  path: string | null;
  eventCount: number;
  diagnosticCount: number;
};

export type LogEvent = {
  id: string;
  lineNumber: number;
  endLineNumber: number;
  sourceId: string;
  sourceLabel: string;
  sourcePath: string | null;
  rawLine: string;
  format: ParsedLogFormat;
  timestampMs: number | null;
  timestampText: string | null;
  level: LogLevel;
  service: string | null;
  message: string;
  traceId: string | null;
  spanId: string | null;
  parentSpanId: string | null;
  requestId: string | null;
  isMultiLine: boolean;
  parseIssues: ParseIssue[];
  fields: LogFieldMap;
};

export type ParsedLogSession = {
  events: LogEvent[];
  formatCounts: Record<ParsedLogFormat, number>;
  diagnostics: ParseDiagnostic[];
  sources: LogSource[];
};

export type FieldFilter = {
  key: string;
  value: string;
  operator: "include" | "exclude";
};

export type LogFilters = {
  searchTerm: string;
  level: LogLevel | "all";
  source: string | "all";
  service: string | "all";
  traceId: string | "all";
  requestId: string | "all";
  fieldFilters: FieldFilter[];
  issuesOnly: boolean;
};

export type TraceGroup = {
  traceId: string;
  eventIds: string[];
  services: string[];
  sources: string[];
  levels: LogLevel[];
  requestIds: string[];
  eventCount: number;
  spanCount: number;
  issueCount: number;
  startMs: number | null;
  endMs: number | null;
};

export type TraceSourceCoverage = {
  sourceId: string;
  sourceLabel: string;
  eventCount: number;
  issueCount: number;
  services: string[];
};

export type TraceDiffBasisKind = "trace" | "request" | "derivedFlow";

export type TraceDiffBasis = {
  kind: TraceDiffBasisKind;
  label: string;
  value: string;
};

export type TraceSourceDiffRow = {
  sourceId: string;
  sourceLabel: string;
  eventIds: string[];
  eventCount: number;
  issueCount: number;
  selected: boolean;
  startMs: number | null;
  endMs: number | null;
  services: string[];
  spanIds: string[];
  routes: string[];
  methods: string[];
  missingServices: string[];
  missingSpanIds: string[];
  missingRoutes: string[];
  missingMethods: string[];
};

export type TraceSourceDiff = {
  basis: TraceDiffBasis;
  eventCount: number;
  issueCount: number;
  sourceCount: number;
  services: string[];
  spanIds: string[];
  routes: string[];
  methods: string[];
  rows: TraceSourceDiffRow[];
};

export const DERIVED_FLOW_CORRELATION_KIND_VALUES = [
  "resource",
  "request",
  "trace",
] as const;

export type DerivedFlowCorrelationKind = (typeof DERIVED_FLOW_CORRELATION_KIND_VALUES)[number];

export type DerivedFlowGroup = {
  flowKey: string;
  family: string;
  routes: string[];
  methods: string[];
  resourceId: string | null;
  correlationKind: DerivedFlowCorrelationKind;
  correlationValue: string;
  services: string[];
  sources: string[];
  eventIds: string[];
  eventCount: number;
  issueCount: number;
  startMs: number | null;
  endMs: number | null;
};

export type SpanNode = {
  spanId: string;
  parentSpanId: string | null;
  depth: number;
  service: string | null;
  requestIds: string[];
  label: string;
  eventIds: string[];
  eventCount: number;
  issueCount: number;
  level: LogLevel;
  startMs: number | null;
  endMs: number | null;
  children: SpanNode[];
};

export type SpanForest = {
  roots: SpanNode[];
  orphanEvents: LogEvent[];
  totalSpans: number;
  maxDepth: number;
};
