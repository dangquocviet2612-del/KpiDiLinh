// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CuocPanel from "@/app/(dashboard)/prepaid/CuocCdPanelClean";
import SummaryPanel from "@/app/(dashboard)/prepaid/SummaryKpiPanelClean";
import Customers from "@/components/CustomerTableRefined";
import { customerControlsProps, syntheticCustomer } from "../fixtures/customer-mobile-controls";

afterEach(cleanup);

function cuocProps(): React.ComponentProps<typeof CuocPanel> {
  return { canAdmin: true, reportDate: "2026-11-01", dateLabel: "01/11/2026", targetRate: 99.5,
    rateDirty: true, savingRate: false, loading: false, refreshing: false, importing: false,
    showMobileFilters: false, errorMessage: null, rows: [], summaryRow: null, pagedRows: [],
    page: 1, totalPages: 1, pageSize: 40, surfaceActionBtnClass: "", surfacePrimaryBtnClass: "",
    surfacePaginationBtnClass: "", surfaceBadgeClass: "", surfaceChipClass: "", onBack: vi.fn(),
    onReportDateChange: vi.fn(), onTargetRateChange: vi.fn(), onSaveRate: vi.fn(), onRefresh: vi.fn(),
    onImport: vi.fn(), onToggleMobileFilters: vi.fn(), onPageChange: vi.fn() };
}

function summaryProps(): React.ComponentProps<typeof SummaryPanel> {
  const row = { ctvUser: "SYNTHETIC_CTV", kh: 10, th: 8, percent: 80, thieu: 2 };
  return { canAdmin: true, reportDate: "2026-11-01", managerFilter: "MANAGER_A", managerOptions: ["MANAGER_A"],
    selectedIndicator: "Chỉ tiêu giả lập", indicators: ["Chỉ tiêu giả lập"], summaryLoading: false,
    summaryRefreshing: false, errorMessage: null, summaryRows: [row], summaryTotals: { kh: 10, th: 8, thieu: 2 },
    summaryTotalPercent: 80, summaryDayCompletionPercent: 80, summaryPagedRows: [row], summaryPagedMobileRows: [row],
    summaryPage: 1, summaryTotalPages: 1, summaryOnlyIncomplete: false, summaryVisibleCount: 1,
    summaryMeta: { isNegativeGroup: false, maxPercent: 120 }, summaryMonthProgressPercent: 100,
    isCuocSummaryIndicator: false, surfaceActionBtnClass: "action", surfacePaginationBtnClass: "pagination",
    surfaceBadgeClass: "badge", surfaceChipClass: "chip", getPercentBgClass: () => "", getPercentClass: () => "",
    getThieuBgClass: () => "", getThieuClass: () => "", getStatusLabel: () => "Chưa đạt",
    formatMetricNumber: String, formatMetricPercent: (value) => `${value}%`,
    computeCuocN1N3CompletionPercent: (value) => value, computeKpiDayCompletionPercent: (_kh, th) => th,
    onBack: vi.fn(), onReportDateChange: vi.fn(), onManagerFilterChange: vi.fn(), onRefresh: vi.fn(),
    onIndicatorChange: vi.fn(), onSummaryPageChange: vi.fn(), onOnlyIncompleteChange: vi.fn() };
}

describe("CD/FTTH unsaved rate is not a filter", () => {
  it.each([undefined, "ftth"] as const)("separates the unsaved status for service %s", (service) => {
    render(<CuocPanel {...cuocProps()} service={service} />);
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bộ lọc (1)" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Trạng thái tỷ lệ giao" })).toHaveTextContent("Tỷ lệ chưa lưu");
  });

  it("clears the hint only when the parent marks the rate saved", () => {
    const props = cuocProps();
    const view = render(<CuocPanel {...props} />);
    expect(screen.getByRole("status", { name: "Trạng thái tỷ lệ giao" })).toHaveTextContent("Tỷ lệ chưa lưu");
    view.rerender(<CuocPanel {...props} rateDirty={false} />);
    expect(screen.queryByText("Tỷ lệ chưa lưu")).not.toBeInTheDocument();
  });

  it("does not expose the admin draft hint or editor to nonadmins", () => {
    render(<CuocPanel {...cuocProps()} canAdmin={false} />);
    expect(screen.queryByText("Tỷ lệ chưa lưu")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toBeInTheDocument();
  });

  it("retains the save callback and the pending lock", async () => {
    const user = userEvent.setup(); const props = cuocProps();
    const view = render(<CuocPanel {...props} />);
    await user.click(screen.getByRole("button", { name: "Lưu tỷ lệ" }));
    expect(props.onSaveRate).toHaveBeenCalledTimes(1);
    view.rerender(<CuocPanel {...props} savingRate />);
    expect(screen.getByRole("button", { name: "Lưu tỷ lệ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu tỷ lệ" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Trạng thái tỷ lệ giao" })).toHaveTextContent("Tỷ lệ chưa lưu");
  });
});

describe("summary secondary filter disclosure", () => {
  it("starts collapsed and controls its own secondary fields", () => {
    render(<SummaryPanel {...summaryProps()} />);
    const toggle = screen.getByRole("button", { name: "Bộ lọc khác (1)" });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const controlled = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(controlled).toHaveAttribute("data-open", "false");
    expect(controlled).toContainElement(screen.getByLabelText("Quản lý"));
    expect(controlled).toContainElement(screen.getByRole("button", { name: "Làm mới dữ liệu" }));
    expect(controlled).not.toContainElement(screen.getByLabelText("Ngày báo cáo"));
    expect(controlled).not.toContainElement(screen.getByLabelText("Chỉ tiêu"));
    expect(controlled).not.toContainElement(screen.getByRole("button", { name: "Chỉ hiện chưa đạt" }));
  });

  it("opening and closing does not reset context, refresh, or submit", async () => {
    const user = userEvent.setup(); const props = summaryProps(); const submit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><SummaryPanel {...props} /></form>);
    const toggle = screen.getByRole("button", { name: "Bộ lọc khác (1)" });
    await user.click(toggle); expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle); expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Quản lý")).toHaveValue("MANAGER_A");
    expect(screen.getByLabelText("Ngày báo cáo")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Chỉ tiêu")).toHaveValue("Chỉ tiêu giả lập");
    for(const callback of [props.onRefresh, props.onManagerFilterChange, props.onReportDateChange, props.onIndicatorChange, submit]) expect(callback).not.toHaveBeenCalled();
  });

  it("keeps an active manager identifiable while collapsed", () => {
    render(<SummaryPanel {...summaryProps()} />);
    expect(screen.getByText("Quản lý: MANAGER_A")).toBeInTheDocument();
  });

  it("tabs from the expanded trigger into secondary controls in visual order", async () => {
    const user = userEvent.setup();
    render(<SummaryPanel {...summaryProps()} />);
    const toggle = screen.getByRole("button", { name: "Bộ lọc khác (1)" });
    toggle.focus(); await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.tab(); expect(screen.getByLabelText("Quản lý")).toHaveFocus();
    await user.tab(); expect(screen.getByRole("button", { name: "Làm mới dữ liệu" })).toHaveFocus();
    await user.tab(); expect(screen.getByLabelText("Chỉ tiêu")).toHaveFocus();
  });

  it("does not show another role an admin-only manager selection", () => {
    render(<SummaryPanel {...summaryProps()} canAdmin={false} />);
    expect(screen.getByRole("button", { name: "Bộ lọc khác" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Quản lý")).not.toBeInTheDocument();
    expect(screen.queryByText("Quản lý: MANAGER_A")).not.toBeInTheDocument();
  });

  it("uses independent controlled IDs when panels coexist", () => {
    render(<><SummaryPanel {...summaryProps()} /><SummaryPanel {...summaryProps()} /></>);
    const toggles = screen.getAllByRole("button", { name: "Bộ lọc khác (1)" });
    expect(toggles[0].getAttribute("aria-controls")).not.toBe(toggles[1].getAttribute("aria-controls"));
  });

  it("retains manual refresh, manager filtering and incomplete callbacks", async () => {
    const user = userEvent.setup(); const props = summaryProps();
    render(<SummaryPanel {...props} />);
    await user.click(screen.getByRole("button", { name: "Bộ lọc khác (1)" }));
    await user.selectOptions(screen.getByLabelText("Quản lý"), "");
    expect(props.onManagerFilterChange).toHaveBeenCalledExactlyOnceWith("");
    await user.click(screen.getByRole("button", { name: "Làm mới dữ liệu" }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Chỉ hiện chưa đạt" }));
    expect(props.onOnlyIncompleteChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe("mobile customer destructive action", () => {
  it("requires the admin menu before delegating delete once without form submission", async () => {
    const user = userEvent.setup(); const onDelete = vi.fn(); const submit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><Customers {...customerControlsProps()} onDelete={onDelete} /></form>);
    const card = screen.getByRole("article");
    expect(within(card).queryByRole("button", { name: /^Xóa/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("menuitem")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: `Thao tác khác của ${syntheticCustomer.name}` }));
    expect(onDelete).not.toHaveBeenCalled();
    const item = within(card).getByRole("menuitem", { name: `Xóa khách hàng ${syntheticCustomer.name}` });
    expect(item).toHaveAttribute("type", "button");
    await user.click(item);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(syntheticCustomer.id);
    expect(submit).not.toHaveBeenCalled();
    expect(within(card).queryByRole("menu")).not.toBeInTheDocument();
  });

  it.each(["MANAGER","CTV"])("does not expose the destructive menu to %s", (role) => {
    render(<Customers {...customerControlsProps(role)} />);
    const card = screen.getByRole("article");
    expect(within(card).queryByRole("button", { name: /^Thao tác khác/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("menuitem")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Sửa/ })).toBeEnabled();
  });

  it("Escape restores focus without deleting", async () => {
    const user = userEvent.setup(); const onDelete = vi.fn();
    render(<Customers {...customerControlsProps()} onDelete={onDelete} />);
    const card = screen.getByRole("article");
    const trigger = within(card).getByRole("button", { name: /^Thao tác khác/ });
    await user.click(trigger);
    await waitFor(() => expect(within(card).getByRole("menuitem")).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(within(card).queryByRole("menu")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
