import {
  type AnalysisDrillDownFilter,
  getAnalysisDrillDownId,
} from "@/features/log-explorer/analysis-drill-down";
import {
  DEFAULT_EVENT_STREAM_COLUMNS,
  EVENT_STREAM_BUILTIN_COLUMNS,
  normalizeBuiltinEventStreamColumns,
  type EventStreamBuiltinColumnId,
} from "@/features/log-explorer/event-stream-columns";
import {
  CANONICAL_LOG_ALIAS_FIELDS,
  LOG_ALIAS_PRESETS,
  type CanonicalLogAliasField,
  type LogAliasPresetId,
  type LogFieldAliasOverrides,
} from "@/lib/logs/aliases";
import {
  isLogLevel,
  type FieldFilter,
  type LogLevel,
  type ParsedLogSession,
} from "@/lib/logs/types";

export const LOG_LENS_SESSION_SNAPSHOT_SCHEMA = "loglens.sessionSnapshot";
export const LOG_LENS_SESSION_SNAPSHOT_VERSION = 1;

type ActiveTabId = "events" | "analysis";

export type LogExplorerFilterSnapshot = {
  analysisDrillDownFilters: AnalysisDrillDownFilter[];
  facetFieldKey: string;
  fieldFilters: FieldFilter[];
  issuesOnly: boolean;
  levelFilter: LogLevel | "all";
  requestFilter: string | "all";
  searchTerm: string;
  serviceFilter: string | "all";
  sourceFilter: string | "all";
  traceFilter: string | "all";
};

export type LogExplorerViewSnapshot = {
  activeTab: ActiveTabId;
  eventStreamBuiltinColumns: EventStreamBuiltinColumnId[];
  hiddenFieldKeys: string[];
  pinnedEventFieldColumns: string[];
  selectedEventId: string | null;
};

export type SessionSnapshotSourceSignature = {
  diagnosticCount: number;
  eventCount: number;
  sourceCount: number;
  sources: Array<{
    diagnosticCount: number;
    eventCount: number;
    label: string;
  }>;
  timeRange: {
    endMs: number | null;
    startMs: number | null;
  };
};

export type LogSessionSnapshot = {
  aliasOverrides: LogFieldAliasOverrides;
  createdAt: string;
  filters: LogExplorerFilterSnapshot;
  parserPresetId: LogAliasPresetId;
  schema: typeof LOG_LENS_SESSION_SNAPSHOT_SCHEMA;
  sourceSignature: SessionSnapshotSourceSignature;
  version: typeof LOG_LENS_SESSION_SNAPSHOT_VERSION;
  view: LogExplorerViewSnapshot;
};

export type BuildLogSessionSnapshotInput = {
  activeTab: string;
  aliasOverrides: LogFieldAliasOverrides;
  analysisDrillDownFilters: AnalysisDrillDownFilter[];
  eventStreamBuiltinColumns: EventStreamBuiltinColumnId[];
  facetFieldKey: string;
  fieldFilters: FieldFilter[];
  hiddenFieldKeys: string[];
  issuesOnly: boolean;
  levelFilter: LogLevel | "all";
  parserPresetId: LogAliasPresetId;
  pinnedEventFieldColumns: string[];
  requestFilter: string | "all";
  searchTerm: string;
  selectedEventId: string | null;
  serviceFilter: string | "all";
  session: ParsedLogSession;
  sourceFilter: string | "all";
  traceFilter: string | "all";
};

export type SessionSnapshotParseResult =
  | { ok: true; snapshot: LogSessionSnapshot }
  | { ok: false; error: string };

export type SessionSnapshotCompatibility = {
  level: "match" | "warning";
  messages: string[];
};

const EVENT_STREAM_BUILTIN_COLUMN_IDS = new Set<string>(
  EVENT_STREAM_BUILTIN_COLUMNS.map((column) => column.id),
);
const LOG_ALIAS_PRESET_IDS = new Set<string>(LOG_ALIAS_PRESETS.map((preset) => preset.id));
const CANONICAL_LOG_ALIAS_FIELD_SET = new Set<string>(CANONICAL_LOG_ALIAS_FIELDS);
const ANALYSIS_DRILL_DOWN_KIND_SET = new Set<string>([
  "hourBucket",
  "level",
  "service",
  "request",
  "diagnostic",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeAliasOverrides(value: LogFieldAliasOverrides) {
  const normalized: LogFieldAliasOverrides = {};

  for (const field of CANONICAL_LOG_ALIAS_FIELDS) {
    const aliases = uniqueStrings(value[field] ?? []);

    if (aliases.length > 0) {
      normalized[field] = aliases;
    }
  }

  return normalized;
}

function parseAliasOverrides(value: unknown): LogFieldAliasOverrides | null {
  if (!isRecord(value)) {
    return null;
  }

  const overrides: LogFieldAliasOverrides = {};

  for (const [field, aliases] of Object.entries(value)) {
    if (!CANONICAL_LOG_ALIAS_FIELD_SET.has(field) || !isStringArray(aliases)) {
      return null;
    }

    const normalizedAliases = uniqueStrings(aliases);

    if (normalizedAliases.length > 0) {
      overrides[field as CanonicalLogAliasField] = normalizedAliases;
    }
  }

  return overrides;
}

function parseLogLevelFilter(value: unknown): LogLevel | "all" | null {
  if (value === "all") {
    return "all";
  }

  return typeof value === "string" && isLogLevel(value) ? value : null;
}

function parseStringFilter(value: unknown): string | "all" | null {
  return typeof value === "string" ? value : null;
}

function parseFieldFilters(value: unknown): FieldFilter[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const filters: FieldFilter[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    if (typeof item.key !== "string" || typeof item.value !== "string") {
      return null;
    }

    if (item.operator !== "include" && item.operator !== "exclude") {
      return null;
    }

    filters.push({
      key: item.key,
      operator: item.operator,
      value: item.value,
    });
  }

  return filters;
}

function parseAnalysisDrillDownFilters(value: unknown): AnalysisDrillDownFilter[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const filters: AnalysisDrillDownFilter[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item) || typeof item.kind !== "string" || typeof item.value !== "string") {
      return null;
    }

    if (!ANALYSIS_DRILL_DOWN_KIND_SET.has(item.kind)) {
      return null;
    }

    const filter = {
      kind: item.kind,
      value: item.value,
    } as AnalysisDrillDownFilter;
    const filterId = getAnalysisDrillDownId(filter);

    if (!seen.has(filterId)) {
      filters.push(filter);
      seen.add(filterId);
    }
  }

  return filters;
}

function parseFilters(value: unknown): LogExplorerFilterSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const levelFilter = parseLogLevelFilter(value.levelFilter);
  const sourceFilter = parseStringFilter(value.sourceFilter);
  const serviceFilter = parseStringFilter(value.serviceFilter);
  const traceFilter = parseStringFilter(value.traceFilter);
  const requestFilter = parseStringFilter(value.requestFilter);
  const fieldFilters = parseFieldFilters(value.fieldFilters);
  const analysisDrillDownFilters = parseAnalysisDrillDownFilters(value.analysisDrillDownFilters);

  if (
    typeof value.searchTerm !== "string"
    || levelFilter === null
    || sourceFilter === null
    || serviceFilter === null
    || traceFilter === null
    || requestFilter === null
    || fieldFilters === null
    || typeof value.facetFieldKey !== "string"
    || typeof value.issuesOnly !== "boolean"
    || analysisDrillDownFilters === null
  ) {
    return null;
  }

  return {
    analysisDrillDownFilters,
    facetFieldKey: value.facetFieldKey,
    fieldFilters,
    issuesOnly: value.issuesOnly,
    levelFilter,
    requestFilter,
    searchTerm: value.searchTerm,
    serviceFilter,
    sourceFilter,
    traceFilter,
  };
}

function parseBuiltinColumns(value: unknown, pinnedFieldColumns: string[]): EventStreamBuiltinColumnId[] | null {
  if (!isStringArray(value) || !value.every((columnId) => EVENT_STREAM_BUILTIN_COLUMN_IDS.has(columnId))) {
    return null;
  }

  return normalizeBuiltinEventStreamColumns(value as EventStreamBuiltinColumnId[], pinnedFieldColumns);
}

function parseView(value: unknown): LogExplorerViewSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.activeTab !== "events" && value.activeTab !== "analysis") {
    return null;
  }

  if (typeof value.selectedEventId !== "string" && value.selectedEventId !== null) {
    return null;
  }

  const pinnedEventFieldColumns = isStringArray(value.pinnedEventFieldColumns)
    ? uniqueStrings(value.pinnedEventFieldColumns)
    : null;
  const hiddenFieldKeys = isStringArray(value.hiddenFieldKeys)
    ? uniqueStrings(value.hiddenFieldKeys)
    : null;

  if (pinnedEventFieldColumns === null || hiddenFieldKeys === null) {
    return null;
  }

  const eventStreamBuiltinColumns = parseBuiltinColumns(
    value.eventStreamBuiltinColumns,
    pinnedEventFieldColumns,
  );

  if (eventStreamBuiltinColumns === null) {
    return null;
  }

  return {
    activeTab: value.activeTab,
    eventStreamBuiltinColumns,
    hiddenFieldKeys,
    pinnedEventFieldColumns,
    selectedEventId: value.selectedEventId,
  };
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseSourceSignature(value: unknown): SessionSnapshotSourceSignature | null {
  if (!isRecord(value) || !Array.isArray(value.sources) || !isRecord(value.timeRange)) {
    return null;
  }

  if (
    typeof value.sourceCount !== "number"
    || typeof value.eventCount !== "number"
    || typeof value.diagnosticCount !== "number"
    || !isNumberOrNull(value.timeRange.startMs)
    || !isNumberOrNull(value.timeRange.endMs)
  ) {
    return null;
  }

  const sources: SessionSnapshotSourceSignature["sources"] = [];

  for (const source of value.sources) {
    if (
      !isRecord(source)
      || typeof source.label !== "string"
      || typeof source.eventCount !== "number"
      || typeof source.diagnosticCount !== "number"
    ) {
      return null;
    }

    sources.push({
      diagnosticCount: source.diagnosticCount,
      eventCount: source.eventCount,
      label: source.label,
    });
  }

  return {
    diagnosticCount: value.diagnosticCount,
    eventCount: value.eventCount,
    sourceCount: value.sourceCount,
    sources,
    timeRange: {
      endMs: value.timeRange.endMs,
      startMs: value.timeRange.startMs,
    },
  };
}

export function buildSessionSourceSignature(session: ParsedLogSession): SessionSnapshotSourceSignature {
  const timestamps = session.events
    .map((event) => event.timestampMs)
    .filter((timestampMs): timestampMs is number => timestampMs !== null);

  return {
    diagnosticCount: session.diagnostics.length,
    eventCount: session.events.length,
    sourceCount: session.sources.length,
    sources: session.sources.map((source) => ({
      diagnosticCount: source.diagnosticCount,
      eventCount: source.eventCount,
      label: source.label,
    })),
    timeRange: {
      endMs: timestamps.length > 0 ? Math.max(...timestamps) : null,
      startMs: timestamps.length > 0 ? Math.min(...timestamps) : null,
    },
  };
}

export function buildLogSessionSnapshot({
  activeTab,
  aliasOverrides,
  analysisDrillDownFilters,
  eventStreamBuiltinColumns,
  facetFieldKey,
  fieldFilters,
  hiddenFieldKeys,
  issuesOnly,
  levelFilter,
  parserPresetId,
  pinnedEventFieldColumns,
  requestFilter,
  searchTerm,
  selectedEventId,
  serviceFilter,
  session,
  sourceFilter,
  traceFilter,
}: BuildLogSessionSnapshotInput): LogSessionSnapshot {
  const normalizedPinnedFieldColumns = uniqueStrings(pinnedEventFieldColumns);

  return {
    aliasOverrides: normalizeAliasOverrides(aliasOverrides),
    createdAt: new Date().toISOString(),
    filters: {
      analysisDrillDownFilters: [...analysisDrillDownFilters],
      facetFieldKey,
      fieldFilters: fieldFilters.map((filter) => ({ ...filter })),
      issuesOnly,
      levelFilter,
      requestFilter,
      searchTerm,
      serviceFilter,
      sourceFilter,
      traceFilter,
    },
    parserPresetId,
    schema: LOG_LENS_SESSION_SNAPSHOT_SCHEMA,
    sourceSignature: buildSessionSourceSignature(session),
    version: LOG_LENS_SESSION_SNAPSHOT_VERSION,
    view: {
      activeTab: activeTab === "analysis" ? "analysis" : "events",
      eventStreamBuiltinColumns: normalizeBuiltinEventStreamColumns(
        eventStreamBuiltinColumns,
        normalizedPinnedFieldColumns,
      ),
      hiddenFieldKeys: uniqueStrings(hiddenFieldKeys),
      pinnedEventFieldColumns: normalizedPinnedFieldColumns,
      selectedEventId,
    },
  };
}

export function parseLogSessionSnapshot(value: unknown): SessionSnapshotParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "snapshot JSON object가 아닙니다." };
  }

  if (value.schema !== LOG_LENS_SESSION_SNAPSHOT_SCHEMA) {
    return { ok: false, error: "지원하지 않는 snapshot schema입니다." };
  }

  if (value.version !== LOG_LENS_SESSION_SNAPSHOT_VERSION) {
    return { ok: false, error: "지원하지 않는 snapshot version입니다." };
  }

  if (typeof value.createdAt !== "string") {
    return { ok: false, error: "snapshot 생성 시간이 올바르지 않습니다." };
  }

  if (typeof value.parserPresetId !== "string" || !LOG_ALIAS_PRESET_IDS.has(value.parserPresetId)) {
    return { ok: false, error: "snapshot parser preset이 올바르지 않습니다." };
  }

  const aliasOverrides = parseAliasOverrides(value.aliasOverrides);
  const filters = parseFilters(value.filters);
  const view = parseView(value.view);
  const sourceSignature = parseSourceSignature(value.sourceSignature);

  if (aliasOverrides === null) {
    return { ok: false, error: "snapshot alias override 형식이 올바르지 않습니다." };
  }

  if (filters === null) {
    return { ok: false, error: "snapshot filter 형식이 올바르지 않습니다." };
  }

  if (view === null) {
    return { ok: false, error: "snapshot view 형식이 올바르지 않습니다." };
  }

  if (sourceSignature === null) {
    return { ok: false, error: "snapshot source signature 형식이 올바르지 않습니다." };
  }

  return {
    ok: true,
    snapshot: {
      aliasOverrides,
      createdAt: value.createdAt,
      filters,
      parserPresetId: value.parserPresetId as LogAliasPresetId,
      schema: LOG_LENS_SESSION_SNAPSHOT_SCHEMA,
      sourceSignature,
      version: LOG_LENS_SESSION_SNAPSHOT_VERSION,
      view,
    },
  };
}

export function parseLogSessionSnapshotText(text: string): SessionSnapshotParseResult {
  try {
    return parseLogSessionSnapshot(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: "snapshot JSON을 파싱할 수 없습니다." };
  }
}

export function stringifyLogSessionSnapshot(snapshot: LogSessionSnapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function compareSessionSnapshotCompatibility(
  session: ParsedLogSession,
  snapshot: LogSessionSnapshot,
): SessionSnapshotCompatibility {
  const currentSignature = buildSessionSourceSignature(session);
  const messages: string[] = [];

  if (currentSignature.sourceCount !== snapshot.sourceSignature.sourceCount) {
    messages.push(
      `소스 수가 다릅니다. 현재 ${currentSignature.sourceCount}개, snapshot ${snapshot.sourceSignature.sourceCount}개입니다.`,
    );
  }

  if (currentSignature.eventCount !== snapshot.sourceSignature.eventCount) {
    messages.push(
      `이벤트 수가 다릅니다. 현재 ${currentSignature.eventCount}개, snapshot ${snapshot.sourceSignature.eventCount}개입니다.`,
    );
  }

  const currentSourceLabels = currentSignature.sources.map((source) => source.label).join(", ");
  const snapshotSourceLabels = snapshot.sourceSignature.sources.map((source) => source.label).join(", ");

  if (currentSourceLabels !== snapshotSourceLabels) {
    messages.push("소스 label 구성이 snapshot과 다릅니다.");
  }

  return {
    level: messages.length > 0 ? "warning" : "match",
    messages,
  };
}

export function createEmptyLogExplorerFilterSnapshot(): LogExplorerFilterSnapshot {
  return {
    analysisDrillDownFilters: [],
    facetFieldKey: "all",
    fieldFilters: [],
    issuesOnly: false,
    levelFilter: "all",
    requestFilter: "all",
    searchTerm: "",
    serviceFilter: "all",
    sourceFilter: "all",
    traceFilter: "all",
  };
}

export function createDefaultLogExplorerViewSnapshot(): LogExplorerViewSnapshot {
  return {
    activeTab: "events",
    eventStreamBuiltinColumns: [...DEFAULT_EVENT_STREAM_COLUMNS],
    hiddenFieldKeys: [],
    pinnedEventFieldColumns: [],
    selectedEventId: null,
  };
}
