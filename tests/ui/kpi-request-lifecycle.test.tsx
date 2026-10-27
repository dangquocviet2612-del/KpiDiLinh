// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useKpiCalculator from "@/app/(dashboard)/prepaid/useKpiCalculator";
import PrepaidPage from "@/app/(dashboard)/prepaid/PrepaidPageImpl";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const runtime = vi.hoisted(() => ({
  session: { user: { id: "admin-test", name: "admin-test", role: "ADMIN" } },
  router: { push: vi.fn(), replace: vi.fn() },
  view: "view=kpi-calculator",
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: runtime.session, status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => runtime.router, useSearchParams: () => new URLSearchParams(runtime.view) }));

function reportPayload(value = 4) {
  return {
    reportDate: "2026-10-25",
    rows: [{ kpiCode: "METRIC_TEST", displayName: "Metric test", khThang: 10, thNgay: value, thLuyKe: value, completionPercent: value * 10, baseScore: 10, maxPercent: 120, maxScore: 12, achievedScore: value }],
    totalBaseScore: 10,
    totalAchievedScore: value,
  };
}

function response(value = 4) {
  return { ok: true, json: async () => reportPayload(value) };
}

function pendingResponse() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const promise = new Promise<ReturnType<typeof response>>((finish) => { resolve = finish; });
  return { promise, resolve };
}

const defaultOptions = { enabled: true, hasSession: true, canSelectCtv: true, selectedCtv: "CTV_A", reportDate: "2026-10-25" };

describe("KPI request lifecycle", () => {
  beforeEach(() => { vi.clearAllMocks(); runtime.view = "view=kpi-calculator"; });
  afterEach(() => vi.unstubAllGlobals());

  it("joins the same pending request when callbacks change or refresh is pressed", async () => {
    const pending = pendingResponse();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<ReturnType<typeof response>>>(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ callback }) => useKpiCalculator({ ...defaultOptions, onResolvedReportDate: callback }), { initialProps: { callback: vi.fn() } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ callback: vi.fn() });
    await act(async () => { void result.current.fetchCalculator({ force: true }); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(response()));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("reuses the resolved report date without refetching or resetting simulation drafts", async () => {
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => {
      const [reportDate, setReportDate] = useState("");
      return useKpiCalculator({ ...defaultOptions, reportDate, onResolvedReportDate: (value) => setReportDate(value) });
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    await act(async () => result.current.setDraftValue("METRIC_TEST", "7"));
    rerender();
    expect(result.current.draftValues.METRIC_TEST).toBe("7");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts an outdated CTV request and ignores its late result", async () => {
    const first = pendingResponse();
    const second = pendingResponse();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ selectedCtv }) => useKpiCalculator({ ...defaultOptions, selectedCtv }), { initialProps: { selectedCtv: "CTV_A" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstSignal = fetchMock.mock.calls[0][1]?.signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    rerender({ selectedCtv: "CTV_B" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    await act(async () => second.resolve(response(8)));
    await waitFor(() => expect(result.current.draftValues.METRIC_TEST).toBe("8"));
    await act(async () => first.resolve(response(2)));
    expect(result.current.draftValues.METRIC_TEST).toBe("8");
  });

  it("cancels loading when its panel is disabled", async () => {
    const pending = pendingResponse();
    const callback = vi.fn();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<ReturnType<typeof response>>>(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderHook(({ enabled }) => useKpiCalculator({ ...defaultOptions, enabled, reportDate: "", onResolvedReportDate: callback }), { initialProps: { enabled: true } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    rerender({ enabled: false });
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(response()));
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not reuse another authenticated scope when switching back during loading", async () => {
    const pending = pendingResponse();
    const fetchMock = vi.fn().mockResolvedValueOnce(response(4)).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(6));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ scopeKey }) => useKpiCalculator({ ...defaultOptions, scopeKey }), { initialProps: { scopeKey: "scope-a" } });
    await waitFor(() => expect(result.current.draftValues.METRIC_TEST).toBe("4"));
    rerender({ scopeKey: "scope-b" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.rows).toHaveLength(0);
    rerender({ scopeKey: "scope-a" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.draftValues.METRIC_TEST).toBe("6"));
    await act(async () => pending.resolve(response(9)));
    expect(result.current.draftValues.METRIC_TEST).toBe("6");
  });

  it("loads only calculator data and initializes the CTV list once", async () => {
    const pending = pendingResponse();
    const me = { role: "ADMIN", ctvList: [{ id: "ctv-a", username: "CTV_A" }] };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/kpi/report")) return pending.promise;
      return Promise.resolve({ ok: true, json: async () => url === "/api/me" ? me : {} });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/kpi/report"))).toBe(true));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    const calls = fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/kpi/report"));
    expect(calls).toHaveLength(1);
    expect(new URL(String(calls[0][0]), "https://test.invalid").searchParams.get("ctvUser")).toBe("CTV_A");
    expect(fetchMock.mock.calls.filter(([input]) => input === "/api/me")).toHaveLength(1);
    await act(async () => pending.resolve(response()));
  });

  it("invalidates personal report aliases and loads the newest date after import", async () => {
    runtime.view = "";
    let imported = false;
    const oldDateRequest = pendingResponse();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/kpi/import") {
        imported = true;
        return Promise.resolve({ ok: true, json: async () => ({ inserted: 1 }) });
      }
      if (url.startsWith("/api/kpi/report")) {
        if (imported && url.includes("reportDate=")) return oldDateRequest.promise;
        const payload = { ...reportPayload(imported ? 8 : 4), reportDate: imported ? "2026-10-26" : "2026-10-25" };
        return Promise.resolve({ ok: true, json: async () => payload });
      }
      return Promise.resolve({ ok: true, json: async () => url === "/api/me" ? { ctvList: [{ id: "ctv-a", username: "CTV_A" }] } : {} });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>);
    const date = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    await waitFor(() => expect(date.value).toBe("2026-10-25"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["synthetic"], "fixture.xlsx")] } });
    await waitFor(() => expect(date.value).toBe("2026-10-26"));
    expect(container.textContent).toContain("80.0%");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    const reports = fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/kpi/report"));
    expect(reports).toHaveLength(2);
    expect(new URL(String(reports[1][0]), "https://test.invalid").searchParams.has("reportDate")).toBe(false);
    await act(async () => oldDateRequest.resolve(response(2)));
    expect(date.value).toBe("2026-10-26");
  });

  it("does not reload the CTV list for selection changes or equivalent session refreshes", async () => {
    runtime.view = "";
    const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve({ ok: true, json: async () => String(input) === "/api/me" ? { ctvList: [{ id: "a", username: "CTV_A" }, { id: "b", username: "CTV_B" }] } : reportPayload() }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, rerender } = render(<ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>);
    const select = container.querySelector("select")!;
    await waitFor(() => expect(select.value).toBe("CTV_A"));
    fireEvent.change(select, { target: { value: "CTV_B" } });
    runtime.session = { user: { ...runtime.session.user } };
    rerender(<ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("ctvUser=CTV_B"))).toBe(true));
    expect(fetchMock.mock.calls.filter(([input]) => input === "/api/me")).toHaveLength(1);
  });
});
