import { describe, expect, it } from "vitest";
import {
  computeKpiAdverseGap,
  filterIncompleteKpiSummaryRows,
  sortKpiSummaryRowsByCompletion,
} from "@/lib/kpi-summary";

describe("KPI summary helpers", () => {
  it("computes the remaining or exceeded amount based on KPI direction", () => {
    expect(computeKpiAdverseGap(10, 8, false)).toBe(2);
    expect(computeKpiAdverseGap(10, 12, false)).toBe(0);
    expect(computeKpiAdverseGap(10, 12, true)).toBe(2);
    expect(computeKpiAdverseGap(10, 8, true)).toBe(0);
  });

  it("orders incomplete rows before achieved rows without mutating input", () => {
    const rows = [
      { ctvUser: "DONE", percent: 105 },
      { ctvUser: "NEAR", percent: 88 },
      { ctvUser: "CRITICAL", percent: 45 },
    ];

    const sorted = sortKpiSummaryRowsByCompletion(rows);

    expect(sorted.map((row) => row.ctvUser)).toEqual(["CRITICAL", "NEAR", "DONE"]);
    expect(rows[0].ctvUser).toBe("DONE");
  });

  it("filters rows that have reached 100 percent", () => {
    const rows = [
      { ctvUser: "OPEN", percent: 99.99 },
      { ctvUser: "DONE", percent: 100 },
    ];

    expect(filterIncompleteKpiSummaryRows(rows).map((row) => row.ctvUser)).toEqual(["OPEN"]);
  });
});
