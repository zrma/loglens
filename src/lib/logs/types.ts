export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "unknown";

export type ParsedLogFormat = "json" | "keyvalue" | "plain";

export type LogEvent = {
  id: string;
  lineNumber: number;
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
  fields: Record<string, string>;
};

export type ParsedLogSession = {
  events: LogEvent[];
  formatCounts: Record<ParsedLogFormat, number>;
};

export type LogFilters = {
  searchTerm: string;
  level: LogLevel | "all";
  service: string | "all";
  traceId: string | "all";
};

export type TraceGroup = {
  traceId: string;
  eventIds: string[];
  services: string[];
  levels: LogLevel[];
  eventCount: number;
  spanCount: number;
  issueCount: number;
  startMs: number | null;
  endMs: number | null;
};
