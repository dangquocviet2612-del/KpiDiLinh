import { describe, expect, it } from "vitest";
import {
  filterIncompleteManagerKpiRows,
  prioritizeManagerKpiRows,
  sortManagerKpiMetricsByCompletion,
} from "@/lib/manager-kpi-summary";

describe("manager KPI summary", () => {
  it("prioritizes managers with more incomplete KPIs", () => {
    const rows = [
      {
        managerUser: "MANAGER_COMPLETE",
        metrics: [
          { name: "KPI 1", percent: 110 },
          { name: "KPI 2", percent: 100 },
        ],
      },
      {
        managerUser: "MANAGER_CRITICAL",
        metrics: [
          { name: "KPI 1", percent: 45 },
          { name: "KPI 2", percent: 95 },
        ],
      },
      {
        managerUser: "MANAGER_NEAR",
        metrics: [
          { name: "KPI 1", percent: 85 },
          { name: "KPI 2", percent: 105 },
        ],
      },
    ];

    const sorted = prioritizeManagerKpiRows(rows);

    expect(sorted.map((row) => row.managerUser)).toEqual([
      "MANAGER_CRITICAL",
      "MANAGER_NEAR",
      "MANAGER_COMPLETE",
    ]);
    expect(rows[0].managerUser).toBe("MANAGER_COMPLETE");
  });

  it("keeps only incomplete metrics when the quick filter is enabled", () => {
    const rows = [
      {
        managerUser: "MANAGER_A",
        metrics: [
          { name: "Incomplete", percent: 82 },
          { name: "Complete", percent: 105 },
        ],
      },
      {
        managerUser: "MANAGER_B",
        metrics: [{ name: "Complete", percent: 100 }],
      },
    ];

    const filtered = filterIncompleteManagerKpiRows(rows);

    expect(filtered).toEqual([
      {
        managerUser: "MANAGER_A",
        metrics: [{ name: "Incomplete", percent: 82 }],
      },
    ]);
    expect(rows[0].metrics).toHaveLength(2);
  });

  it("shows incomplete metrics before achieved metrics", () => {
    const metrics = [
      { name: "Achieved", percent: 100 },
      { name: "Critical", percent: 40 },
      { name: "Near", percent: 90 },
    ];

    expect(sortManagerKpiMetricsByCompletion(metrics).map((metric) => metric.name)).toEqual([
      "Critical",
      "Near",
      "Achieved",
    ]);
  });
});
