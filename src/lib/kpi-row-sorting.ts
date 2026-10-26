type KpiCompletionRow = {
  completionPercent?: number | null;
};

function getCompletionPercent(row: KpiCompletionRow): number {
  const percent = Number(row.completionPercent ?? 0);
  return Number.isFinite(percent) ? percent : 0;
}

export function sortKpiRowsByCompletion<T extends KpiCompletionRow>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => getCompletionPercent(left) - getCompletionPercent(right));
}
