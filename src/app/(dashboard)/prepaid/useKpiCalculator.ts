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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<KpiReportGroupedRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const hasDataRef = useRef(false);
  const wasEnabledRef = useRef(false);
  const resolvedDateRef = useRef(onResolvedReportDate);
  const { run, cancel, reset } = useLatestKpiRequest<{ rows?: KpiReportGroupedRow[]; reportDate?: string | null }>();

  useEffect(() => {
    resolvedDateRef.current = onResolvedReportDate;
  }, [onResolvedReportDate]);

  useEffect(() => {
    reset();
    hasDataRef.current = false;
    wasEnabledRef.current = false;
    setSourceRows([]);
    setDraftValues({});
  }, [reset, scopeKey]);

  const fetchCalculator = useCallback(
    async (fetchOptions?: { force?: boolean }) => {
      if (!hasSession || !enabled || (canSelectCtv && !selectedCtv)) return;
      const ctv = canSelectCtv ? selectedCtv : "";
      const hadData = hasDataRef.current;
      return run({
        key: kpiReportRequestKey(scopeKey, ctv, reportDate),
        force: fetchOptions?.force,
        resolvedKeys: (data) => [kpiReportRequestKey(scopeKey, ctv, data.reportDate || reportDate)],
        onStart: () => {
          setErrorMessage(null);
          if (!hadData) setLoading(true);
          else setRefreshing(true);
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
          setSourceRows(nextRows);
          setDraftValues(normalizeDraftMap(nextRows));
          hasDataRef.current = true;
          setErrorMessage(null);
          if (data.reportDate && !reportDate) resolvedDateRef.current?.(String(data.reportDate));
        },
        onError: (error) => {
          const nextError = error instanceof Error ? error.message : "Không tải được dữ liệu tính KPI";
          setErrorMessage(nextError);
          toast.error(nextError);
          if (!hadData) {
            setSourceRows([]);
            setDraftValues({});
          }
        },
        onSettled: () => {
          setLoading(false);
          setRefreshing(false);
        },
      });
    },
    [canSelectCtv, enabled, hasSession, reportDate, run, scopeKey, selectedCtv]
  );

  useEffect(() => {
    if (!enabled || !hasSession) {
      cancel();
      wasEnabledRef.current = false;
      return;
    }

    const shouldForceRefresh = !wasEnabledRef.current;
    wasEnabledRef.current = true;
    void fetchCalculator(shouldForceRefresh ? { force: true } : undefined);
  }, [cancel, enabled, fetchCalculator, hasSession]);

  const calculatorRows = useMemo<KpiCalculatorRow[]>(
    () => sortKpiRowsByCompletion(createKpiCalculatorRows(sourceRows)),
    [sourceRows],
  );

  const simulation = useMemo(() => {
    const overrides = Object.entries(draftValues).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = parseKpiCalculatorNumeric(value);
      return acc;
    }, {});
    return simulateKpiCalculatorRows(calculatorRows, { overrides });
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
    setDraftValues((current) => ({
      ...current,
      [kpiCode]: stepKpiCalculatorValue(current[kpiCode] ?? "", delta),
    }));
  }, []);

  const setDraftValue = useCallback((kpiCode: string, value: string) => {
    if (!isKpiCalculatorDraftValue(value)) return;
    setDraftValues((current) => ({ ...current, [kpiCode]: value }));
  }, []);

  const setTargetValue = useCallback(
    (kpiCode: string) => {
      const row = calculatorRows.find((item) => item.kpiCode === kpiCode);
      if (!row) return;
      setDraftValues((current) => ({
        ...current,
        [kpiCode]: formatKpiCalculatorDraftValue(getKpiCalculatorTargetValue(row)),
      }));
    },
    [calculatorRows],
  );

  const resetSimulation = useCallback(() => {
    setDraftValues(normalizeDraftMap(sourceRows));
  }, [sourceRows]);

  return {
    loading,
    refreshing,
    errorMessage,
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
    dirtyCount,
    changeSummary,
    setDraftValue,
    stepDraftValue,
    setTargetValue,
    resetSimulation,
    fetchCalculator,
  };
}
