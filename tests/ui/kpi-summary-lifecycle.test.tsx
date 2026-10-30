// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrepaidPage from "@/app/(dashboard)/prepaid/PrepaidPageImpl";
import type SummaryPanel from "@/app/(dashboard)/prepaid/SummaryKpiPanelClean";
import type ManagerPanel from "@/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean";
import type PersonalPanel from "@/app/(dashboard)/prepaid/PersonalKpiPanelClean";
import type CalculatorPanel from "@/app/(dashboard)/prepaid/KpiCalculatorPanel";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const runtime = vi.hoisted(() => ({
  session: { user: { id: "scope-a", name: "synthetic-admin", role: "ADMIN" } },
  view: "summary",
  router: { push: vi.fn(), replace: vi.fn() },
  error: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: runtime.session, status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => runtime.router, useSearchParams: () => new URLSearchParams({ view: runtime.view }) }));
vi.mock("react-hot-toast", () => ({ default: { error: runtime.error, success: vi.fn() } }));

type PanelProps = {
  date: string;
  manager: string;
  group: string;
  groups: string[];
  rows: unknown[];
  allRows?: unknown[];
  meta: unknown;
  busy: boolean;
  error: string | null;
  onDate: (value: string) => void;
  onManager: (value: string) => void;
  onGroup: (value: string) => void;
  onRefresh: () => void;
  onImport?: ComponentProps<typeof ManagerPanel>["onImportManagerKpi"];
};

function LifecyclePanel(props: PanelProps) {
  return <section>
    <input aria-label="date" type="date" value={props.date} onChange={(event) => props.onDate(event.target.value)} />
    <select aria-label="manager" value={props.manager} onChange={(event) => props.onManager(event.target.value)}>
      {["", "MANAGER_A", "MANAGER_B"].map((value) => <option key={value} value={value}>{value || "auto"}</option>)}
    </select>
    <select aria-label="group" value={props.group} onChange={(event) => props.onGroup(event.target.value)}>
      {["", "GROUP_A", "GROUP_B", "__all__"].map((value) => <option key={value} value={value}>{value || "auto"}</option>)}
    </select>
    <output data-testid="rows">{JSON.stringify(props.rows)}</output>
    <output data-testid="allRows">{JSON.stringify(props.allRows || [])}</output>
    <output data-testid="groups">{JSON.stringify(props.groups)}</output>
    <output data-testid="meta">{JSON.stringify(props.meta)}</output>
    <output data-testid="busy">{String(props.busy)}</output>
    <output data-testid="error">{props.error || ""}</output>
    <button onClick={props.onRefresh}>refresh</button>
    <input aria-label="import" type="file" onChange={props.onImport} />
  </section>;
}

vi.mock("@/app/(dashboard)/prepaid/SummaryKpiPanelClean", () => ({ default: (props: ComponentProps<typeof SummaryPanel>) =>
  <LifecyclePanel date={props.reportDate} manager={props.managerFilter} group={props.selectedIndicator} groups={props.indicators}
    rows={props.summaryRows} meta={props.summaryMeta} busy={props.summaryLoading || props.summaryRefreshing} error={props.errorMessage}
    onDate={props.onReportDateChange} onManager={props.onManagerFilterChange} onGroup={props.onIndicatorChange} onRefresh={props.onRefresh} />,
}));
vi.mock("@/app/(dashboard)/prepaid/ManagerSummaryKpiPanelClean", () => ({ default: (props: ComponentProps<typeof ManagerPanel>) =>
  <LifecyclePanel date={props.reportDate} manager={props.managerFilter} group={props.selectedManagerIndicator} groups={props.managerIndicators}
    rows={props.summaryManagerRows} allRows={props.managerSummaryAllRows} meta={props.summaryManagerMeta}
    busy={props.managerSummaryLoading || props.managerSummaryRefreshing} error={props.errorMessage}
    onDate={props.onReportDateChange} onManager={props.onManagerFilterChange} onGroup={props.onIndicatorChange}
    onRefresh={props.onRefresh} onImport={props.onImportManagerKpi} />,
}));
vi.mock("@/app/(dashboard)/prepaid/PersonalKpiPanelClean", () => ({ default: (props: ComponentProps<typeof PersonalPanel>) =>
  <section>
    <input aria-label="personal-date" type="date" value={props.reportDate} onChange={(event) => props.onReportDateChange(event.target.value)} />
    <input aria-label="personal-import" type="file" onChange={props.onImport} />
  </section>,
}));
vi.mock("@/app/(dashboard)/prepaid/KpiCalculatorPanel", () => ({ default: (props: ComponentProps<typeof CalculatorPanel>) =>
  <section>
    <input aria-label="calculator-date" type="date" value={props.reportDate} onChange={(event) => props.onReportDateChange(event.target.value)} />
    <output data-testid="calculator-rows">{JSON.stringify(props.rows)}</output>
    <output data-testid="calculator-drafts">{JSON.stringify(props.draftValues)}</output>
    <output data-testid="calculator-busy">{String(props.loading || props.refreshing)}</output>
    <output data-testid="calculator-error">{props.errorMessage || ""}</output>
  </section>,
}));

function payload(label = "CURRENT", reportDate = "2026-10-25", selectedGroup = "GROUP_A") {
  return {
    reportDate, selectedGroup, indicators: ["GROUP_A", "GROUP_B", "__all__"],
    rows: [{ ctvUser: label, managerUser: label, kh: 10, th: 4, percent: 40, thieu: 6 }],
    allRows: [{ managerUser: label, metrics: [{ name: "GROUP_A", kh: 10, th: 4, percent: 40, thieu: 6 }] }],
    isNegativeGroup: true, maxPercent: 150,
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}

type SyntheticResponse = { ok: boolean; json: () => Promise<unknown> };
type PendingRequest = ReturnType<typeof deferred<SyntheticResponse>> & { url: URL; signal?: AbortSignal | null };
let requests: PendingRequest[];
let imports: PendingRequest[];
let personalDate: string;
let personalValue: number;
let personalRequests: PendingRequest[];
let holdPersonalReports: boolean;

function personalReportPayload(reportDate = personalDate, value = personalValue) {
  return {
    reportDate,
    rows: [{ kpiCode: "METRIC_TEST", displayName: "Synthetic calculator metric", khThang: 10, thNgay: value, thLuyKe: value, completionPercent: value * 10, baseScore: 10, maxPercent: 120, maxScore: 12, achievedScore: value }],
    totalBaseScore: 10,
    totalAchievedScore: value,
  };
}

function reports(view = runtime.view) {
  const resource = view === "summary-manager" ? "/api/kpi/manager-summary" : "/api/kpi/summary";
  return requests.filter((request) => request.url.pathname === resource);
}

async function flush() {
  await act(async () => { for (let turn = 0; turn < 12; turn += 1) await Promise.resolve(); });
}

async function tick(milliseconds = 321) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
  await flush();
}

async function answer(request: PendingRequest, data: unknown = payload(), ok = true) {
  await act(async () => request.resolve({ ok, json: async () => data }));
  await flush();
}

function page() { return <ConfirmDialogProvider><PrepaidPage /></ConfirmDialogProvider>; }

async function mount(view: string) {
  runtime.view = view;
  const rendered = render(page());
  await flush();
  return rendered;
}

async function loaded(view: string) {
  const rendered = await mount(view);
  await answer(reports()[0]);
  await tick();
  for (const request of reports().slice(1)) await answer(request);
  await tick();
  return rendered;
}

function change(field: string, value: string) {
  fireEvent.change(screen.getByLabelText(field), { target: { value } });
}

function upload(label = "import") {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [new File(["synthetic"], "synthetic.xlsx")] } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  requests = [];
  imports = [];
  personalDate = "2026-10-25";
  personalValue = 4;
  personalRequests = [];
  holdPersonalReports = false;
  runtime.session = { user: { id: "scope-a", name: "synthetic-admin", role: "ADMIN" } };
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://synthetic.invalid");
    if (url.pathname === "/api/me") return Promise.resolve({ ok: true, json: async () => ({ id: runtime.session.user.id, ctvList: [{ id: "ctv-a", username: "CTV_A", managerCode: "MANAGER_A" }] }) });
    const request = { ...deferred<SyntheticResponse>(), url, signal: init?.signal };
    if (url.pathname === "/api/kpi/report") {
      personalRequests.push(request);
      if (!holdPersonalReports) request.resolve({ ok: true, json: async () => personalReportPayload(url.searchParams.get("reportDate") || personalDate) });
      return request.promise;
    }
    if (url.pathname.endsWith("import")) imports.push(request);
    else requests.push(request);
    return request.promise;
  }));
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe.each(["summary", "summary-manager"])("%s resource lifecycle", (view) => {
  it("dedupes pending loads across equivalent session objects and pending refresh", async () => {
    const { rerender } = await mount(view);
    runtime.session = { user: { ...runtime.session.user } };
    rerender(page());
    fireEvent.click(screen.getByText("refresh"));
    await flush();
    expect(reports()).toHaveLength(1);
  });

  it("aliases auto group and date through independently debounced intermediate keys", async () => {
    await mount(view);
    await answer(reports()[0], payload("RESOLVED", "2026-10-25", "GROUP_B"));
    expect(screen.getByLabelText("group")).toHaveValue("GROUP_B");
    expect(screen.getByLabelText("date")).toHaveValue("2026-10-25");
    await tick(250);
    expect(reports()).toHaveLength(1);
    await tick(70);
    expect(reports()).toHaveLength(1);
    expect(screen.getByTestId("rows")).toHaveTextContent("RESOLVED");
  });

  for (const [field, value] of [["date", "2026-10-26"], ["manager", "MANAGER_B"], ["group", "GROUP_B"]]) {
    it(`cancels stale success immediately on ${field} intent before debounce`, async () => {
      await loaded(view);
      fireEvent.click(screen.getByText("refresh"));
      await flush();
      const stale = reports().at(-1)!;
      change(field, value);
      await answer(stale, payload("STALE", "2026-10-24", "GROUP_A"));
      expect(screen.getByTestId("rows")).not.toHaveTextContent("STALE");
      expect(screen.getByTestId("busy")).toHaveTextContent("true");
      expect(stale.signal?.aborted).toBe(true);
      await tick();
      const current = reports().at(-1)!;
      expect(current).not.toBe(stale);
      const parameter = field === "date" ? "reportDate" : field === "manager" ? "managerCode" : "group";
      expect(current.url.searchParams.get(parameter)).toBe(value);
      await answer(current, payload("NEW", "2026-10-26", field === "group" ? value : "GROUP_A"));
      expect(screen.getByTestId("rows")).toHaveTextContent("NEW");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });

    it(`ignores stale error and settled callbacks in the ${field} debounce gap`, async () => {
      await loaded(view);
      fireEvent.click(screen.getByText("refresh"));
      await flush();
      const stale = reports().at(-1)!;
      change(field, value);
      await answer(stale, { error: "obsolete-error" }, false);
      expect(screen.getByTestId("error")).toBeEmptyDOMElement();
      expect(runtime.error).not.toHaveBeenCalled();
      expect(screen.getByTestId("busy")).toHaveTextContent("true");
      expect(stale.signal?.aborted).toBe(true);
    });

    it(`keeps the latest ${field} response when the replaced request finishes last`, async () => {
      await loaded(view);
      fireEvent.click(screen.getByText("refresh"));
      await flush();
      const stale = reports().at(-1)!;
      change(field, value);
      await tick();
      await answer(reports().at(-1)!, payload("LATEST", "2026-10-26", field === "group" ? value : "GROUP_A"));
      await answer(stale, payload("OUT_OF_ORDER"));
      expect(stale.signal?.aborted).toBe(true);
      expect(screen.getByTestId("rows")).toHaveTextContent("LATEST");
      expect(screen.getByTestId("rows")).not.toHaveTextContent("OUT_OF_ORDER");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });
  }

  it("aborts on hide and does not let hidden success overwrite current date or group", async () => {
    const { rerender } = await mount(view);
    const stale = reports()[0];
    runtime.view = "summary" === view ? "summary-manager" : "summary";
    rerender(page());
    await flush();
    await answer(stale, payload("HIDDEN", "2026-10-24", "GROUP_B"));
    expect(screen.getByLabelText("date")).toHaveValue("");
    expect(screen.getByLabelText("group")).toHaveValue("");
    expect(stale.signal?.aborted).toBe(true);
  });

  it("aborts on unmount and suppresses late network errors", async () => {
    const { unmount } = await mount(view);
    const stale = reports()[0];
    unmount();
    await act(async () => stale.reject(new Error("unmounted-error")));
    expect(runtime.error).not.toHaveBeenCalled();
    expect(stale.signal?.aborted).toBe(true);
  });

  for (const [field, value] of [["id", "scope-b"], ["name", "other-admin"], ["role", "MANAGER"]]) {
    it(`clears private rows/options/meta and aborts on auth ${field} change`, async () => {
      const { rerender } = await loaded(view);
      fireEvent.click(screen.getByText("refresh"));
      await flush();
      const stale = reports().at(-1)!;
      runtime.session = { user: { ...runtime.session.user, [field]: value } };
      rerender(page());
      await flush();
      expect(screen.getByTestId("rows")).toHaveTextContent("[]");
      expect(screen.getByTestId("allRows")).toHaveTextContent("[]");
      expect(screen.getByTestId("groups")).toHaveTextContent("[]");
      expect(screen.getByTestId("meta")).toHaveTextContent('"isNegativeGroup":false');
      expect(screen.getByLabelText("group")).toHaveValue("");
      expect(screen.getByLabelText("manager")).toHaveValue("");
      expect(stale.signal?.aborted).toBe(true);
      await answer(stale, payload("PRIVATE_OLD"));
      expect(screen.getByTestId("rows")).not.toHaveTextContent("PRIVATE_OLD");
      await tick();
      await answer(reports().at(-1)!, payload("NEW_SCOPE"));
      expect(screen.getByTestId("rows")).toHaveTextContent("NEW_SCOPE");
    });
  }

  it("clears old scope errors and reloads on retry and explicit refresh", async () => {
    const { rerender } = await mount(view);
    await answer(reports()[0], { error: "first-error" }, false);
    expect(screen.getByTestId("error")).toHaveTextContent("first-error");
    runtime.session = { user: { ...runtime.session.user, id: "scope-b" } };
    rerender(page());
    await flush();
    expect(screen.getByTestId("error")).toBeEmptyDOMElement();
    await answer(reports().at(-1)!, { error: "retry-error" }, false);
    fireEvent.click(screen.getByText("refresh"));
    await flush();
    const retry = reports().at(-1)!;
    await answer(retry);
    await tick();
    const count = reports().length;
    fireEvent.click(screen.getByText("refresh"));
    await flush();
    expect(reports()).toHaveLength(count + 1);
    expect(screen.getByTestId("rows")).toHaveTextContent("CURRENT");
    await answer(reports().at(-1)!, payload("REFRESHED"));
    expect(screen.getByTestId("rows")).toHaveTextContent("REFRESHED");
  });

  it("force refreshes reentry inside the dedupe window with independent owners", async () => {
    const { rerender } = await loaded(view);
    const before = reports(view).length;
    runtime.view = view === "summary" ? "summary-manager" : "summary";
    rerender(page());
    await flush();
    expect(reports(runtime.view)).toHaveLength(1);
    runtime.view = view;
    rerender(page());
    await flush();
    expect(reports(view)).toHaveLength(before + 1);
    await answer(reports(view).at(-1)!, payload("REENTRY"));
    expect(screen.getByTestId("rows")).toHaveTextContent("REENTRY");
  });
});

it("keeps manager __all__ selected and retains allRows without auto alias reloads", async () => {
  await loaded("summary-manager");
  change("group", "__all__");
  await tick();
  const request = reports().at(-1)!;
  expect(request.url.searchParams.get("group")).toBe("__all__");
  await answer(request, payload("ALL_ROWS", "2026-10-25", "GROUP_B"));
  await tick();
  expect(screen.getByLabelText("group")).toHaveValue("__all__");
  expect(screen.getByTestId("allRows")).toHaveTextContent("ALL_ROWS");
  expect(screen.getByTestId("groups")).not.toHaveTextContent("__all__");
  expect(reports().at(-1)).toBe(request);
});

it("invalidates hidden summary aliases after personal import without loading the hidden panel", async () => {
  const { rerender } = await loaded("summary");
  const before = reports("summary").length;
  runtime.view = "";
  rerender(page());
  await tick();
  upload("personal-import");
  await flush();
  personalDate = "2026-10-26";
  await answer(imports[0], { inserted: 1 });
  await tick();
  expect(reports("summary")).toHaveLength(before);
  runtime.view = "summary";
  rerender(page());
  await flush();
  expect(reports("summary")).toHaveLength(before + 1);
  expect(reports().at(-1)!.url.searchParams.get("reportDate")).toBe("2026-10-26");
});

it("manager import loads the returned newer date, never the prior debounced date", async () => {
  await loaded("summary-manager");
  const before = reports().length;
  upload();
  await flush();
  await answer(imports[0], { inserted: 1, reportDate: "2026-10-27" });
  await flush();
  expect(reports()).toHaveLength(before + 1);
  const latest = reports().at(-1)!;
  expect(latest.url.searchParams.get("reportDate")).toBe("2026-10-27");
  await answer(latest, payload("IMPORTED", "2026-10-27"));
  await tick();
  expect(reports()).toHaveLength(before + 1);
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-27");
});

it("manager import resolves latest date when the import response omits it", async () => {
  await loaded("summary-manager");
  const before = reports().length;
  upload();
  await flush();
  await answer(imports[0], { inserted: 1 });
  const latest = reports().at(-1)!;
  expect(latest.url.searchParams.has("reportDate")).toBe(false);
  await answer(latest, payload("IMPORTED_LATEST", "2026-10-27"));
  await tick();
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-27");
  expect(reports()).toHaveLength(before + 1);
});

it("does not load a hidden manager panel when an in-flight import completes", async () => {
  const { rerender } = await loaded("summary-manager");
  upload();
  await flush();
  const before = reports("summary-manager").length;
  runtime.view = "summary";
  rerender(page());
  await flush();
  await answer(imports[0], { inserted: 1, reportDate: "2026-10-27" });
  await tick();
  expect(reports("summary-manager")).toHaveLength(before);
  runtime.view = "summary-manager";
  rerender(page());
  await flush();
  expect(reports().at(-1)!.url.searchParams.get("reportDate")).toBe("2026-10-27");
});

it("retains unresolved manager latest intent after a hidden import without a report date", async () => {
  const { rerender } = await loaded("summary-manager");
  upload();
  await flush();
  const before = reports("summary-manager").length;
  runtime.view = "";
  rerender(page());
  await flush();
  personalDate = "2026-10-26";
  await answer(imports[0], { inserted: 1 });
  await tick();
  expect(reports("summary-manager")).toHaveLength(before);
  runtime.view = "summary-manager";
  rerender(page());
  await flush();
  const latest = reports().at(-1)!;
  expect(latest.url.searchParams.has("reportDate")).toBe(false);
  await answer(latest, payload("MANAGER_LATEST", "2026-10-27"));
  await tick();
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-27");
  expect(reports()).toHaveLength(before + 1);
});

it("lets an explicit manager date intent replace unresolved import-latest intent", async () => {
  const { rerender } = await loaded("summary-manager");
  upload();
  await flush();
  runtime.view = "";
  rerender(page());
  await flush();
  await answer(imports[0], { inserted: 1 });
  await tick();
  runtime.view = "summary-manager";
  rerender(page());
  await flush();
  const stale = reports().at(-1)!;
  change("date", "2026-10-24");
  await tick();
  expect(stale.signal?.aborted).toBe(true);
  const selected = reports().at(-1)!;
  expect(selected.url.searchParams.get("reportDate")).toBe("2026-10-24");
  await answer(selected, payload("EXPLICIT_DATE", "2026-10-24"));
  await answer(stale, payload("OBSOLETE_LATEST", "2026-10-27"));
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-24");
  expect(screen.getByTestId("rows")).toHaveTextContent("EXPLICIT_DATE");
});

it.each([
  { view: "", panel: "personal" },
  { view: "kpi-calculator", panel: "calculator" },
])("honors explicit $panel date after a hidden manager import without a report date", async ({ view, panel }) => {
  const { rerender } = await loaded("summary-manager");
  upload();
  await flush();
  const before = reports("summary-manager").length;
  runtime.view = view;
  rerender(page());
  await tick();
  personalDate = "2026-10-26";
  await answer(imports[0], { inserted: 1 });
  await tick(650);
  expect(reports("summary-manager")).toHaveLength(before);
  expect(screen.getByLabelText(`${panel}-date`)).toHaveValue("2026-10-26");
  change(`${panel}-date`, "2026-10-24");
  await tick(650);
  expect(screen.getByLabelText(`${panel}-date`)).toHaveValue("2026-10-24");
  runtime.view = "summary-manager";
  rerender(page());
  await flush();
  const selected = reports().at(-1)!;
  expect(reports()).toHaveLength(before + 1);
  await answer(selected, payload("EXPLICIT_SHARED_DATE", selected.url.searchParams.get("reportDate") || "2026-10-27"));
  await tick();
  expect(selected.url.searchParams.get("reportDate")).toBe("2026-10-24");
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-24");
  expect(screen.getByTestId("rows")).toHaveTextContent("EXPLICIT_SHARED_DATE");
  expect(reports()).toHaveLength(before + 1);
});

it("does not clear manager latest intent when calculator automatically resolves a date", async () => {
  const { rerender } = await loaded("summary-manager");
  upload();
  await flush();
  const before = reports("summary-manager").length;
  runtime.view = "kpi-calculator";
  rerender(page());
  await tick();
  personalDate = "2026-10-26";
  await answer(imports[0], { inserted: 1 });
  await tick(650);
  expect(screen.getByLabelText("calculator-date")).toHaveValue("2026-10-26");
  expect(reports("summary-manager")).toHaveLength(before);
  runtime.view = "summary-manager";
  rerender(page());
  await flush();
  const latest = reports().at(-1)!;
  expect(latest.url.searchParams.has("reportDate")).toBe(false);
  await answer(latest, payload("AUTOMATIC_MANAGER_LATEST", "2026-10-27"));
  await tick();
  expect(screen.getByLabelText("date")).toHaveValue("2026-10-27");
  expect(reports()).toHaveLength(before + 1);
});

it("invalidates calculator latest aliases when personal import completes during pending calculator reentry", async () => {
  const { rerender } = await mount("kpi-calculator");
  await tick();
  expect(personalRequests).toHaveLength(1);
  expect(personalRequests[0].url.searchParams.has("reportDate")).toBe(false);
  expect(screen.getByLabelText("calculator-date")).toHaveValue("2026-10-25");
  expect(screen.getByTestId("calculator-drafts")).toHaveTextContent('"METRIC_TEST":"4"');
  runtime.view = "";
  rerender(page());
  await tick();
  upload("personal-import");
  await flush();
  expect(imports).toHaveLength(1);
  holdPersonalReports = true;
  runtime.view = "kpi-calculator";
  rerender(page());
  await flush();
  expect(personalRequests).toHaveLength(3);
  const staleReentry = personalRequests.at(-1)!;
  expect(staleReentry.url.searchParams.get("reportDate")).toBe("2026-10-25");
  expect(screen.getByTestId("calculator-busy")).toHaveTextContent("true");
  personalDate = "2026-10-26";
  personalValue = 8;
  await answer(imports[0], { inserted: 1 });
  expect(personalRequests).toHaveLength(4);
  expect(staleReentry.signal?.aborted).toBe(true);
  const latest = personalRequests.at(-1)!;
  expect(latest.url.searchParams.has("reportDate")).toBe(false);
  expect(screen.getByTestId("calculator-busy")).toHaveTextContent("true");
  expect(screen.getByTestId("calculator-rows")).toHaveTextContent("[]");
  expect(screen.getByTestId("calculator-drafts")).toHaveTextContent("{}");
  expect(requests).toHaveLength(0);
  await answer(latest, personalReportPayload());
  await tick();
  expect(screen.getByLabelText("calculator-date")).toHaveValue("2026-10-26");
  expect(screen.getByTestId("calculator-drafts")).toHaveTextContent('"METRIC_TEST":"8"');
  expect(screen.getByTestId("calculator-busy")).toHaveTextContent("false");
  await answer(staleReentry, personalReportPayload("2026-10-25", 2));
  expect(screen.getByLabelText("calculator-date")).toHaveValue("2026-10-26");
  expect(screen.getByTestId("calculator-drafts")).toHaveTextContent('"METRIC_TEST":"8"');
  expect(screen.getByTestId("calculator-error")).toBeEmptyDOMElement();
  expect(personalRequests).toHaveLength(4);
  expect(requests).toHaveLength(0);
});

it("invalidates a hidden calculator after personal import without loading hidden resources", async () => {
  const { rerender } = await mount("kpi-calculator");
  await tick();
  runtime.view = "";
  rerender(page());
  await tick();
  expect(personalRequests).toHaveLength(2);
  upload("personal-import");
  await flush();
  personalDate = "2026-10-26";
  personalValue = 8;
  await answer(imports[0], { inserted: 1 });
  await tick();
  expect(personalRequests).toHaveLength(3);
  expect(personalRequests.at(-1)!.url.searchParams.has("reportDate")).toBe(false);
  expect(requests).toHaveLength(0);
  runtime.view = "kpi-calculator";
  rerender(page());
  await tick();
  expect(personalRequests).toHaveLength(4);
  expect(screen.getByLabelText("calculator-date")).toHaveValue("2026-10-26");
  expect(screen.getByTestId("calculator-drafts")).toHaveTextContent('"METRIC_TEST":"8"');
  expect(screen.getByTestId("calculator-busy")).toHaveTextContent("false");
  expect(requests).toHaveLength(0);
});
