import { describe, it, expect } from "vitest";
import { buildCuocSummaryRow } from "@/lib/cuoc";

describe("buildCuocSummaryRow", () => {
  it("calculates totals and completion percent correctly", () => {
    const summary = buildCuocSummaryRow(
      [
        {
          ctvUser: "CTV_A",
          targetAmount: 100_000_000,
          collectedAmount: 98_830_000,
          completionPercent: 98.83,
          missingAmount: -1_830_000,
        },
        {
          ctvUser: "CTV_B",
          targetAmount: 50_000_000,
          collectedAmount: 48_965_000,
          completionPercent: 97.93,
          missingAmount: -465_000,
        },
      ],
      96.79
    );

    expect(summary).not.toBeNull();
    expect(summary?.ctvUser).toBe("Tổng");
    expect(summary?.targetAmount).toBe(150_000_000);
    expect(summary?.collectedAmount).toBe(147_795_000);
    expect(summary?.completionPercent).toBe(98.53);
    expect(summary?.missingAmount).toBe(-2_610_000);
  });

  it("returns null for empty rows", () => {
    const emptySummary = buildCuocSummaryRow([], 96.79);
    expect(emptySummary).toBeNull();
  });
});
