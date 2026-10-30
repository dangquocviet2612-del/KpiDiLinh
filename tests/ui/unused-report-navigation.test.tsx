// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";
import CdtPanel from "@/app/(dashboard)/prepaid/CdtPanelClean";

const navigation = vi.hoisted(() => ({ pathname: "/prepaid" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useSearchParams: () => new URLSearchParams() }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

beforeEach(() => { navigation.pathname = "/prepaid"; localStorage.clear(); });
afterEach(() => { cleanup(); });

function expectUnusedLinksAbsent() {
  expect(document.querySelector('a[href="/prepaid?view=cdt-outstanding"]')).not.toBeInTheDocument();
  expect(document.querySelector('a[href="/prepaid?view=disconnect"]')).not.toBeInTheDocument();
  expect(document.querySelector('a[href="/churn-risk"]')).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^CDT$/ })).toHaveAttribute("href", "/prepaid?view=cdt");
  expect(screen.getByRole("link", { name: /^Tính KPI$/ })).toHaveAttribute("href", "/prepaid?view=kpi-calculator");
  expect(screen.getByRole("link", { name: /^Công văn$/ })).toBeInTheDocument();
}

function panelProps(role: string) {
  return {
    canAdmin: role === "ADMIN", canSelectCtv: role !== "CTV", canViewSummaryReport: role !== "CTV", showActorColumn: role !== "CTV",
    fromDate: "2026-10-01", toDate: "2026-10-29", accountFilter: "", selectedCtv: "", managerFilter: "",
    managerOptions: [], ctvOptions: [], dateRangeLabel: "Synthetic range", activeMobileFilterCount: 0, showMobileFilters: false,
    loading: false, refreshing: false, importing: false, exportingMonth: false, errorMessage: null,
    rows: [], totals: { count: 0, totalAmount: 0, totalMonths: 0, ftth: 0, ths: 0, camera: 0 }, page: 1, totalPages: 1,
    surfaceActionBtnClass: "", surfacePrimaryBtnClass: "", surfacePaginationBtnClass: "", surfaceBadgeClass: "", surfaceChipClass: "",
    formatIsoToVnDate: (value?: string | null) => value || "", getCdtTypeToneClass: () => "",
    onBack: vi.fn(), onOpenReport: vi.fn(), onExportMonth: vi.fn(), onImport: vi.fn(), onFromDateChange: vi.fn(),
    onToDateChange: vi.fn(), onAccountFilterChange: vi.fn(), onSelectedCtvChange: vi.fn(), onManagerFilterChange: vi.fn(),
    onRefresh: vi.fn(), onToggleMobileFilters: vi.fn(), onPageChange: vi.fn(),
  };
}

describe("unused report navigation", () => {
  it.each(["ADMIN", "MANAGER", "CTV"])("removes unused sidebar entries but keeps other KPI navigation for %s", (role) => {
    render(<Sidebar userRole={role} userName="Synthetic user" />);
    expectUnusedLinksAbsent();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("also removes them when opening the mobile drawer for %s", (role) => {
    navigation.pathname = "/customers";
    render(<Sidebar userRole={role} userName="Synthetic user" />);
    fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
    expect(screen.getByRole("dialog", { name: "Menu điều hướng" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở menu KPI" }));
    expectUnusedLinksAbsent();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("removes both CDT outstanding shortcuts and keeps CDT actions for %s", (role) => {
    const props = panelProps(role);
    render(<CdtPanel {...props} />);
    expect(screen.queryAllByRole("button", { name: /^Tồn CDT$/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Quay lại KPI$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Làm mới dữ liệu CDT$/ }));
    expect(props.onBack).toHaveBeenCalledOnce(); expect(props.onRefresh).toHaveBeenCalledOnce();
    if (role !== "CTV") {
      fireEvent.click(screen.getByRole("button", { name: /^Mở báo cáo CDT$/ }));
      expect(props.onOpenReport).toHaveBeenCalledOnce();
    }
  });
});
