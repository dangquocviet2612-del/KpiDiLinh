import { describe, expect, it } from "vitest";
import { sortKpiRowsByCompletion } from "@/lib/kpi-row-sorting";

describe("sortKpiRowsByCompletion", () => {
  it("puts incomplete KPI rows before achieved rows", () => {
    const rows = [
      { kpiCode: "ACHIEVED_HIGH", completionPercent: 120 },
      { kpiCode: "INCOMPLETE_NEAR", completionPercent: 92 },
      { kpiCode: "ACHIEVED", completionPercent: 100 },
      { kpiCode: "INCOMPLETE_LOW", completionPercent: 45 },
    ];

    const sortedRows = sortKpiRowsByCompletion(rows);

    expect(sortedRows.map((row) => row.kpiCode)).toEqual([
      "INCOMPLETE_LOW",
      "INCOMPLETE_NEAR",
      "ACHIEVED",
      "ACHIEVED_HIGH",
    ]);
    expect(rows.map((row) => row.kpiCode)).toEqual([
      "ACHIEVED_HIGH",
      "INCOMPLETE_NEAR",
      "ACHIEVED",
      "INCOMPLETE_LOW",
    ]);
  });
});
