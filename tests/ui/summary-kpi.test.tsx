// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SummaryKpiPanelClean from "@/app/(dashboard)/prepaid/SummaryKpiPanelClean";

const summaryRow = {
  ctvUser: "CTV_A",
  kh: 10,
  th: 12,
  percent: 80,
  thieu: 2,
};

function renderSummary() {
  const onOnlyIncompleteChange = vi.fn();
  render(
    <SummaryKpiPanelClean
      canAdmin
      reportDate="2026-09-21"
      managerFilter=""
      managerOptions={["MANAGER_A"]}
      selectedIndicator="Thuê bao rời mạng FTTH"
      indicators={["Thuê bao rời mạng FTTH"]}
      summaryLoading={false}
      summaryRefreshing={false}
      errorMessage={null}
      summaryRows={[summaryRow]}
      summaryTotals={{ kh: 10, th: 12, thieu: 2 }}
      summaryTotalPercent={80}
      summaryDayCompletionPercent={80}
      summaryPagedRows={[summaryRow]}
      summaryPagedMobileRows={[]}
      summaryPage={1}
      summaryTotalPages={1}
      summaryMeta={{ isNegativeGroup: true, maxPercent: 120 }}
      summaryMonthProgressPercent={70}
      isCuocSummaryIndicator={false}
      summaryOnlyIncomplete={false}
      summaryVisibleCount={1}
      surfaceActionBtnClass="action"
      surfacePaginationBtnClass="pagination"
      surfaceBadgeClass="badge"
      surfaceChipClass="chip"
      getPercentBgClass={() => ""}
      getPercentClass={() => ""}
      getThieuBgClass={() => ""}
      getThieuClass={() => ""}
      getStatusLabel={() => "Chưa đạt"}
      formatMetricNumber={(value) => String(value)}
      formatMetricPercent={(value) => `${value}%`}
      computeCuocN1N3CompletionPercent={(value) => value}
      computeKpiDayCompletionPercent={(_kh, th) => th}
      onBack={vi.fn()}
      onReportDateChange={vi.fn()}
      onManagerFilterChange={vi.fn()}
      onRefresh={vi.fn()}
      onIndicatorChange={vi.fn()}
      onSummaryPageChange={vi.fn()}
      onOnlyIncompleteChange={onOnlyIncompleteChange}
    />,
  );
  return { onOnlyIncompleteChange };
}

describe("KPI summary panel", () => {
  it("labels negative KPI gaps and filter fields clearly", () => {
    renderSummary();

    expect(screen.getAllByText("Vượt ngưỡng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Còn thiếu")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ngày báo cáo")).toBeInTheDocument();
    expect(screen.getByLabelText("Quản lý")).toBeInTheDocument();
    expect(screen.getByLabelText("Chỉ tiêu")).toBeInTheDocument();
    expect(screen.queryByText(/HT ngay/)).not.toBeInTheDocument();
  });

  it("exposes the incomplete-only quick filter", async () => {
    const user = userEvent.setup();
    const { onOnlyIncompleteChange } = renderSummary();

    await user.click(screen.getByRole("button", { name: "Chỉ hiện chưa đạt" }));

    expect(onOnlyIncompleteChange).toHaveBeenCalledWith(true);
  });
});
