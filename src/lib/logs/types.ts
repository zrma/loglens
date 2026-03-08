export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "unknown";

export type ParsedLogFormat = "json" | "keyvalue" | "plain";

export type ParseIssueKind =
  | "multiline"
  | "invalid_json"
  | "timestamp_missing";

export type ParseIssue = {
  kind: ParseIssueKind;
  message: string;
};

export type ParseDiagnostic = {
  id: string;
  kind: ParseIssueKind;
  lineNumber: number;
  endLineNumber: number;
  message: string;
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
  fields: Record<string, string>;
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
  levels: LogLevel[];
  requestIds: string[];
  eventCount: number;
  spanCount: number;
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
