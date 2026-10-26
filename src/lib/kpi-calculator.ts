import type { KpiCalculatorRow } from "./kpi-report-calculation";

export type KpiCalculatorChangeSummaryItem = {
  kpiCode: string;
  displayName: string;
  thCurrent: number;
  thSimulated: number;
  deltaQuantity: number;
  deltaScore: number;
};

const CUOC_RATE_TARGET_AT_100_PERCENT = 97;

export function isKpiCalculatorDraftValue(value: string): boolean {
  return /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{0,2})?$/.test(value);
}

export function getKpiCalculatorTargetValue(row: KpiCalculatorRow): number {
  if (row.isCuocRateKpi) return CUOC_RATE_TARGET_AT_100_PERCENT;
  return Math.max(0, Number(row.khThang || 0));
}

function normalizeNumericText(value: string): string {
  return String(value || "").trim().replace(/,/g, ".").replace(/[^0-9.-]/g, "");
}

export function parseKpiCalculatorNumeric(value: string): number {
  const normalized = normalizeNumericText(value);
  if (!normalized) return 0;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatKpiCalculatorDraftValue(value: number): string {
  const numeric = Number(value || 0);
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(numeric.toFixed(2)));
}

export function applyKpiCalculatorIncrement(currentValue: string, incrementValue: string): string {
  const current = parseKpiCalculatorNumeric(currentValue);
  const increment = parseKpiCalculatorNumeric(incrementValue);
  return formatKpiCalculatorDraftValue(current + increment);
}

export function stepKpiCalculatorValue(currentValue: string, delta: number): string {
  const current = parseKpiCalculatorNumeric(currentValue);
  const nextValue = Math.max(0, current + Number(delta || 0));
  return formatKpiCalculatorDraftValue(nextValue);
}

export function buildKpiCalculatorChangeSummary(rows: KpiCalculatorRow[]): KpiCalculatorChangeSummaryItem[] {
  return rows
    .map((row) => ({
      kpiCode: row.kpiCode,
      displayName: row.displayName || row.kpiCode,
      thCurrent: Number(row.thCurrent || 0),
      thSimulated: Number(row.thSimulated || 0),
      deltaQuantity: Number(row.thSimulated || 0) - Number(row.thCurrent || 0),
      deltaScore: Number(row.deltaScore || 0),
    }))
    .filter((row) => Math.abs(row.deltaQuantity) > 0.0001)
    .sort((a, b) => {
      const deltaScoreDiff = Math.abs(b.deltaScore) - Math.abs(a.deltaScore);
      if (Math.abs(deltaScoreDiff) > 0.0001) return deltaScoreDiff;
      const deltaQuantityDiff = Math.abs(b.deltaQuantity) - Math.abs(a.deltaQuantity);
      if (Math.abs(deltaQuantityDiff) > 0.0001) return deltaQuantityDiff;
      return a.displayName.localeCompare(b.displayName, "vi");
    });
}
