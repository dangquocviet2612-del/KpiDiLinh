// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Panel from "@/app/(dashboard)/prepaid/CuocCdPanelClean";
import usePanel from "@/app/(dashboard)/prepaid/useCuocCdPanel";
import Sidebar from "@/components/Sidebar";
vi.mock("react", async (original) => original<typeof import("react")>());
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/prepaid", useSearchParams: () => new URLSearchParams("view=cuoc-ftth") }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
const fetchMock = vi.fn<typeof fetch>();
let rate: number;
const props = () => ({ service: "ftth" as const, canAdmin: true, reportDate: "", dateLabel: "", targetRate: 99.5, rateDirty: false, savingRate: false, loading: false, refreshing: false, importing: false, showMobileFilters: false, errorMessage: null, rows: [], summaryRow: null, pagedRows: [], page: 1, totalPages: 1, pageSize: 40, surfaceActionBtnClass: "", surfacePrimaryBtnClass: "", surfacePaginationBtnClass: "", surfaceBadgeClass: "", surfaceChipClass: "", onBack: vi.fn(), onReportDateChange: vi.fn(), onTargetRateChange: vi.fn(), onSaveRate: vi.fn(), onRefresh: vi.fn(), onImport: vi.fn(), onToggleMobileFilters: vi.fn(), onPageChange: vi.fn() });
beforeEach(() => {
  rate = 99.5;
  fetchMock.mockReset().mockImplementation(async (url, options) => {
    if (String(url).endsWith("/config") && options?.method === "POST") rate = JSON.parse(String(options.body)).targetRatePercent;
    return { ok: true, json: async () => ({ targetRatePercent: rate, rows: [], summaryRow: null, reportDate: null }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("renders the shared CD layout with FTTH branding and default99.5", () => {
  render(<Panel {...props()} />);
  expect(screen.getByRole("heading", { name: "Cước FTTH" })).toBeInTheDocument();
  expect(screen.getByText("Tải file Cước FTTH")).toBeInTheDocument();
  expect(screen.getByRole("spinbutton")).toHaveValue(99.5);
});
it("preserves existing CD branding when service is omitted", () => {
  const { service: omitted, ...original } = props(); void omitted;
  render(<Panel {...original} />);
  expect(screen.getByRole("heading", { name: "Cước Cố Định (Cước CD)" })).toBeInTheDocument();
});
it("does not expose target editing to nonadmins", () => {
  render(<Panel {...props()} canAdmin={false} />);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});
it("uses only FTTH report/config endpoints and persists its independent target", async () => {
  const { result } = renderHook(() => usePanel({ canAdmin: true, canViewCuoc: true, enabled: true, hasSession: true, kind: "ftth" }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/cuoc-ftth/report?");
  act(() => result.current.onTargetRateChange(96));
  await act(async () => result.current.saveRate());
  expect(fetchMock).toHaveBeenCalledWith("/api/cuoc-ftth/config", expect.objectContaining({ method: "POST", body: JSON.stringify({ targetRatePercent: 96 }) }));
  expect(result.current.targetRate).toBe(96);
  expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/cuoc-ftth/"))).toBe(true);
});
it("does not let CTV/MANAGER save a target", async () => {
  const { result } = renderHook(() => usePanel({ canAdmin: false, canViewCuoc: true, enabled: true, hasSession: true, kind: "ftth" }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.saveRate());
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});
it("does not fetch an unopened FTTH panel", async () => {
  renderHook(() => usePanel({ canAdmin: true, canViewCuoc: true, enabled: false, hasSession: true, kind: "ftth" }));
  await act(async () => undefined); expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["ADMIN", "MANAGER", "CTV"])("shows the independent FTTH menu for %s", (role) => {
  render(<Sidebar userRole={role} userName="fixture-user" />);
  const link = screen.getByRole("link", { name: "Cước FTTH" });
  expect(link).toHaveAttribute("href", "/prepaid?view=cuoc-ftth");
  expect(link).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Cước CD" })).not.toHaveAttribute("aria-current");
});
