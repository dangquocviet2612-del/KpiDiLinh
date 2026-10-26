import {
  computeCuocN1N3CompletionPercent,
  computeKpiCompletionPercent,
  isCuocN1N3MetricKey,
  isNegativeMetricKey,
} from "./kpi-scoring";

const CUOC_RATE_KPI_CODE = "CUOC_N1_N3_RATE";

type NumericLike = number | string | null | undefined;

export type KpiReportSourceRow = {
  ctvUser?: string | null;
  kpiCode: string;
  kpiName?: string | null;
  displayName?: string | null;
  mergeGroup?: string | null;
  khThang?: NumericLike;
  thNgay?: NumericLike;
  thLuyKe?: NumericLike;
  completionPercent?: NumericLike;
  growthPercent?: NumericLike;
  baseScore?: NumericLike;
  maxPercent?: NumericLike;
  sortOrder?: NumericLike;
  isEnabled?: NumericLike;
  isNegative?: NumericLike;
};

export type KpiReportGroupedRow = {
  ctvUser?: string | null;
  kpiCode: string;
  displayName: string;
  kpiName?: string | null;
  mergeGroup?: string | null;
  khThang: number;
  thNgay: number;
  thLuyKe: number;
  completionPercent: number;
  growthPercent?: NumericLike;
  baseScore: number;
  maxPercent: number;
  maxScore: number;
  achievedScore: number;
  sortOrder: number;
  isNegativeKpi: boolean;
  isCuocRateKpi: boolean;
};

export type KpiCalculatorRow = KpiReportGroupedRow & {
  thCurrent: number;
  thSimulated: number;
  simulatedCompletionPercent: number;
  simulatedAchievedScore: number;
  deltaScore: number;
};

function toNumber(value: NumericLike): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function scoreSingleRow(
  row: KpiReportSourceRow,
  options: { cuocTargetRatePercent: number; cuocCompletionPercent: number }
) {
  const kpiCode = String(row.kpiCode || "").trim();
  const displayName = String(row.displayName || row.kpiName || kpiCode).trim() || kpiCode;
  const mergeGroup = String(row.mergeGroup || "").trim();
  const baseScore = toNumber(row.baseScore ?? 10);
  const maxPercent = toNumber(row.maxPercent ?? 120);
  const sortOrder = toNumber(row.sortOrder ?? 0);
  const isNegativeKpi = toNumber(row.isNegative) === 1 || isNegativeMetricKey(kpiCode);
  const isCuocRateKpi = isCuocN1N3MetricKey(kpiCode) || isCuocN1N3MetricKey(displayName);

  let khThang = toNumber(row.khThang);
  let thNgay = toNumber(row.thNgay);
  let thLuyKe = toNumber(row.thLuyKe ?? row.thNgay);
  let completionPercent = toNumber(row.completionPercent);

  if (kpiCode === CUOC_RATE_KPI_CODE || isCuocRateKpi) {
    khThang = toNumber(options.cuocTargetRatePercent);
    thNgay = toNumber(options.cuocCompletionPercent);
    thLuyKe = toNumber(options.cuocCompletionPercent);
    completionPercent = computeCuocN1N3CompletionPercent(thLuyKe, { maxPercent });
  } else if (isNegativeKpi) {
    completionPercent = computeKpiCompletionPercent(khThang, thLuyKe, { isNegative: true, maxPercent });
  }

  const cappedPercent = Math.max(0, Math.min(completionPercent, maxPercent));
  const maxScore = roundTwo((baseScore * maxPercent) / 100);
  const achievedScore = roundTwo((baseScore * cappedPercent) / 100);

  return {
    ctvUser: row.ctvUser ?? null,
    kpiCode,
    displayName,
    kpiName: row.kpiName ?? null,
    mergeGroup: mergeGroup || null,
    khThang,
    thNgay,
    thLuyKe,
    completionPercent: roundTwo(completionPercent),
    growthPercent: row.growthPercent ?? 0,
    baseScore,
    maxPercent,
    maxScore,
    achievedScore,
    sortOrder,
    isNegativeKpi,
    isCuocRateKpi,
  } satisfies KpiReportGroupedRow;
}

function groupRows(rows: KpiReportGroupedRow[]): KpiReportGroupedRow[] {
  const groupedMap = new Map<string, KpiReportGroupedRow>();

  for (const row of rows) {
    const mergeGroup = String(row.mergeGroup || "").trim();
    const groupKey = mergeGroup || `single:${row.kpiCode}`;
    const groupName = mergeGroup || row.displayName || row.kpiCode;
    const existing = groupedMap.get(groupKey);

    if (!existing) {
      groupedMap.set(groupKey, {
        ...row,
        displayName: groupName,
        kpiCode: mergeGroup ? `GROUP:${mergeGroup}` : row.kpiCode,
      });
      continue;
    }

    existing.khThang = roundTwo(existing.khThang + row.khThang);
    existing.thNgay = roundTwo(existing.thNgay + row.thNgay);
    existing.thLuyKe = roundTwo(existing.thLuyKe + row.thLuyKe);
    existing.baseScore = roundTwo(existing.baseScore + row.baseScore);
    existing.maxScore = roundTwo(existing.maxScore + row.maxScore);
    existing.achievedScore = roundTwo(existing.achievedScore + row.achievedScore);
    existing.sortOrder = Math.min(existing.sortOrder, row.sortOrder);
    existing.maxPercent = Math.max(existing.maxPercent, row.maxPercent);
  }

  return Array.from(groupedMap.values())
    .map((row) => {
      const completionPercent = row.baseScore > 0 ? roundTwo((row.achievedScore / row.baseScore) * 100) : 0;
      return {
        ...row,
        completionPercent,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.kpiCode.localeCompare(b.kpiCode));
}

export function calculateKpiReportPayload(
  sourceRows: KpiReportSourceRow[],
  options: { cuocTargetRatePercent: number; cuocCompletionPercent: number }
) {
  const enabledRows = sourceRows.filter((row) => toNumber(row.isEnabled ?? 1) === 1);
  const scoredRows = enabledRows.map((row) => scoreSingleRow(row, options));
  const rows = groupRows(scoredRows);
  const totalBaseScore = roundTwo(rows.reduce((sum, row) => sum + row.baseScore, 0));
  const totalMaxScore = roundTwo(rows.reduce((sum, row) => sum + row.maxScore, 0));
  const totalAchievedScore = roundTwo(rows.reduce((sum, row) => sum + row.achievedScore, 0));

  return {
    rows,
    totalBaseScore,
    totalMaxScore,
    totalAchievedScore,
  };
}

export function createKpiCalculatorRows(rows: KpiReportGroupedRow[]): KpiCalculatorRow[] {
  return rows.map((row) => {
    const thCurrent = toNumber(row.thLuyKe ?? row.thNgay);
    return {
      ...row,
      thCurrent,
      thSimulated: thCurrent,
      simulatedCompletionPercent: row.completionPercent,
      simulatedAchievedScore: row.achievedScore,
      deltaScore: 0,
    };
  });
}

function recalculateCalculatorRow(row: KpiCalculatorRow, simulatedTh: number): KpiCalculatorRow {
  const safeTh = toNumber(simulatedTh);

  if (Math.abs(safeTh - row.thCurrent) <= 0.0001) {
    return {
      ...row,
      thSimulated: safeTh,
      simulatedCompletionPercent: row.completionPercent,
      simulatedAchievedScore: row.achievedScore,
      deltaScore: 0,
    };
  }

  const simulatedCompletionPercent = row.isCuocRateKpi
    ? computeCuocN1N3CompletionPercent(safeTh, { maxPercent: row.maxPercent })
    : computeKpiCompletionPercent(row.khThang, safeTh, {
        isNegative: row.isNegativeKpi,
        maxPercent: row.maxPercent,
      });
  const simulatedAchievedScore = roundTwo((row.baseScore * simulatedCompletionPercent) / 100);
  const deltaScore = roundTwo(simulatedAchievedScore - row.achievedScore);

  return {
    ...row,
    thSimulated: safeTh,
    simulatedCompletionPercent,
    simulatedAchievedScore,
    deltaScore,
  };
}

export function simulateKpiCalculatorRows(
  rows: KpiCalculatorRow[],
  options?: { overrides?: Record<string, NumericLike> }
) {
  const overrides = options?.overrides || {};
  const nextRows = rows.map((row) => {
    const overrideValue = Object.prototype.hasOwnProperty.call(overrides, row.kpiCode)
      ? toNumber(overrides[row.kpiCode])
      : row.thSimulated;
    return recalculateCalculatorRow(row, overrideValue);
  });

  const totalCurrentScore = roundTwo(nextRows.reduce((sum, row) => sum + row.achievedScore, 0));
  const totalSimulatedScore = roundTwo(nextRows.reduce((sum, row) => sum + row.simulatedAchievedScore, 0));
  const totalDeltaScore = roundTwo(totalSimulatedScore - totalCurrentScore);
  const totalBaseScore = roundTwo(nextRows.reduce((sum, row) => sum + row.baseScore, 0));
  const scoreDifferenceToHundred = roundTwo(totalSimulatedScore - totalBaseScore);
  const missingToHundred = roundTwo(Math.max(0, -scoreDifferenceToHundred));
  const exceededOverHundred = roundTwo(Math.max(0, scoreDifferenceToHundred));

  return {
    rows: nextRows,
    totalCurrentScore,
    totalSimulatedScore,
    totalDeltaScore,
    totalBaseScore,
    missingToHundred,
    exceededOverHundred,
  };
}
