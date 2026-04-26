import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildEventStreamColumns,
  DEFAULT_EVENT_STREAM_COLUMNS,
  normalizeBuiltinEventStreamColumns,
  type EventStreamBuiltinColumnId,
} from "@/features/log-explorer/event-stream-columns";

type FieldKeyOption = {
  label: string;
};

type UseLogExplorerViewConfigOptions = {
  fieldKeyOptions: FieldKeyOption[];
  sessionFieldKeyOptions: FieldKeyOption[];
};

export function useLogExplorerViewConfig({
  fieldKeyOptions,
  sessionFieldKeyOptions,
}: UseLogExplorerViewConfigOptions) {
  const [hiddenFieldKeys, setHiddenFieldKeys] = useState<string[]>([]);
  const [eventStreamBuiltinColumns, setEventStreamBuiltinColumns] = useState<EventStreamBuiltinColumnId[]>([...DEFAULT_EVENT_STREAM_COLUMNS]);
  const [pinnedEventFieldColumns, setPinnedEventFieldColumns] = useState<string[]>([]);

  const eventStreamColumns = useMemo(
    () => buildEventStreamColumns(eventStreamBuiltinColumns, pinnedEventFieldColumns),
    [eventStreamBuiltinColumns, pinnedEventFieldColumns],
  );

  const toggleFieldVisibility = useCallback((fieldKey: string) => {
    setHiddenFieldKeys((current) => (
      current.includes(fieldKey)
        ? current.filter((key) => key !== fieldKey)
        : [...current, fieldKey]
    ));
  }, []);

  const hideAllFieldVisibility = useCallback(() => {
    setHiddenFieldKeys(fieldKeyOptions.map(({ label }) => label));
  }, [fieldKeyOptions]);

  const resetFieldVisibility = useCallback(() => {
    setHiddenFieldKeys([]);
  }, []);

  const toggleBuiltinEventColumn = useCallback((columnId: EventStreamBuiltinColumnId) => {
    setEventStreamBuiltinColumns((current) => normalizeBuiltinEventStreamColumns(
      current.includes(columnId)
        ? current.filter((value) => value !== columnId)
        : [...current, columnId],
      pinnedEventFieldColumns,
    ));
  }, [pinnedEventFieldColumns]);

  const toggleEventFieldColumn = useCallback((fieldKey: string) => {
    setPinnedEventFieldColumns((current) => (
      current.includes(fieldKey)
        ? current.filter((value) => value !== fieldKey)
        : [...current, fieldKey]
    ));
  }, []);

  const resetEventColumns = useCallback(() => {
    setEventStreamBuiltinColumns([...DEFAULT_EVENT_STREAM_COLUMNS]);
    setPinnedEventFieldColumns([]);
  }, []);

  useEffect(() => {
    const availableFieldKeys = new Set(sessionFieldKeyOptions.map(({ label }) => label));

    setPinnedEventFieldColumns((current) => current.filter((fieldKey) => availableFieldKeys.has(fieldKey)));
  }, [sessionFieldKeyOptions]);

  return {
    eventStreamBuiltinColumns,
    eventStreamColumns,
    hiddenFieldKeys,
    hideAllFieldVisibility,
    pinnedEventFieldColumns,
    resetEventColumns,
    resetFieldVisibility,
    toggleBuiltinEventColumn,
    toggleEventFieldColumn,
    toggleFieldVisibility,
  };
}
