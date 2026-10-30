// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Component, useEffect, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type AsyncState from "@/components/ui/AsyncState";

const runtime = vi.hoisted(() => ({
  session: { user: { id: "synthetic-admin", name: "synthetic-admin", role: "ADMIN" } },
  view: "",
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: runtime.session, status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => runtime.router, useSearchParams: () => new URLSearchParams({ view: runtime.view }) }));
vi.mock("next/dynamic", async () => ({ default: (await import("next/dist/shared/lib/app-dynamic")).default }));

const panels = [
  { view: "personal", module: "PersonalKpiPanelClean", endpoint: "/api/kpi/report", back: "" },
  { view: "kpi-calculator", module: "KpiCalculatorPanel", endpoint: "/api/kpi/report", back: "/prepaid" },
  { view: "official-docs", module: "OfficialDocsPanel", endpoint: "/api/official-documents", back: "/prepaid" },
  { view: "cdt", module: "CdtPanelClean", endpoint: "/api/cdt/report", back: "/prepaid" },
  { view: "cdt-report", module: "CdtSummaryPanelClean", endpoint: "/api/cdt/summary", back: "/prepaid?view=cdt" },
  { view: "cdt-outstanding", module: "CdtOutstandingPanelClean", endpoint: "/api/cdt/outstanding/report", back: "/prepaid?view=cdt" },
  { view: "disconnect", module: "DisconnectPanelClean", endpoint: "/api/disconnect/report", back: "/prepaid" },
  { view: "cuoc", module: "CuocPanelClean", endpoint: "/api/cuoc/report", back: "/prepaid" },
  { view: "cuoc-cd", module: "CuocCdPanelClean", endpoint: "/api/cuoc-cd/report", back: "/prepaid" },
  { view: "summary", module: "SummaryKpiPanelClean", endpoint: "/api/kpi/summary", back: "/prepaid" },
  { view: "summary-manager", module: "ManagerSummaryKpiPanelClean", endpoint: "/api/kpi/manager-summary", back: "/prepaid?view=summary" },
];

type ObservedPanelProps = {
  reportDate?: string;
  selectedCtv?: string;
  managerFilter?: string;
  draftValues?: Record<string, string>;
  onReportDateChange?: (value: string) => void;
  onSelectedCtvChange?: (value: string) => void;
  onManagerFilterChange?: (value: string) => void;
  onDraftValueChange?: (code: string, value: string) => void;
  onBack?: () => void;
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}

class ChunkBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let evaluated: string[];
let mounted: Set<string>;
let moduleGates: Map<string, ReturnType<typeof deferred<void>>>;
let requests: URL[];
let holdReports: boolean;
let pendingReports: ReturnType<typeof deferred<Response>>[];
let panelFactories: Map<string, () => Promise<{ default: ReturnType<typeof observePanel> }>>;

function observePanel(view: string, observedMounted: Set<string>) {
  return function ObservedPanel(props: ObservedPanelProps) {
    useEffect(() => {
      observedMounted.add(view);
      return () => { observedMounted.delete(view); };
    }, []);
    return <section aria-label={view}>
      {props.onReportDateChange && <input aria-label="report date" type="date" value={props.reportDate} onChange={(event) => props.onReportDateChange?.(event.target.value)} />}
      {props.onSelectedCtvChange && <select aria-label="CTV" value={props.selectedCtv} onChange={(event) => props.onSelectedCtvChange?.(event.target.value)}>
        {["", "CTV_A", "CTV_B"].map((value) => <option key={value} value={value}>{value || "auto"}</option>)}
      </select>}
      {props.onManagerFilterChange && <input aria-label="manager" value={props.managerFilter} onChange={(event) => props.onManagerFilterChange?.(event.target.value)} />}
      {props.onDraftValueChange && <input aria-label="calculator draft" value={props.draftValues?.METRIC_TEST || ""} onChange={(event) => props.onDraftValueChange?.("METRIC_TEST", event.target.value)} />}
      {props.onBack && <button onClick={props.onBack}>back</button>}
    </section>;
  };
}

function reportPayload(reportDate = "2026-10-25") {
  return {
    reportDate,
    rows: [{ kpiCode: "METRIC_TEST", displayName: "Synthetic metric", khThang: 10, thNgay: 4, thLuyKe: 4, completionPercent: 40, baseScore: 10, maxPercent: 120, maxScore: 12, achievedScore: 4 }],
    totalBaseScore: 10,
    totalAchievedScore: 4,
  };
}

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

function dataPaths() {
  return [...new Set(requests.filter((url) => url.pathname !== "/api/me").map((url) => url.pathname))];
}

async function settleDebounces() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 360)); });
}

async function loadShell(view = "") {
  runtime.view = view;
  const { default: PrepaidPage } = await import("@/app/(dashboard)/prepaid/PrepaidPageImpl");
  const { ConfirmDialogProvider } = await import("@/components/ui/ConfirmDialogProvider");
  expect(evaluated).toEqual(["personal"]);
  const page = () => <ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>;
  return { page };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  runtime.session = { user: { id: "synthetic-admin", name: "synthetic-admin", role: "ADMIN" } };
  runtime.view = "";
  evaluated = [];
  mounted = new Set();
  moduleGates = new Map();
  requests = [];
  holdReports = false;
  pendingReports = [];
  panelFactories = new Map();
  const evaluatedForCase = evaluated;
  const mountedForCase = mounted;
  const gatesForCase = moduleGates;
  for (const panel of panels) {
    const factory = async () => {
      evaluatedForCase.push(panel.view);
      await gatesForCase.get(panel.view)?.promise;
      return { default: observePanel(panel.view, mountedForCase) };
    };
    panelFactories.set(panel.view, factory);
    vi.doMock(`@/app/(dashboard)/prepaid/${panel.module}`, factory);
  }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://synthetic.invalid");
    requests.push(url);
    if (url.pathname === "/api/me") return jsonResponse({
      id: runtime.session.user.id, role: runtime.session.user.role,
      ctvList: [{ id: "ctv-a", username: "CTV_A", managerCode: "MANAGER_A" }, { id: "ctv-b", username: "CTV_B", managerCode: "MANAGER_B" }],
    });
    if (url.pathname === "/api/kpi/report") {
      if (holdReports) {
        const pending = deferred<Response>();
        pendingReports.push(pending);
        return pending.promise;
      }
      return jsonResponse(reportPayload(url.searchParams.get("reportDate") || undefined));
    }
    if (url.pathname === "/api/official-documents") return jsonResponse({ items: [], categories: [] });
    if (["/api/kpi/summary", "/api/kpi/manager-summary"].includes(url.pathname)) {
      return jsonResponse({ rows: [], allRows: [], indicators: [], selectedGroup: "", reportDate: url.searchParams.get("reportDate") || "2026-10-25", isNegativeGroup: false, maxPercent: 120 });
    }
    if (["/api/cdt/report", "/api/cdt/summary", "/api/cdt/outstanding/report", "/api/disconnect/report", "/api/cuoc/report", "/api/cuoc-cd/report"].includes(url.pathname)) {
      return jsonResponse({ rows: [], summaryRow: null, pagination: { page: 1, totalPages: 1 }, availableReportMonths: [], availableExpiryMonths: [], availableCancelMonths: [] });
    }
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("@/components/ui/AsyncState");
  for (const panel of panels) vi.doUnmock(`@/app/(dashboard)/prepaid/${panel.module}`);
});

describe("prepaid on-demand panel code", () => {
  it("keeps personal entry static without evaluating calculator, documents, CDT or other report modules", async () => {
    const { page } = await loadShell();
    render(page());
    await screen.findByRole("region", { name: "personal" });
    await waitFor(() => expect(dataPaths()).toEqual(["/api/kpi/report"]));
    await settleDebounces();
    expect(evaluated).toEqual(["personal"]);
    expect([...mounted]).toEqual(["personal"]);
    expect(dataPaths()).toEqual(["/api/kpi/report"]);
  });

  it.each(panels.slice(1))("evaluates and mounts only $view report UI and leaves off-view APIs unfetched", async ({ view, endpoint, back }) => {
    const { page } = await loadShell(view);
    render(page());
    await screen.findByRole("region", { name: view });
    await waitFor(() => expect(dataPaths()).toContain(endpoint));
    await settleDebounces();
    expect(evaluated).toEqual(["personal", view]);
    expect([...mounted]).toEqual([view]);
    expect(dataPaths()).toEqual([endpoint]);
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(runtime.router.push).toHaveBeenCalledWith(back);
  });

  it("shows an accessible bounded skeleton and starts the API before pending calculator code resolves", async () => {
    const { page } = await loadShell("kpi-calculator");
    const pending = deferred<void>();
    moduleGates.set("kpi-calculator", pending);
    render(page());
    const status = await screen.findByRole("status", { name: "Đang tải báo cáo" });
    expect(status).toHaveAttribute("aria-busy", "true");
    const { default: styles } = await import("@/app/(dashboard)/prepaid/kpi.module.css");
    expect(status).toHaveClass(styles.container);
    expect(status.querySelector(`.${styles.skeletonWrap}`)).toHaveAttribute("aria-hidden", "true");
    expect(status.querySelectorAll(`.${styles.skeletonStatCard}`)).toHaveLength(4);
    expect(status.querySelectorAll(`.${styles.skeletonRow}`)).toHaveLength(5);
    await waitFor(() => expect(dataPaths()).toEqual(["/api/kpi/report"]));
    expect([...mounted]).toEqual([]);
    expect(screen.queryByRole("region", { name: "kpi-calculator" })).not.toBeInTheDocument();
    await act(async () => pending.resolve());
    await screen.findByRole("region", { name: "kpi-calculator" });
    expect(screen.queryByRole("status", { name: "Đang tải báo cáo" })).not.toBeInTheDocument();
    expect(evaluated).toEqual(["personal", "kpi-calculator"]);
  });

  it("routes a rejected selected chunk to the prepaid error UI with explicit draft-loss recovery", async () => {
    const { page } = await loadShell("kpi-calculator");
    const { default: PrepaidError } = await import("@/app/(dashboard)/prepaid/error");
    const pending = deferred<void>();
    moduleGates.set("kpi-calculator", pending);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ChunkBoundary fallback={<PrepaidError />}>{page()}</ChunkBoundary>);
    await screen.findByRole("status", { name: "Đang tải báo cáo" });
    await act(async () => pending.reject(new Error("SYNTHETIC_CHUNK_DETAIL")));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không thể tải báo cáo");
    expect(alert).toHaveTextContent(/bản nháp.*xóa/i);
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeInTheDocument();
    expect(alert).not.toHaveTextContent("SYNTHETIC_CHUNK_DETAIL");
    expect(consoleError).toHaveBeenCalled();
    expect(evaluated).toEqual(["personal", "kpi-calculator"]);
    expect([...mounted]).toEqual([]);
  });

  it("uses AsyncState error styling and a full-page reload action instead of resetting a rejected lazy promise", async () => {
    let recoveryProps: ComponentProps<typeof AsyncState> | undefined;
    vi.doMock("@/components/ui/AsyncState", () => ({ default: (props: ComponentProps<typeof AsyncState>) => {
      recoveryProps = props;
      return <button onClick={props.onAction}>{props.actionLabel}</button>;
    } }));
    const { default: PrepaidError } = await import("@/app/(dashboard)/prepaid/error");
    render(<PrepaidError />);
    expect(recoveryProps?.status).toBe("error");
    expect(recoveryProps?.actionLabel).toBe("Tải lại trang");
    expect(recoveryProps?.description).toMatch(/bản nháp.*xóa/i);
    const reload = vi.fn();
    const browserWindow = window;
    vi.stubGlobal("window", { location: { reload } });
    try {
      recoveryProps?.onAction?.();
    } finally {
      vi.stubGlobal("window", browserWindow);
    }
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("preserves shell date/CTV and calculator draft across view/back while reentry refresh is pending", async () => {
    const { page } = await loadShell();
    const { rerender } = render(page());
    await waitFor(() => expect(screen.getByLabelText("CTV")).toHaveValue("CTV_A"));
    fireEvent.change(screen.getByLabelText("CTV"), { target: { value: "CTV_B" } });
    fireEvent.change(screen.getByLabelText("report date"), { target: { value: "2026-10-24" } });
    await settleDebounces();
    runtime.view = "kpi-calculator";
    rerender(page());
    await screen.findByRole("region", { name: "kpi-calculator" });
    await waitFor(() => expect(screen.getByLabelText("calculator draft")).toHaveValue("4"));
    expect(screen.getByLabelText("report date")).toHaveValue("2026-10-24");
    expect(screen.getByLabelText("CTV")).toHaveValue("CTV_B");
    fireEvent.change(screen.getByLabelText("calculator draft"), { target: { value: "7" } });
    holdReports = true;
    runtime.view = "official-docs";
    rerender(page());
    await screen.findByRole("region", { name: "official-docs" });
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(runtime.router.push).toHaveBeenCalledWith("/prepaid");
    runtime.view = "";
    rerender(page());
    expect(screen.getByLabelText("report date")).toHaveValue("2026-10-24");
    expect(screen.getByLabelText("CTV")).toHaveValue("CTV_B");
    runtime.view = "kpi-calculator";
    rerender(page());
    await screen.findByRole("region", { name: "kpi-calculator" });
    expect(screen.getByLabelText("calculator draft")).toHaveValue("7");
    expect(screen.getByLabelText("report date")).toHaveValue("2026-10-24");
    expect(screen.getByLabelText("CTV")).toHaveValue("CTV_B");
    await waitFor(() => expect(pendingReports.length).toBeGreaterThan(0));
    expect(requests.at(-1)?.searchParams.get("ctvUser")).toBe("CTV_B");
    expect(requests.at(-1)?.searchParams.get("reportDate")).toBe("2026-10-24");
    expect(evaluated).toEqual(["personal", "kpi-calculator", "official-docs"]);
  });

  it("retains the shared manager and explicit date between summary views", async () => {
    const { page } = await loadShell("summary");
    const { rerender } = render(page());
    await screen.findByRole("region", { name: "summary" });
    fireEvent.change(screen.getByLabelText("manager"), { target: { value: "MANAGER_B" } });
    fireEvent.change(screen.getByLabelText("report date"), { target: { value: "2026-10-24" } });
    await settleDebounces();
    runtime.view = "summary-manager";
    rerender(page());
    await screen.findByRole("region", { name: "summary-manager" });
    expect(screen.getByLabelText("manager")).toHaveValue("MANAGER_B");
    expect(screen.getByLabelText("report date")).toHaveValue("2026-10-24");
    await waitFor(() => expect(requests.some((url) => url.pathname === "/api/kpi/manager-summary" && url.searchParams.get("managerCode") === "MANAGER_B" && url.searchParams.get("reportDate") === "2026-10-24")).toBe(true));
  });

  it.each([
    { view: "summary", role: "CTV", redirects: false },
    { view: "summary-manager", role: "CTV", redirects: true },
    { view: "cdt-report", role: "CTV", redirects: false },
    { view: "kpi-calculator", role: "UNSUPPORTED", redirects: true },
  ])("does not evaluate restricted $view code for $role", async ({ view, role, redirects }) => {
    runtime.session.user.role = role;
    const { page } = await loadShell(view);
    render(page());
    await settleDebounces();
    expect(evaluated).toEqual(["personal"]);
    expect([...mounted]).toEqual(redirects ? [] : ["personal"]);
    expect(screen.queryByRole("region", { name: view })).not.toBeInTheDocument();
  });

  it("keeps a registered panel factory's evaluation and gate in its original observation bucket", async () => {
    const originalEvaluated = evaluated;
    const originalMounted = mounted;
    const originalGates = moduleGates;
    const gate = deferred<void>();
    originalGates.set("kpi-calculator", gate);
    const factory = panelFactories.get("kpi-calculator")!;
    evaluated = [];
    mounted = new Set();
    moduleGates = new Map();
    let settled = false;
    const pending = factory().then((module) => { settled = true; return module; });
    try {
      await act(async () => { await Promise.resolve(); });
      expect(originalEvaluated).toEqual(["kpi-calculator"]);
      expect(evaluated).toEqual([]);
      expect(settled).toBe(false);
      gate.resolve();
      await pending;
      expect(settled).toBe(true);
    } finally {
      gate.resolve();
      await pending;
      evaluated = originalEvaluated;
      mounted = originalMounted;
      moduleGates = originalGates;
    }
  });

  it("keeps a delayed panel's mount and cleanup out of the next observation bucket", async () => {
    const originalMounted = mounted;
    const originalGates = moduleGates;
    const gate = deferred<void>();
    moduleGates.set("kpi-calculator", gate);
    const pending = panelFactories.get("kpi-calculator")!();
    mounted = new Set(["kpi-calculator"]);
    moduleGates = new Map();
    try {
      gate.resolve();
      const { default: ObservedPanel } = await pending;
      const rendered = render(<ObservedPanel />);
      expect(originalMounted.has("kpi-calculator")).toBe(true);
      expect(mounted.has("kpi-calculator")).toBe(true);
      rendered.unmount();
      expect(originalMounted.has("kpi-calculator")).toBe(false);
      expect(mounted.has("kpi-calculator")).toBe(true);
    } finally {
      gate.resolve();
      await pending;
      cleanup();
      mounted = originalMounted;
      moduleGates = originalGates;
    }
  });
});
