export const DEFAULT_KPI_MAX_PERCENT = 120;

const NEGATIVE_METRIC_ALIASES = new Set([
  "RM_FTTH_ALL",
  "RM_TH",
  "THUE BAO ROI MANG FTTH",
  "THUE BAO ROI MANG TRUYEN HINH",
  "THUE BAO ROI MANG TH",
  "TB ROI MANG FTTH",
  "TB ROI MANG TRUYEN HINH",
  "TB ROI MANG TH",
  "ROI MANG FTTH",
  "ROI MANG TRUYEN HINH",
  "ROI MANG TH",
]);

const CUOC_N1_N3_METRIC_ALIASES = new Set([
  "CUOC_N1_N3_RATE",
  "TY LE CUOC N1-N3",
  "TY LE CUOC N1 N3",
  "TY LE CUOC",
]);

export function normalizeMetricKey(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function isNegativeMetricKey(value: unknown): boolean {
  const normalized = normalizeMetricKey(value);
  return normalized ? NEGATIVE_METRIC_ALIASES.has(normalized) : false;
}

export function isCuocN1N3MetricKey(value: unknown): boolean {
  const normalized = normalizeMetricKey(value);
  return normalized ? CUOC_N1_N3_METRIC_ALIASES.has(normalized) : false;
}

function clampPercent(value: number, maxPercent: number) {
  return Math.max(0, Math.min(value, maxPercent));
}

export function computeCuocN1N3CompletionPercent(
  actualPercent: number,
  options?: { maxPercent?: number }
): number {
  const actual = Number(actualPercent || 0);
  const maxPercent = Number(options?.maxPercent ?? DEFAULT_KPI_MAX_PERCENT);

  if (actual < 94.5) return 0;
  if (actual < 95.54) return 50;
  if (actual < 97) return 80;

  const delta = actual - 97;
  // Fit the post-97 curve to the business examples:
  // 97 -> 100, 98 -> 108.2, 99 -> 116.39
  const rawPercent = 100 + 8.205 * delta - 0.005 * delta * delta;
  return Number(clampPercent(rawPercent, maxPercent).toFixed(2));
}

export function computeKpiCompletionPercent(
  kh: number,
  th: number,
  options?: { isNegative?: boolean; maxPercent?: number }
): number {
  const target = Number(kh || 0);
  const achieved = Number(th || 0);
  const isNegative = Boolean(options?.isNegative);
  const maxPercent = Number(options?.maxPercent ?? DEFAULT_KPI_MAX_PERCENT);

  if (!target) return 0;

  const rawPercent = isNegative
    ? ((2 * target - achieved) / target) * 100
    : (achieved / target) * 100;

  return Number(clampPercent(rawPercent, maxPercent).toFixed(2));
}

export function computeKpiDayCompletionPercent(
  kh: number,
  th: number,
  monthProgressPercent: number,
  options?: { isNegative?: boolean; maxPercent?: number }
): number {
  const target = Number(kh || 0);
  const achieved = Number(th || 0);
  const progress = Number(monthProgressPercent || 0);

  if (!target || !progress) return 0;

  const targetToDate = target * (progress / 100);
  if (!targetToDate) return 0;

  return computeKpiCompletionPercent(targetToDate, achieved, options);
}
