import { describe, it, expect } from "vitest";
import type { KpiCalculatorRow } from "@/lib/kpi-report-calculation";
import { buildKpiCalculatorChangeSummary } from "@/lib/kpi-calculator";

describe("KPI Calculator Change Summary", () => {
  it("sorts modified rows by absolute delta score descending and excludes unchanged rows", () => {
    const rows: KpiCalculatorRow[] = [
      {
        kpiCode: "KEEP",
        displayName: "Khong doi",
        kpiName: "Khong doi",
        mergeGroup: null,
        khThang: 10,
        thNgay: 0,
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
      },
      {
        kpiCode: "PLUS_SMALL",
        displayName: "Tang nhe",
        kpiName: "Tang nhe",
        mergeGroup: null,
        khThang: 10,
        thNgay: 0,
        thLuyKe: 6,
        completionPercent: 60,
        growthPercent: 0,
        baseScore: 10,
        maxPercent: 120,
        maxScore: 12,
        achievedScore: 6,
        sortOrder: 2,
        isNegativeKpi: false,
        isCuocRateKpi: false,
        ctvUser: "CTV_A",
        thCurrent: 6,
        thSimulated: 7,
        simulatedCompletionPercent: 70,
        simulatedAchievedScore: 7,
        deltaScore: 1,
      },
      {
        kpiCode: "MINUS_BIG",
        displayName: "Giam manh",
        kpiName: "Giam manh",
        mergeGroup: null,
        khThang: 10,
        thNgay: 0,
        thLuyKe: 9,
        completionPercent: 90,
        growthPercent: 0,
        baseScore: 10,
        maxPercent: 120,
        maxScore: 12,
        achievedScore: 9,
        sortOrder: 3,
        isNegativeKpi: false,
        isCuocRateKpi: false,
        ctvUser: "CTV_A",
        thCurrent: 9,
        thSimulated: 7,
        simulatedCompletionPercent: 70,
        simulatedAchievedScore: 7,
        deltaScore: -2,
      },
      {
        kpiCode: "PLUS_BIG",
        displayName: "Tang manh",
        kpiName: "Tang manh",
        mergeGroup: null,
        khThang: 10,
        thNgay: 0,
        thLuyKe: 4,
        completionPercent: 40,
        growthPercent: 0,
        baseScore: 10,
        maxPercent: 120,
        maxScore: 12,
        achievedScore: 4,
        sortOrder: 4,
        isNegativeKpi: false,
        isCuocRateKpi: false,
        ctvUser: "CTV_A",
        thCurrent: 4,
        thSimulated: 7,
        simulatedCompletionPercent: 70,
        simulatedAchievedScore: 7,
        deltaScore: 3,
      },
    ];

    const summary = buildKpiCalculatorChangeSummary(rows);

    expect(summary.length).toBe(3);
    expect(summary[0]?.kpiCode).toBe("PLUS_BIG");
    expect(summary[0]?.deltaQuantity).toBe(3);
    expect(summary[0]?.deltaScore).toBe(3);
    expect(summary[1]?.kpiCode).toBe("MINUS_BIG");
    expect(summary[1]?.deltaQuantity).toBe(-2);
    expect(summary[1]?.deltaScore).toBe(-2);
    expect(summary[2]?.kpiCode).toBe("PLUS_SMALL");
    expect(summary[2]?.deltaQuantity).toBe(1);
    expect(summary[2]?.deltaScore).toBe(1);
  });
});
