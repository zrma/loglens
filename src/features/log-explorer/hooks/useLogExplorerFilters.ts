import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  type AnalysisDrillDownFilter,
  getAnalysisDrillDownId,
  upsertAnalysisDrillDownFilter,
} from "@/features/log-explorer/analysis-drill-down";
import type { FieldFilter, LogFilters, LogLevel } from "@/lib/logs/types";

type SharedLogFilters = Omit<LogFilters, "fieldFilters">;

export function useLogExplorerFilters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [traceFilter, setTraceFilter] = useState<string | "all">("all");
  const [requestFilter, setRequestFilter] = useState<string | "all">("all");
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);
  const [facetFieldKey, setFacetFieldKey] = useState<string | "all">("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [analysisDrillDownFilters, setAnalysisDrillDownFilters] = useState<AnalysisDrillDownFilter[]>([]);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setLevelFilter("all");
    setSourceFilter("all");
    setServiceFilter("all");
    setTraceFilter("all");
    setRequestFilter("all");
    setFieldFilters([]);
    setFacetFieldKey("all");
    setIssuesOnly(false);
    setAnalysisDrillDownFilters([]);
  }, []);

  const addFieldFilter = useCallback((fieldKey: string, fieldValue: string, operator: FieldFilter["operator"] = "include") => {
    setFieldFilters((current) => {
      const next = current.filter((filter) => filter.key !== fieldKey);
      return [...next, { key: fieldKey, value: fieldValue, operator }];
    });
    setFacetFieldKey(fieldKey);
  }, []);

  const removeFieldFilter = useCallback((fieldKey: string) => {
    setFieldFilters((current) => current.filter((filter) => filter.key !== fieldKey));
  }, []);

  const clearFieldFilters = useCallback(() => {
    setFieldFilters([]);
  }, []);

  const applyAnalysisDrillDownFilter = useCallback((filter: AnalysisDrillDownFilter) => {
    setAnalysisDrillDownFilters((current) => upsertAnalysisDrillDownFilter(current, filter));
  }, []);

  const removeAnalysisDrillDownFilter = useCallback((filter: AnalysisDrillDownFilter) => {
    const filterId = getAnalysisDrillDownId(filter);
    setAnalysisDrillDownFilters((current) => (
      current.filter((currentFilter) => getAnalysisDrillDownId(currentFilter) !== filterId)
    ));
  }, []);

  const clearAnalysisDrillDownFilters = useCallback(() => {
    setAnalysisDrillDownFilters([]);
  }, []);

  const sharedFilters = useMemo<SharedLogFilters>(() => ({
    searchTerm: deferredSearchTerm,
    level: levelFilter,
    source: sourceFilter,
    service: serviceFilter,
    traceId: traceFilter,
    requestId: requestFilter,
    issuesOnly,
  }), [deferredSearchTerm, issuesOnly, levelFilter, requestFilter, serviceFilter, sourceFilter, traceFilter]);

  return {
    analysisDrillDownFilters,
    applyAnalysisDrillDownFilter,
    clearAnalysisDrillDownFilters,
    clearFieldFilters,
    deferredSearchTerm,
    facetFieldKey,
    fieldFilters,
    issuesOnly,
    levelFilter,
    removeAnalysisDrillDownFilter,
    removeFieldFilter,
    requestFilter,
    resetFilters,
    searchTerm,
    serviceFilter,
    setFacetFieldKey,
    setIssuesOnly,
    setLevelFilter,
    setRequestFilter,
    setSearchTerm,
    setServiceFilter,
    setSourceFilter,
    setTraceFilter,
    addFieldFilter,
    sharedFilters,
    sourceFilter,
    traceFilter,
  };
}
