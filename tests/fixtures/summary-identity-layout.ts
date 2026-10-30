import type { ComponentProps } from "react";
import type SummaryKpiPanelClean from "@/app/(dashboard)/prepaid/SummaryKpiPanelClean";
import type ManagerSummaryKpiPanelClean from "@/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean";

export const longIdentity = `SYNTHETIC_CN_KINH_DOANH_${"X".repeat(80)}`;
export const unicodeIdentity = "NV_Đinh_Quốc_Việt_123";
export const longManagerName = `Tên quản lý giả lập ${"Đ".repeat(70)}`;
export const longJobTitle = `Chức danh giả lập ${"Y".repeat(70)}`;
const noop = () => undefined;
const common = {
  canAdmin: true, reportDate: "2026-10-29", managerFilter: "", managerOptions: ["SYNTHETIC_MANAGER"],
  errorMessage: null, summaryMonthProgressPercent: 70,
  surfaceActionBtnClass: "btn btn-secondary", surfacePaginationBtnClass: "btn btn-secondary", surfaceBadgeClass: "", surfaceChipClass: "",
  getPercentBgClass: () => "", getPercentClass: () => "", getThieuBgClass: () => "", getThieuClass: () => "", getStatusLabel: () => "Chưa đạt",
  formatMetricNumber: (value: number) => String(value), formatMetricPercent: (value: number) => `${value}%`,
  computeCuocN1N3CompletionPercent: (value: number) => value,
  computeKpiDayCompletionPercent: (planned: number, actual: number) => planned ? actual / planned * 100 : 0,
  onBack: noop, onReportDateChange: noop, onManagerFilterChange: noop, onRefresh: noop, onIndicatorChange: noop,
};

export function individualLayoutProps(): ComponentProps<typeof SummaryKpiPanelClean> {
  const rows = [longIdentity, unicodeIdentity].map((ctvUser) => ({ ctvUser, kh: 10, th: 7, percent: 70, thieu: 3 }));
  return {
    ...common, selectedIndicator: "Chỉ tiêu giả lập", indicators: ["Chỉ tiêu giả lập"], summaryLoading: false, summaryRefreshing: false,
    summaryRows: rows, summaryPagedRows: rows, summaryPagedMobileRows: rows, summaryTotals: { kh: 20, th: 14, thieu: 6 },
    summaryTotalPercent: 70, summaryDayCompletionPercent: 70, summaryPage: 1, summaryTotalPages: 1,
    summaryOnlyIncomplete: false, summaryVisibleCount: rows.length, summaryMeta: { isNegativeGroup: false, maxPercent: 120 },
    isCuocSummaryIndicator: false, onSummaryPageChange: noop, onOnlyIncompleteChange: noop,
  };
}

export function managerLayoutProps(): ComponentProps<typeof ManagerSummaryKpiPanelClean> {
  const rows = [longIdentity, unicodeIdentity].map((managerUser) => ({ managerUser, managerName: longManagerName, jobTitle: longJobTitle, kh: 10, th: 7, percent: 70, thieu: 3 }));
  return {
    ...common, selectedManagerIndicator: "Chỉ tiêu giả lập", managerIndicators: ["Chỉ tiêu giả lập"], managerSummaryLoading: false,
    managerSummaryRefreshing: false, importingManagerKpi: false, summaryManagerRows: rows, managerSummaryPagedRows: rows,
    managerSummaryPagedMobileRows: rows, summaryManagerTotals: { kh: 20, th: 14, thieu: 6 }, managerSummaryTotalPercent: 70,
    managerSummaryDayCompletionPercent: 70, managerSummaryPage: 1, managerSummaryTotalPages: 1,
    summaryManagerMeta: { isNegativeGroup: false, maxPercent: 120 }, isCuocManagerSummaryIndicator: false,
    surfacePrimaryBtnClass: "btn btn-primary", onImportManagerKpi: noop, onPageChange: noop,
  };
}
