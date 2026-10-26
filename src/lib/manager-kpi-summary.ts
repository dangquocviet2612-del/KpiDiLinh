type MetricWithPercent = {
  percent?: number | null;
};

type ManagerWithMetrics<TMetric extends MetricWithPercent> = {
  managerUser: string;
  metrics: readonly TMetric[];
};

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getMetricPercent(metric: MetricWithPercent): number {
  return normalizeNumber(metric.percent);
}

export function sortManagerKpiMetricsByCompletion<T extends MetricWithPercent>(metrics: readonly T[]): T[] {
  return [...metrics].sort((left, right) => getMetricPercent(left) - getMetricPercent(right));
}

export function prioritizeManagerKpiRows<TRow extends ManagerWithMetrics<MetricWithPercent>>(
  rows: readonly TRow[]
): TRow[] {
  return [...rows].sort((left, right) => {
    const leftIncomplete = left.metrics.filter((metric) => getMetricPercent(metric) < 100).length;
    const rightIncomplete = right.metrics.filter((metric) => getMetricPercent(metric) < 100).length;
    if (leftIncomplete !== rightIncomplete) return rightIncomplete - leftIncomplete;

    const leftCritical = left.metrics.filter((metric) => getMetricPercent(metric) < 70).length;
    const rightCritical = right.metrics.filter((metric) => getMetricPercent(metric) < 70).length;
    if (leftCritical !== rightCritical) return rightCritical - leftCritical;

    const leftAverage = left.metrics.length
      ? left.metrics.reduce((total, metric) => total + getMetricPercent(metric), 0) / left.metrics.length
      : 0;
    const rightAverage = right.metrics.length
      ? right.metrics.reduce((total, metric) => total + getMetricPercent(metric), 0) / right.metrics.length
      : 0;
    if (leftAverage !== rightAverage) return leftAverage - rightAverage;

    return left.managerUser.localeCompare(right.managerUser);
  });
}

export function filterIncompleteManagerKpiRows<TRow extends ManagerWithMetrics<MetricWithPercent>>(
  rows: readonly TRow[]
): TRow[] {
  return rows
    .map((row) => ({
      ...row,
      metrics: row.metrics.filter((metric) => getMetricPercent(metric) < 100),
    }))
    .filter((row) => row.metrics.length > 0) as TRow[];
}
