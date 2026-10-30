// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useKpiCalculator from "@/app/(dashboard)/prepaid/useKpiCalculator";
import KpiCalculatorPanel from "@/app/(dashboard)/prepaid/KpiCalculatorPanel";
import type { KpiReportGroupedRow } from "@/lib/kpi-report-calculation";

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));

type Options = Parameters<typeof useKpiCalculator>[0];
type Calculator = ReturnType<typeof useKpiCalculator>;
type Payload = { rows: KpiReportGroupedRow[]; reportDate: string };
type Pending = {
  url: URL;
  signal: AbortSignal;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

const defaults: Options = {
  enabled: true, hasSession: true, canSelectCtv: true, selectedCtv: "CTV_A",
  reportDate: "2026-10-25", scopeKey: JSON.stringify(["user-a", "ADMIN", 0]),
};
let requests: Pending[];

function metric(kpiCode = "EDIT", value = 4, extra: Partial<KpiReportGroupedRow> = {}): KpiReportGroupedRow {
  return {
    kpiCode, displayName: kpiCode, khThang: 10, thNgay: value, thLuyKe: value,
    completionPercent: Math.min(120, value * 10), baseScore: 10, maxPercent: 120,
    maxScore: 12, achievedScore: Math.min(12, value), sortOrder: 1,
    isNegativeKpi: false, isCuocRateKpi: false, ...extra,
  };
}

function payload(rows = [metric(), metric("UNTOUCHED", 3)], reportDate = defaults.reportDate): Payload {
  return { rows, reportDate };
}

async function requestAt(index: number) {
  await waitFor(() => expect(requests.length).toBeGreaterThan(index));
  return requests[index];
}

async function answer(request: Pending, data = payload(), ok = true) {
  await act(async () => {
    request.resolve({ ok, json: async () => ok ? data : { error: "synthetic failure" } } as Response);
  });
}

async function reject(request: Pending) {
  await act(async () => request.reject(new Error("synthetic network failure")));
}

function mount(overrides: Partial<Options> = {}, strict = false) {
  return renderHook((options: Options) => useKpiCalculator(options), {
    initialProps: { ...defaults, ...overrides },
    wrapper: strict ? StrictMode : undefined,
  });
}

async function loaded(overrides: Partial<Options> = {}, data = payload(), strict = false) {
  const hook = mount(overrides, strict);
  await answer(await requestAt(0), data);
  expect(hook.result.current.loading).toBe(false);
  return hook;
}

async function refresh(calculator: Calculator) {
  await act(async () => { void calculator.fetchCalculator({ force: true }); });
  return requestAt(requests.length - 1);
}

function hasDraftEdits(calculator: Calculator) {
  return calculator.hasDraftEdits;
}

function expectEmpty(calculator: Calculator) {
  expect(calculator.rows).toEqual([]);
  expect(calculator.draftValues).toEqual({});
  expect(calculator.totals.totalBaseScore).toBe(0);
  expect(calculator.totals.totalCurrentScore).toBe(0);
  expect(calculator.totals.totalSimulatedScore).toBe(0);
  expect(calculator.changeSummary).toEqual([]);
}

beforeEach(() => {
  requests = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve, rejectResponse) => {
    requests.push({ url: new URL(String(input), "https://synthetic.invalid"), signal: init!.signal as AbortSignal, resolve, reject: rejectResponse });
  })));
});

afterEach(() => vi.unstubAllGlobals());

describe("same-report explicit drafts", () => {
  it.each(["reentry", "refresh"])("preserves edited inputs after settled %s and updates untouched defaults and source fields", async (mode) => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "7,50"));
    if (mode === "reentry") {
      rerender({ ...defaults, enabled: false });
      rerender(defaults);
    } else {
      await refresh(result.current);
    }
    const pending = await requestAt(1);
    expect(result.current.refreshing).toBe(true);
    await answer(pending, payload([metric("EDIT", 6, { khThang: 20, displayName: "fresh name" }), metric("UNTOUCHED", 8)]));
    expect(result.current.draftValues).toEqual({ EDIT: "7,50", UNTOUCHED: "8" });
    expect(result.current.rows.find((row) => row.kpiCode === "EDIT")).toMatchObject({ thCurrent: 6, thSimulated: 7.5, khThang: 20, displayName: "fresh name" });
    expect(result.current.refreshing).toBe(false);
    expect(requests).toHaveLength(2);
  });

  it.each(["0", "", "7.50", "7,50", ".5", ",", "4"])("retains the exact accepted raw text %j across Refresh", async (value) => {
    const { result } = await loaded();
    act(() => result.current.setDraftValue("EDIT", value));
    await answer(await refresh(result.current), payload([metric("EDIT", 9)]));
    expect(result.current.draftValues.EDIT).toBe(value);
    expect(hasDraftEdits(result.current)).toBe(true);
  });

  it("retains capped edits even when dirtyCount is zero", async () => {
    const { result } = await loaded({}, payload([metric("EDIT", 15)]));
    act(() => result.current.setDraftValue("EDIT", "20"));
    expect(result.current.dirtyCount).toBe(0);
    await answer(await refresh(result.current), payload([metric("EDIT", 18)]));
    expect(result.current.draftValues.EDIT).toBe("20");
    expect(result.current.dirtyCount).toBe(0);
    expect(hasDraftEdits(result.current)).toBe(true);
  });

  it("rejects invalid input without replacing the last accepted text", async () => {
    const { result } = await loaded();
    act(() => {
      result.current.setDraftValue("EDIT", "7,50");
      result.current.setDraftValue("EDIT", "-1");
      result.current.setDraftValue("EDIT", "7.555");
    });
    await answer(await refresh(result.current));
    expect(result.current.draftValues.EDIT).toBe("7,50");
  });

  it.each(["typing", "step", "target"])("keeps latest %s performed during pending GET", async (action) => {
    const { result } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "5"));
    const pending = await refresh(result.current);
    act(() => {
      if (action === "typing") {
        result.current.setDraftValue("EDIT", "6");
        result.current.setDraftValue("EDIT", "7,50");
      } else if (action === "step") {
        result.current.stepDraftValue("EDIT", 1);
        result.current.stepDraftValue("EDIT", 1);
      } else result.current.setTargetValue("EDIT");
    });
    await answer(pending, payload([metric("EDIT", 9), metric("UNTOUCHED", 8)]));
    expect(result.current.draftValues).toEqual({ EDIT: action === "typing" ? "7,50" : action === "step" ? "7" : "10", UNTOUCHED: "8" });
  });

  it("Reset during pending GET discards all overrides and receives fresh defaults", async () => {
    const { result } = await loaded();
    act(() => { result.current.setDraftValue("EDIT", "9"); result.current.setDraftValue("UNTOUCHED", "7"); });
    const pending = await refresh(result.current);
    act(() => result.current.resetSimulation());
    expect(result.current.draftValues).toEqual({ EDIT: "4", UNTOUCHED: "3" });
    await answer(pending, payload([metric("EDIT", 6), metric("UNTOUCHED", 8)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6", UNTOUCHED: "8" });
    expect(hasDraftEdits(result.current)).toBe(false);
  });

  it("edits made after pending Reset are the only overrides retained", async () => {
    const { result } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    const pending = await refresh(result.current);
    act(() => { result.current.resetSimulation(); result.current.setDraftValue("UNTOUCHED", "0"); });
    await answer(pending, payload([metric("EDIT", 6), metric("UNTOUCHED", 8)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6", UNTOUCHED: "0" });
  });

  it("Reset after Refresh uses new server defaults", async () => {
    const { result } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    await answer(await refresh(result.current), payload([metric("EDIT", 6)]));
    act(() => result.current.resetSimulation());
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
    expect(hasDraftEdits(result.current)).toBe(false);
  });

  it("prunes removed overrides, initializes added metrics and never resurrects readded overrides", async () => {
    const { result } = await loaded();
    act(() => { result.current.setDraftValue("EDIT", "9"); result.current.setDraftValue("UNTOUCHED", "7"); });
    await answer(await refresh(result.current), payload([metric("UNTOUCHED", 8), metric("NEW", 2)]));
    expect(result.current.draftValues).toEqual({ UNTOUCHED: "7", NEW: "2" });
    await answer(await refresh(result.current), payload([metric("EDIT", 6), metric("NEW", 5)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6", NEW: "5" });
    expect(hasDraftEdits(result.current)).toBe(false);
  });

  it.each(["http", "network"])("retains same-context rows and latest drafts on %s failure", async (failure) => {
    const { result } = await loaded();
    const pending = await refresh(result.current);
    act(() => result.current.setDraftValue("EDIT", "7"));
    if (failure === "http") await answer(pending, payload(), false);
    else await reject(pending);
    expect(result.current.errorMessage).toContain("synthetic");
    expect(result.current.draftValues).toEqual({ EDIT: "7", UNTOUCHED: "3" });
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.refreshing).toBe(false);
  });

  it("equivalent scope values and renewed callbacks do not clear drafts or issue another GET", async () => {
    const { result, rerender } = await loaded({ onResolvedReportDate: vi.fn() });
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, scopeKey: JSON.stringify(["user-a", "ADMIN", 0]), onResolvedReportDate: vi.fn() });
    expect(result.current.draftValues.EDIT).toBe("9");
    expect(requests).toHaveLength(1);
  });

  it("coalesces pending Refreshes without dropping mid-request edits", async () => {
    const { result, rerender } = await loaded();
    const pending = await refresh(result.current);
    rerender({ ...defaults, onResolvedReportDate: vi.fn() });
    await refresh(result.current);
    act(() => result.current.setDraftValue("EDIT", "8"));
    expect(requests).toHaveLength(2);
    await answer(pending);
    expect(result.current.draftValues.EDIT).toBe("8");
  });

  it("drops drafts across full unmount", async () => {
    const first = await loaded();
    act(() => first.result.current.setDraftValue("EDIT", "9"));
    first.unmount();
    const second = mount();
    await answer(await requestAt(1));
    expect(second.result.current.draftValues.EDIT).toBe("4");
    expect(hasDraftEdits(second.result.current)).toBe(false);
  });
});

describe("one bounded active context", () => {
  const transitions: [string, Partial<Options>][] = [
    ["date", { reportDate: "2026-10-26" }],
    ["CTV", { selectedCtv: "CTV_B" }],
    ["authenticated scope", { scopeKey: JSON.stringify(["user-b", "ADMIN", 0]) }],
    ["import revision", { scopeKey: JSON.stringify(["user-a", "ADMIN", 1]) }],
  ];

  it.each(transitions)("hides old rows, totals and drafts immediately on %s change", async (_name, change) => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, ...change });
    expectEmpty(result.current);
    expect(result.current.loading).toBe(true);
    await answer(await requestAt(1), payload([metric("EDIT", 6)], change.reportDate));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
    expect(hasDraftEdits(result.current)).toBe(false);
  });

  it.each(transitions)("A to pending B to A does not resurrect drafts or dedupe away data for %s", async (_name, change) => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, ...change });
    const pending = await requestAt(1);
    rerender(defaults);
    expectEmpty(result.current);
    await answer(await requestAt(2), payload([metric("EDIT", 6)]));
    expect(pending.signal.aborted).toBe(true);
    await answer(pending, payload([metric("EDIT", 2)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
    expect(requests).toHaveLength(3);
  });

  it.each(transitions)("invalidates a hidden draft when %s changes and returns before reentry", async (_name, change) => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, enabled: false });
    rerender({ ...defaults, ...change, enabled: false });
    expectEmpty(result.current);
    rerender({ ...defaults, enabled: false });
    expectEmpty(result.current);
    expect(requests).toHaveLength(1);
    rerender(defaults);
    await answer(await requestAt(1), payload([metric("EDIT", 6)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
  });

  it.each(["logout", "empty CTV"])("clears and hides the snapshot on %s, even off-view", async (transition) => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, enabled: false, ...(transition === "logout" ? { hasSession: false } : { selectedCtv: "" }) });
    expectEmpty(result.current);
    expect(requests).toHaveLength(1);
    rerender(defaults);
    expectEmpty(result.current);
    await answer(await requestAt(1));
    expect(result.current.draftValues.EDIT).toBe("4");
  });

  it.each(["logout", "empty CTV"])("cancels a pending request on %s and ignores its reply", async (transition) => {
    const { result, rerender } = await loaded();
    const pending = await refresh(result.current);
    rerender({ ...defaults, ...(transition === "logout" ? { hasSession: false } : { selectedCtv: "" }) });
    expect(pending.signal.aborted).toBe(true);
    await answer(pending, payload([metric("EDIT", 9)]));
    expectEmpty(result.current);
  });

  it("different-context failure has no previous snapshot fallback", async () => {
    const { result, rerender } = await loaded();
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, selectedCtv: "CTV_B" });
    await answer(await requestAt(1), payload(), false);
    expectEmpty(result.current);
    expect(result.current.errorMessage).toBe("synthetic failure");
    expect(result.current.loading).toBe(false);
  });

  it("old replies cannot change current drafts, date callback, errors or loading", async () => {
    const callback = vi.fn();
    const { result, rerender } = mount({ reportDate: "", onResolvedReportDate: callback });
    const old = await requestAt(0);
    rerender({ ...defaults, selectedCtv: "CTV_B", onResolvedReportDate: callback });
    await answer(await requestAt(1), payload([metric("EDIT", 6)]));
    act(() => result.current.setDraftValue("EDIT", "8"));
    await answer(old, payload([metric("EDIT", 2)], "2026-10-24"));
    expect(result.current.draftValues.EDIT).toBe("8");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each(["typing", "step", "target", "reset", "fetch"])("captured old-context %s handlers cannot mutate a later A after A to B to A", async (action) => {
    const { result, rerender } = await loaded();
    const old = result.current;
    rerender({ ...defaults, selectedCtv: "CTV_B" });
    await answer(await requestAt(1), payload([metric("EDIT", 6)]));
    rerender(defaults);
    await answer(await requestAt(2), payload([metric("EDIT", 8)]));
    act(() => result.current.setDraftValue("EDIT", "7"));
    await act(async () => {
      if (action === "typing") old.setDraftValue("EDIT", "1");
      else if (action === "step") old.stepDraftValue("EDIT", 1);
      else if (action === "target") old.setTargetValue("EDIT");
      else if (action === "reset") old.resetSimulation();
      else void old.fetchCalculator({ force: true });
    });
    expect(result.current.draftValues.EDIT).toBe("7");
    expect(requests).toHaveLength(3);
  });

  it("ignores irrelevant selected CTV changes for a self-only session", async () => {
    const { result, rerender } = await loaded({ canSelectCtv: false });
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, canSelectCtv: false, selectedCtv: "CTV_B" });
    expect(result.current.draftValues.EDIT).toBe("9");
    expect(requests[0].url.searchParams.has("ctvUser")).toBe(false);
    expect(requests).toHaveLength(1);
  });
});

describe("canonical date aliases and StrictMode", () => {
  it("initial blank to resolved alias emits one date, one GET and retains edits", async () => {
    const reported = vi.fn();
    const { result, rerender } = renderHook(() => {
      const [date, setDate] = useState("");
      return useKpiCalculator({ ...defaults, reportDate: date, onResolvedReportDate: (value) => { reported(value); setDate(value); } });
    });
    await answer(await requestAt(0));
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender();
    expect(result.current.draftValues.EDIT).toBe("9");
    expect(reported).toHaveBeenCalledExactlyOnceWith(defaults.reportDate);
    expect(requests).toHaveLength(1);
    await answer(await refresh(result.current), payload([metric("EDIT", 6)]));
    expect(result.current.draftValues.EDIT).toBe("9");
  });

  it("delayed parent adoption of resolved alias retains existing edits and coalescing", async () => {
    const callback = vi.fn();
    const { result, rerender } = await loaded({ reportDate: "", onResolvedReportDate: callback });
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, onResolvedReportDate: vi.fn() });
    expect(result.current.draftValues.EDIT).toBe("9");
    expect(requests).toHaveLength(1);
  });

  it("later explicit blank intent resets the old resolved-date override", async () => {
    const { result, rerender } = await loaded({ reportDate: "" });
    rerender(defaults);
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, reportDate: "" });
    expectEmpty(result.current);
    await answer(await requestAt(1), payload([metric("EDIT", 6)], "2026-10-26"));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
  });

  it("a newer latest date returned for a still-blank request cannot inherit the previous date override", async () => {
    const { result } = await loaded({ reportDate: "" });
    act(() => result.current.setDraftValue("EDIT", "9"));
    await answer(await refresh(result.current), payload([metric("EDIT", 6)], "2026-10-26"));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
    expect(hasDraftEdits(result.current)).toBe(false);
  });

  it("an old initial alias cannot suppress loading after leaving and returning while B is pending", async () => {
    const { result, rerender } = await loaded({ reportDate: "" });
    rerender(defaults);
    act(() => result.current.setDraftValue("EDIT", "9"));
    rerender({ ...defaults, reportDate: "2026-10-24" });
    const pending = await requestAt(1);
    rerender(defaults);
    await answer(await requestAt(2), payload([metric("EDIT", 6)]));
    await answer(pending, payload([metric("EDIT", 2)], "2026-10-24"));
    expect(result.current.draftValues).toEqual({ EDIT: "6" });
  });

  it("StrictMode keeps atomic latest edits through Refresh and Reset", async () => {
    const { result } = await loaded({}, payload(), true);
    expect(requests).toHaveLength(1);
    const pending = await refresh(result.current);
    act(() => {
      result.current.setDraftValue("EDIT", "5");
      result.current.stepDraftValue("EDIT", 1);
      result.current.resetSimulation();
      result.current.setDraftValue("UNTOUCHED", "0");
    });
    await answer(pending, payload([metric("EDIT", 6), metric("UNTOUCHED", 8)]));
    expect(result.current.draftValues).toEqual({ EDIT: "6", UNTOUCHED: "0" });
    expect(hasDraftEdits(result.current)).toBe(true);
  });
});

function LiveCalculator() {
  const calculator = useKpiCalculator(defaults);
  return <>
    <output data-testid="dirty-count">{calculator.dirtyCount}</output>
    <KpiCalculatorPanel
      {...defaults} ctvOptions={[]} loading={calculator.loading} refreshing={calculator.refreshing}
      errorMessage={calculator.errorMessage} rows={calculator.rows} changeSummaryRows={calculator.changeSummary}
      draftValues={calculator.draftValues} dirtyCount={calculator.dirtyCount} totals={calculator.totals}
      {...{ hasDraftEdits: hasDraftEdits(calculator) }}
      surfaceActionBtnClass="action" surfacePrimaryBtnClass="primary" surfaceBadgeClass="badge" surfaceChipClass="chip"
      getPercentBgClass={() => ""} getPercentClass={() => ""} getThieuBgClass={() => ""} getThieuClass={() => ""}
      onBack={() => undefined} onSelectedCtvChange={() => undefined} onReportDateChange={() => undefined}
      onRefresh={() => { void calculator.fetchCalculator({ force: true }); }} onReset={calculator.resetSimulation}
      onDraftValueChange={calculator.setDraftValue} onStepDraftValue={calculator.stepDraftValue} onSetTargetValue={calculator.setTargetValue}
    />
  </>;
}

it.each([["capped", 15, "20"], ["empty", 0, ""], ["raw", 4, "4,00"]] as const)("Reset is reachable for a %s explicit edit with zero score delta", async (_name, value, draft) => {
  render(<LiveCalculator />);
  await answer(await requestAt(0), payload([metric("EDIT", value)]));
  const resetButton = screen.getByRole("button", { name: "Khôi phục dữ liệu gốc" });
  expect(resetButton).toBeDisabled();
  fireEvent.change(screen.getAllByRole("textbox", { name: "TH giả lập của EDIT" })[0], { target: { value: draft } });
  expect(screen.getByTestId("dirty-count")).toHaveTextContent("0");
  expect(resetButton).toBeEnabled();
  fireEvent.click(resetButton);
  expect(screen.getAllByRole("textbox", { name: "TH giả lập của EDIT" })[0]).toHaveValue(String(value));
  expect(resetButton).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Làm mới/ }));
  await answer(await requestAt(1), payload([metric("EDIT", 6)]));
  expect(screen.getAllByRole("textbox", { name: "TH giả lập của EDIT" })[0]).toHaveValue("6");
  expect(resetButton).toBeDisabled();
});

it.each([
  ["constructor", false], ["constructor", true],
  ["toString", false], ["toString", true],
  ["hasOwnProperty", false], ["hasOwnProperty", true],
] as const)("steps from the source default for inherited-name metric %s afterReset=%s", async (kpiCode, afterReset) => {
  const { result } = await loaded({}, payload([metric(kpiCode, 4)]));
  if (afterReset) {
    act(() => result.current.setDraftValue(kpiCode, "9"));
    act(() => result.current.resetSimulation());
  }
  expect(result.current.draftValues[kpiCode]).toBe("4");
  expect(result.current.hasDraftEdits).toBe(false);
  act(() => result.current.stepDraftValue(kpiCode, 1));
  expect(result.current.draftValues[kpiCode]).toBe("5");
  expect(result.current.hasDraftEdits).toBe(true);
});
