export type EventStreamBuiltinColumnId =
  | "time"
  | "level"
  | "source"
  | "service"
  | "trace"
  | "request"
  | "message";

export type EventStreamColumn = {
  id: string;
  label: string;
  minWidth: number;
  template: string;
  kind: "builtin" | "field";
  fieldKey?: string;
};

type EventStreamBuiltinColumnDefinition = EventStreamColumn & {
  id: EventStreamBuiltinColumnId;
  kind: "builtin";
};

const FIELD_COLUMN_TEMPLATE = "minmax(160px, 0.95fr)";
const FIELD_COLUMN_MIN_WIDTH = 160;

export const EVENT_STREAM_BUILTIN_COLUMNS: EventStreamBuiltinColumnDefinition[] = [
  { id: "time", kind: "builtin", label: "Time", minWidth: 112, template: "minmax(96px, 120px)" },
  { id: "level", kind: "builtin", label: "Level", minWidth: 96, template: "minmax(88px, 110px)" },
  { id: "source", kind: "builtin", label: "Source", minWidth: 152, template: "minmax(132px, 168px)" },
  { id: "service", kind: "builtin", label: "Service", minWidth: 152, template: "minmax(128px, 168px)" },
  { id: "trace", kind: "builtin", label: "Trace", minWidth: 176, template: "minmax(160px, 200px)" },
  { id: "request", kind: "builtin", label: "Request", minWidth: 176, template: "minmax(160px, 200px)" },
  { id: "message", kind: "builtin", label: "Message", minWidth: 320, template: "minmax(280px, 1.8fr)" },
];

export const DEFAULT_EVENT_STREAM_COLUMNS: EventStreamBuiltinColumnId[] = ["time", "level", "service", "message"];

const EVENT_STREAM_COLUMN_ORDER = EVENT_STREAM_BUILTIN_COLUMNS.map((column) => column.id);

function unique(values: string[]) {
  return [...new Set(values)];
}

export function normalizeBuiltinEventStreamColumns(
  columnIds: EventStreamBuiltinColumnId[],
  pinnedFieldColumns: string[] = [],
) {
  const selectedColumnIds = new Set(columnIds);
  const ordered = EVENT_STREAM_COLUMN_ORDER.filter((columnId) => selectedColumnIds.has(columnId));

  if (ordered.length === 0 && pinnedFieldColumns.length === 0) {
    return ["message"] satisfies EventStreamBuiltinColumnId[];
  }

  return ordered;
}

export function buildEventStreamColumns(
  builtinColumnIds: EventStreamBuiltinColumnId[],
  pinnedFieldColumns: string[],
) {
  const normalizedBuiltins = normalizeBuiltinEventStreamColumns(builtinColumnIds, pinnedFieldColumns);
  const builtinColumnSet = new Set(normalizedBuiltins);
  const builtinColumns = EVENT_STREAM_BUILTIN_COLUMNS.filter((column) => builtinColumnSet.has(column.id));
  const messageColumn = builtinColumns.find((column) => column.id === "message") ?? null;
  const leadingBuiltinColumns = builtinColumns.filter((column) => column.id !== "message");
  const fieldColumns = unique(pinnedFieldColumns).map((fieldKey) => ({
    fieldKey,
    id: `field:${fieldKey}`,
    kind: "field" as const,
    label: fieldKey,
    minWidth: FIELD_COLUMN_MIN_WIDTH,
    template: FIELD_COLUMN_TEMPLATE,
  }));

  return [
    ...leadingBuiltinColumns,
    ...fieldColumns,
    ...(messageColumn ? [messageColumn] : []),
  ] satisfies EventStreamColumn[];
}

export function getEventStreamGridTemplate(columns: EventStreamColumn[]) {
  return columns.map((column) => column.template).join(" ");
}

export function getEventStreamMinWidth(columns: EventStreamColumn[]) {
  return columns.reduce((sum, column) => sum + column.minWidth, 0);
}
