// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ManagerSummaryKpiPanelClean from "@/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean";

const baseProps = {
  canAdmin: true,
  reportDate: "2026-09-21",
  managerFilter: "",
  managerOptions: ["MANAGER_A", "MANAGER_B"],
  selectedManagerIndicator: "Thuê bao rời mạng FTTH",
  managerIndicators: ["Thuê bao rời mạng FTTH"],
  managerSummaryLoading: false,
  managerSummaryRefreshing: false,
  importingManagerKpi: false,
  errorMessage: null,
  summaryManagerRows: [
    {
      managerUser: "MANAGER_A",
      kh: 10,
      th: 12,
      percent: 80,
      thieu: 2,
    },
  ],
  managerSummaryAllRows: [],
  summaryManagerTotals: { kh: 10, th: 12, thieu: 2 },
  managerSummaryTotalPercent: 80,
  managerSummaryDayCompletionPercent: 80,
  managerSummaryPagedRows: [
    {
      managerUser: "MANAGER_A",
      kh: 10,
      th: 12,
      percent: 80,
      thieu: 2,
    },
  ],
  managerSummaryPagedMobileRows: [],
  managerSummaryPage: 1,
  managerSummaryTotalPages: 1,
  summaryManagerMeta: { isNegativeGroup: true, maxPercent: 120 },
  summaryMonthProgressPercent: 70,
  isCuocManagerSummaryIndicator: false,
  surfaceActionBtnClass: "action",
  surfacePrimaryBtnClass: "primary",
  surfacePaginationBtnClass: "pagination",
  surfaceBadgeClass: "badge",
  surfaceChipClass: "chip",
  getPercentBgClass: () => "",
  getPercentClass: () => "",
  getThieuBgClass: () => "",
  getThieuClass: () => "",
  getStatusLabel: () => "Chưa đạt",
  formatMetricNumber: (value: number) => String(value),
  formatMetricPercent: (value: number) => `${value}%`,
  computeCuocN1N3CompletionPercent: (value: number) => value,
  computeKpiDayCompletionPercent: (_kh: number, th: number) => th,
  onBack: vi.fn(),
  onImportManagerKpi: vi.fn(),
  onReportDateChange: vi.fn(),
  onManagerFilterChange: vi.fn(),
  onRefresh: vi.fn(),
  onIndicatorChange: vi.fn(),
  onPageChange: vi.fn(),
};

describe("manager KPI summary panel", () => {
  it("uses a direction-aware gap label for negative KPIs", () => {
    render(<ManagerSummaryKpiPanelClean {...baseProps} />);

    expect(screen.getAllByText("Vượt ngưỡng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Còn thiếu")).not.toBeInTheDocument();
  });

  it("prioritizes managers with incomplete KPIs and filters achieved metrics", async () => {
    const user = userEvent.setup();
    render(
      <ManagerSummaryKpiPanelClean
        {...baseProps}
        selectedManagerIndicator="__all__"
        managerSummaryAllRows={[
          {
            managerUser: "MANAGER_COMPLETE",
            metrics: [
              {
                name: "Đã đạt",
                kh: 10,
                th: 10,
                percent: 100,
                thieu: 0,
                metricCode: "DONE",
                isNegative: false,
                maxPercent: 120,
              },
            ],
          },
          {
            managerUser: "MANAGER_INCOMPLETE",
            metrics: [
              {
                name: "Chưa đạt",
                kh: 10,
                th: 5,
                percent: 50,
                thieu: 5,
                metricCode: "OPEN",
                isNegative: false,
                maxPercent: 120,
              },
              {
                name: "Đã đạt khác",
                kh: 10,
                th: 11,
                percent: 110,
                thieu: 0,
                metricCode: "DONE_2",
                isNegative: false,
                maxPercent: 120,
              },
            ],
          },
        ]}
      />,
    );

    const managerNames = screen
      .getAllByText(/^MANAGER_(?:COMPLETE|INCOMPLETE)$/)
      .map((node) => node.textContent);
    expect(managerNames).toEqual(["MANAGER_INCOMPLETE", "MANAGER_COMPLETE"]);

    await user.click(screen.getByRole("button", { name: "Chỉ hiện chưa đạt" }));

    expect(screen.getAllByText("Chưa đạt").length).toBeGreaterThan(0);
    expect(screen.queryByText("Đã đạt")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã đạt khác")).not.toBeInTheDocument();
    expect(screen.queryByText("MANAGER_COMPLETE")).not.toBeInTheDocument();
  });
});
