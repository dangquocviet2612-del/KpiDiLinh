import { describe, it, expect } from "vitest";
import { buildDisconnectMobileFilterSummary, isDisconnectPastCancelDate } from "@/lib/disconnect-ui";

describe("Disconnect UI Helpers", () => {
  it("builds mobile filter summary with count and active filters", () => {
    const base = {
      activeCount: 3,
      cancelMonthLabel: "Tháng 03",
      sourceLabel: "Truyền hình",
    };

    const summary = buildDisconnectMobileFilterSummary(base);
    expect(summary.title).toBe("Đang áp dụng (3)");
    expect(summary.detail).toBe("Tháng 03 · Truyền hình");
  });

  it("handles empty sourceLabel", () => {
    const summary = buildDisconnectMobileFilterSummary({
      activeCount: 1,
      cancelMonthLabel: "Tháng 03",
      sourceLabel: "",
    });
    expect(summary.detail).toBe("Tháng 03");
  });

  it("truncates very long source labels", () => {
    const summary = buildDisconnectMobileFilterSummary({
      activeCount: 2,
      cancelMonthLabel: "Tháng 03",
      sourceLabel: "Nguồn có tên rất rất dài",
    });
    expect(summary.detail).toBe("Tháng 03 · Nguồn có tên rất rất…");
  });

  it("checks whether disconnect is past cancel date", () => {
    expect(isDisconnectPastCancelDate("2026-04-01", "2026-04-02")).toBe(true);
    expect(isDisconnectPastCancelDate("2026-04-02", "2026-04-02")).toBe(false);
    expect(isDisconnectPastCancelDate(undefined, "2026-04-02")).toBe(false);
  });
});
