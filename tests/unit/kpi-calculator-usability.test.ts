import { describe, expect, it } from "vitest";
import {
  getKpiCalculatorTargetValue,
  isKpiCalculatorDraftValue,
} from "@/lib/kpi-calculator";
import {
  simulateKpiCalculatorRows,
  type KpiCalculatorRow,
} from "@/lib/kpi-report-calculation";

function createRow(overrides: Partial<KpiCalculatorRow> = {}): KpiCalculatorRow {
  return {
    kpiCode: "KPI01",
    displayName: "Thuê bao mới",
    kpiName: "Thuê bao mới",
    mergeGroup: null,
    khThang: 10,
    thNgay: 8,
    thLuyKe: 8,
    completionPercent: 80,
    growthPercent: 0,
    baseScore: 10,
    maxPercent: 120,
    maxScore: 12,
    achievedScore: 8,
    sortOrder: 1,
    isNegativeKpi: false,
    isCuocRateKpi: false,
    ctvUser: "CTV_A",
    thCurrent: 8,
    thSimulated: 8,
    simulatedCompletionPercent: 80,
    simulatedAchievedScore: 8,
    deltaScore: 0,
    ...overrides,
  };
}

describe("KPI calculator usability helpers", () => {
  it("returns the TH value needed to reach 100 percent", () => {
    expect(getKpiCalculatorTargetValue(createRow({ khThang: 25 }))).toBe(25);
    expect(getKpiCalculatorTargetValue(createRow({ khThang: 6, isNegativeKpi: true }))).toBe(6);
    expect(getKpiCalculatorTargetValue(createRow({ khThang: 97.3, isCuocRateKpi: true }))).toBe(97);
  });

  it("accepts empty or non-negative values with up to two decimals", () => {
    expect(isKpiCalculatorDraftValue("")).toBe(true);
    expect(isKpiCalculatorDraftValue("12")).toBe(true);
    expect(isKpiCalculatorDraftValue("12,5")).toBe(true);
    expect(isKpiCalculatorDraftValue("0.25")).toBe(true);
    expect(isKpiCalculatorDraftValue("-1")).toBe(false);
    expect(isKpiCalculatorDraftValue("12.345")).toBe(false);
    expect(isKpiCalculatorDraftValue("abc")).toBe(false);
  });

  it("separates missing score from score above the 100-percent target", () => {
    const result = simulateKpiCalculatorRows(
      [
        createRow({
          khThang: 10,
          thCurrent: 10,
          thSimulated: 10,
          completionPercent: 100,
          simulatedCompletionPercent: 100,
          achievedScore: 10,
          simulatedAchievedScore: 10,
        }),
      ],
      { overrides: { KPI01: 12 } },
    );

    expect(result.missingToHundred).toBe(0);
    expect(result.exceededOverHundred).toBe(2);
  });
});
