type KpiSummaryPercentRow = {
  percent?: number | null;
};

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPercent(row: KpiSummaryPercentRow): number {
  return normalizeNumber(row.percent);
}

export function computeKpiAdverseGap(kh: number, th: number, isNegative: boolean): number {
  const target = normalizeNumber(kh);
  const achieved = normalizeNumber(th);
  const adverseGap = isNegative ? achieved - target : target - achieved;
  return Number(Math.max(0, adverseGap).toFixed(2));
}

export function sortKpiSummaryRowsByCompletion<T extends KpiSummaryPercentRow>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => getPercent(left) - getPercent(right));
}

export function filterIncompleteKpiSummaryRows<T extends KpiSummaryPercentRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => getPercent(row) < 100);
}
