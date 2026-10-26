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
};

export default function useKpiCalculator(options: UseKpiCalculatorOptions) {
  const { enabled, hasSession, canSelectCtv, selectedCtv, reportDate, onResolvedReportDate } = options;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<KpiReportGroupedRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);
  const lastKeyRef = useRef("");
  const wasEnabledRef = useRef(false);

  const fetchCalculator = useCallback(
    async (fetchOptions?: { force?: boolean }) => {
      if (!hasSession || !enabled) return;
      if (canSelectCtv && !selectedCtv) return;

      const requestKey = [selectedCtv || "", reportDate || ""].join("|");
      if (!fetchOptions?.force && hasDataRef.current && lastKeyRef.current === requestKey) {
        return;
      }

      const hadData = hasDataRef.current;
      lastKeyRef.current = requestKey;
      const reqId = ++requestRef.current;
      setErrorMessage(null);
      if (!hadData) setLoading(true);
      else setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (canSelectCtv && selectedCtv) params.set("ctvUser", selectedCtv);
        if (reportDate) params.set("reportDate", reportDate);
        const res = await fetch(`/api/kpi/report?${params.toString()}`);
        const data = await res.json();
        if (reqId !== requestRef.current) return;
        if (!res.ok) throw new Error(data?.error || "Không tải được dữ liệu tính KPI");

        const nextRows = Array.isArray(data?.rows) ? (data.rows as KpiReportGroupedRow[]) : [];
        setSourceRows(nextRows);
        setDraftValues(normalizeDraftMap(nextRows));
        hasDataRef.current = true;
        setErrorMessage(null);

        if (data?.reportDate && !reportDate) {
          onResolvedReportDate?.(String(data.reportDate));
        }
      } catch (error: any) {
        if (reqId !== requestRef.current) return;
        const nextError = error?.message || "Không tải được dữ liệu tính KPI";
        setErrorMessage(nextError);
        toast.error(nextError);
        if (!hadData) {
          setSourceRows([]);
          setDraftValues({});
        }
      } finally {
        if (reqId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canSelectCtv, enabled, hasSession, onResolvedReportDate, reportDate, selectedCtv]
  );

  useEffect(() => {
    if (!enabled || !hasSession) {
      wasEnabledRef.current = false;
      return;
    }

    const shouldForceRefresh = !wasEnabledRef.current;
    wasEnabledRef.current = true;
    void fetchCalculator(shouldForceRefresh ? { force: true } : undefined);
  }, [enabled, fetchCalculator, hasSession]);

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
