import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  createKpiCalculatorRows,
  simulateKpiCalculatorRows,
  type KpiCalculatorRow,
  type KpiReportGroupedRow,
} from "@/lib/kpi-report-calculation";
import {
  buildKpiCalculatorChangeSummary,
  formatKpiCalculatorDraftValue,
  getKpiCalculatorTargetValue,
  isKpiCalculatorDraftValue,
  parseKpiCalculatorNumeric,
  stepKpiCalculatorValue,
} from "@/lib/kpi-calculator";
import { sortKpiRowsByCompletion } from "@/lib/kpi-row-sorting";
import { kpiReportRequestKey, useLatestKpiRequest } from "@/hooks/useLatestKpiRequest";

function normalizeDraftMap(rows: KpiReportGroupedRow[]) {
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.kpiCode] = formatKpiCalculatorDraftValue(Number(row.thLuyKe ?? row.thNgay ?? 0));
    return acc;
  }, {});
}

type CalculatorContext = {
  owner: object;
  scopeKey: string;
  ctv: string;
  requestedDate: string;
  canonicalDate: string;
};

type CalculatorSnapshot = {
  context: CalculatorContext | null;
  sourceRows: KpiReportGroupedRow[];
  overrides: Record<string, string>;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
};

const emptySnapshot: CalculatorSnapshot = {
  context: null, sourceRows: [], overrides: {}, loading: true, refreshing: false, errorMessage: null,
};

function matchesContext(context: CalculatorContext | null, scopeKey: string, ctv: string, reportDate: string) {
  return context !== null && context.scopeKey === scopeKey && context.ctv === ctv &&
    (context.requestedDate === reportDate || (!context.requestedDate && context.canonicalDate === reportDate));
}

type UseKpiCalculatorOptions = {
  enabled: boolean;
  hasSession: boolean;
  canSelectCtv: boolean;
  selectedCtv: string;
  reportDate: string;
  onResolvedReportDate?: (value: string) => void;
  scopeKey?: string;
};

export default function useKpiCalculator(options: UseKpiCalculatorOptions) {
  const { enabled, hasSession, canSelectCtv, selectedCtv, reportDate, onResolvedReportDate, scopeKey = "" } = options;
  const ctv = canSelectCtv ? selectedCtv : "";
  const available = hasSession && (!canSelectCtv || Boolean(ctv));
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const contextRef = useRef<(CalculatorContext & { hasData: boolean }) | null>(null);
  const wasEnabledRef = useRef(false);
  const resolvedDateRef = useRef(onResolvedReportDate);
  const { run, cancel, reset } = useLatestKpiRequest<{ rows?: KpiReportGroupedRow[]; reportDate?: string | null }>();
  const visible = available && matchesContext(snapshot.context, scopeKey, ctv, reportDate);
  const owner = visible ? snapshot.context!.owner : null;
  const sourceRows = visible ? snapshot.sourceRows : emptySnapshot.sourceRows;
  const overrides = visible ? snapshot.overrides : emptySnapshot.overrides;
  const draftValues = useMemo(() => ({ ...normalizeDraftMap(sourceRows), ...overrides }), [sourceRows, overrides]);

  useEffect(() => {
    resolvedDateRef.current = onResolvedReportDate;
  }, [onResolvedReportDate]);

  useEffect(() => {
    const context = contextRef.current;
    if (available && matchesContext(context, scopeKey, ctv, reportDate)) {
      if (context!.requestedDate !== reportDate) {
        context!.requestedDate = reportDate;
        setSnapshot((current) => current.context?.owner === context!.owner
          ? { ...current, context: { ...current.context, requestedDate: reportDate } }
          : current);
      }
      return;
    }
    reset();
    wasEnabledRef.current = false;
    const nextContext = available ? { owner: {}, scopeKey, ctv, requestedDate: reportDate, canonicalDate: reportDate } : null;
    contextRef.current = nextContext ? { ...nextContext, hasData: false } : null;
    setSnapshot({ ...emptySnapshot, context: nextContext, loading: available });
  }, [available, ctv, reportDate, reset, scopeKey]);

  const fetchCalculator = useCallback(
    async (fetchOptions?: { force?: boolean }) => {
      const context = contextRef.current;
      if (!enabled || !available || !owner || context?.owner !== owner) return;
      const hadData = context.hasData;
      return run({
        key: kpiReportRequestKey(scopeKey, ctv, reportDate),
        force: fetchOptions?.force,
        resolvedKeys: (data) => [kpiReportRequestKey(scopeKey, ctv, data.reportDate || reportDate)],
        onStart: () => {
          setSnapshot((current) => current.context?.owner === owner
            ? { ...current, errorMessage: null, loading: !hadData, refreshing: hadData }
            : current);
        },
        load: async (signal) => {
          const params = new URLSearchParams();
          if (ctv) params.set("ctvUser", ctv);
          if (reportDate) params.set("reportDate", reportDate);
          const res = await fetch(`/api/kpi/report?${params.toString()}`, { signal });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu tính KPI");
          return data;
        },
        onSuccess: (data) => {
          const nextRows = Array.isArray(data.rows) ? data.rows : [];
          const canonicalDate = data.reportDate || reportDate;
          const preserveOverrides = !context.hasData || context.canonicalDate === canonicalDate;
          context.hasData = true;
          context.canonicalDate = canonicalDate;
          setSnapshot((current) => {
            if (current.context?.owner !== owner) return current;
            const nextOverrides = preserveOverrides ? Object.fromEntries(nextRows
              .filter((row) => Object.prototype.hasOwnProperty.call(current.overrides, row.kpiCode))
              .map((row) => [row.kpiCode, current.overrides[row.kpiCode]])) : {};
            return {
              ...current, sourceRows: nextRows, overrides: nextOverrides,
              context: { ...current.context, canonicalDate }, errorMessage: null,
            };
          });
          if (data.reportDate && !reportDate) resolvedDateRef.current?.(String(data.reportDate));
        },
        onError: (error) => {
          const nextError = error instanceof Error ? error.message : "Không tải được dữ liệu tính KPI";
          setSnapshot((current) => current.context?.owner === owner
            ? { ...current, errorMessage: nextError }
            : current);
          toast.error(nextError);
        },
        onSettled: () => {
          setSnapshot((current) => current.context?.owner === owner
            ? { ...current, loading: false, refreshing: false }
            : current);
        },
      });
    },
    [available, ctv, enabled, owner, reportDate, run, scopeKey]
  );

  useEffect(() => {
    if (!enabled || !available || !owner) {
      cancel();
      wasEnabledRef.current = false;
      return;
    }

    const shouldForceRefresh = !wasEnabledRef.current;
    wasEnabledRef.current = true;
    void fetchCalculator(shouldForceRefresh ? { force: true } : undefined);
  }, [available, cancel, enabled, fetchCalculator, owner]);

  const calculatorRows = useMemo<KpiCalculatorRow[]>(
    () => sortKpiRowsByCompletion(createKpiCalculatorRows(sourceRows)),
    [sourceRows],
  );

  const simulation = useMemo(() => {
    const numericOverrides = Object.entries(draftValues).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = parseKpiCalculatorNumeric(value);
      return acc;
    }, {});
    return simulateKpiCalculatorRows(calculatorRows, { overrides: numericOverrides });
  }, [calculatorRows, draftValues]);

  const scorePercentCurrent = useMemo(() => {
    if (!simulation.totalBaseScore) return 0;
    return Number(((simulation.totalCurrentScore / simulation.totalBaseScore) * 100).toFixed(1));
  }, [simulation.totalBaseScore, simulation.totalCurrentScore]);

  const scorePercentSimulated = useMemo(() => {
    if (!simulation.totalBaseScore) return 0;
    return Number(((simulation.totalSimulatedScore / simulation.totalBaseScore) * 100).toFixed(1));
  }, [simulation.totalBaseScore, simulation.totalSimulatedScore]);

  const dirtyCount = useMemo(
    () => simulation.rows.filter((row) => Math.abs(Number(row.deltaScore || 0)) > 0.001).length,
    [simulation.rows]
  );

  const changeSummary = useMemo(() => buildKpiCalculatorChangeSummary(simulation.rows), [simulation.rows]);

  const stepDraftValue = useCallback((kpiCode: string, delta: number) => {
    setSnapshot((current) => {
      if (!owner || current.context?.owner !== owner) return current;
      const row = current.sourceRows.find((item) => item.kpiCode === kpiCode);
      if (!row) return current;
      const currentValue = Object.prototype.hasOwnProperty.call(current.overrides, kpiCode)
        ? current.overrides[kpiCode] : normalizeDraftMap([row])[kpiCode];
      return { ...current, overrides: { ...current.overrides, [kpiCode]: stepKpiCalculatorValue(currentValue, delta) } };
    });
  }, [owner]);

  const setDraftValue = useCallback((kpiCode: string, value: string) => {
    if (!isKpiCalculatorDraftValue(value)) return;
    setSnapshot((current) => owner && current.context?.owner === owner && current.sourceRows.some((row) => row.kpiCode === kpiCode)
      ? { ...current, overrides: { ...current.overrides, [kpiCode]: value } }
      : current);
  }, [owner]);

  const setTargetValue = useCallback((kpiCode: string) => {
    setSnapshot((current) => {
      if (!owner || current.context?.owner !== owner) return current;
      const sourceRow = current.sourceRows.find((item) => item.kpiCode === kpiCode);
      if (!sourceRow) return current;
      const row = createKpiCalculatorRows([sourceRow])[0];
      return {
        ...current,
        overrides: { ...current.overrides, [kpiCode]: formatKpiCalculatorDraftValue(getKpiCalculatorTargetValue(row)) },
      };
    });
  }, [owner]);

  const resetSimulation = useCallback(() => {
    setSnapshot((current) => owner && current.context?.owner === owner ? { ...current, overrides: {} } : current);
  }, [owner]);

  return {
    loading: visible ? snapshot.loading : available,
    refreshing: visible && snapshot.refreshing,
    errorMessage: visible ? snapshot.errorMessage : null,
    rows: simulation.rows,
    totals: {
      totalBaseScore: simulation.totalBaseScore,
      totalCurrentScore: simulation.totalCurrentScore,
      totalSimulatedScore: simulation.totalSimulatedScore,
      totalDeltaScore: simulation.totalDeltaScore,
      missingToHundred: simulation.missingToHundred,
      exceededOverHundred: simulation.exceededOverHundred,
      scorePercentCurrent,
      scorePercentSimulated,
    },
    draftValues,
    hasDraftEdits: Object.keys(overrides).length > 0,
    dirtyCount,
    changeSummary,
    setDraftValue,
    stepDraftValue,
    setTargetValue,
    resetSimulation,
    fetchCalculator,
  };
}
