// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "next-auth";
import { SessionContext, useSession } from "next-auth/react";
import { StrictMode, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/(dashboard)/customers/page";
import CustomerModal from "@/components/CustomerModalRefined";
import PrepaidPage from "@/app/(dashboard)/prepaid/PrepaidPageImpl";
import type PersonalPanel from "@/app/(dashboard)/prepaid/PersonalKpiPanelClean";
import type CalculatorPanel from "@/app/(dashboard)/prepaid/KpiCalculatorPanel";
import { Providers } from "@/components/Providers";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import type { Customer } from "@/types";
import { CurrentUserRequestBroker } from "@/lib/current-user-request";
import { CurrentUserProvider, useCurrentUser } from "@/hooks/useCurrentUser";

type UserPayload = { id: string; role: string; canUseGps: boolean; ctvList: { id: string; username: string }[] };

const runtime = vi.hoisted(() => ({ view: "", error: vi.fn(), router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => runtime.router, useSearchParams: () => new URLSearchParams({ view: runtime.view }) }));
vi.mock("react-hot-toast", () => ({ default: { error: runtime.error, success: vi.fn() } }));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({
  customers: [], total: 0, page: 1, setPage: vi.fn(), totalPages: 1, limit: 20, setLimit: vi.fn(),
  loading: false, selectedIds: [], setSelectedIds: vi.fn(), fetchCustomers: vi.fn(),
  filters: { search: "", subscriberType: "", billingType: "", prepaidPeriod: "", status: "", expirationFilter: "", ctvCode: "" }, setFilter: vi.fn(),
}) }));
vi.mock("@/app/(dashboard)/prepaid/PersonalKpiPanelClean", () => ({ default: (props: ComponentProps<typeof PersonalPanel>) => <section>
  <select aria-label="personal-ctv" value={props.selectedCtv} onChange={(event) => props.onSelectedCtvChange(event.target.value)}>
    <option value="" />{props.ctvOptions.map((user) => <option key={user.id} value={user.username}>{user.username}</option>)}
  </select>
  <output data-testid="personal-rows">{JSON.stringify(props.reportRows)}</output>
  <output data-testid="personal-date">{props.reportDate}</output>
  <input aria-label="personal-import" type="file" onChange={props.onImport} />
  <button onClick={props.onRefresh}>personal refresh</button>
</section> }));
vi.mock("@/app/(dashboard)/prepaid/KpiCalculatorPanel", () => ({ default: (props: ComponentProps<typeof CalculatorPanel>) => <section>
  <select aria-label="calculator-ctv" value={props.selectedCtv} onChange={(event) => props.onSelectedCtvChange(event.target.value)}>
    <option value="" />{props.ctvOptions.map((user) => <option key={user.id} value={user.username}>{user.username}</option>)}
  </select>
  <output data-testid="calculator-rows">{JSON.stringify(props.rows)}</output>
  <output data-testid="calculator-date">{props.reportDate}</output>
</section> }));

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}
type SyntheticResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type PendingRequest = ReturnType<typeof deferred<SyntheticResponse>> & { path: string; signal?: AbortSignal | null };
let requests: PendingRequest[];
function session(id = "scope-a", role = "ADMIN"): Session {
  return { expires: "2099-10-27T12:00:00.000Z", user: { id, name: `synthetic-${id}`, role } };
}
function payload(id = "scope-a", role = "ADMIN", canUseGps = false, names = ["CTV_A", "CTV_B"]): UserPayload {
  return { id, role, canUseGps, ctvList: names.map((username) => ({ id: username, username })) };
}
function response(data: unknown = payload(), status = 200): SyntheticResponse {
  return { ok: status >= 200 && status < 300, status, json: vi.fn(async () => data) };
}
function meRequests() { return requests.filter((request) => request.path === "/api/me"); }
function reports() { return requests.filter((request) => request.path.startsWith("/api/kpi/report")); }
async function flush() {
  await act(async () => { for (let turn = 0; turn < 16; turn += 1) await Promise.resolve(); });
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(650); }); await flush(); }
async function answer(request: PendingRequest, data: unknown = payload(), status = 200) {
  const result = response(data, status);
  await act(async () => { request.resolve(result); });
  await flush();
  return result;
}
function Scope({ value = session(), status = value ? "authenticated" : "unauthenticated", children }: {
  value?: Session | null; status?: "authenticated" | "unauthenticated" | "loading"; children: ReactNode;
}) {
  return <SessionContext.Provider value={{ data: value, status, update: async () => value } as NonNullable<React.ContextType<typeof SessionContext>>}>
    <CurrentUserProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></CurrentUserProvider>
  </SessionContext.Provider>;
}
let renders: { label: string; data: string; error: string; loading: boolean }[];
function Probe({ label = "first", enabled = true }: { label?: string; enabled?: boolean }) {
  const query = useCurrentUser(enabled);
  renders.push({ label, data: query.data?.id || "", error: query.error?.message || "", loading: query.loading });
  return <section data-testid={label}>
    <output data-testid={`${label}-data`}>{JSON.stringify(query.data)}</output>
    <output data-testid={`${label}-error`}>{query.error?.message || ""}</output>
    <output data-testid={`${label}-loading`}>{String(query.loading)}</output>
    <button onClick={query.refresh}>refresh {label}</button>
  </section>;
}
function UpdateSession() {
  const { update, status } = useSession();
  return <><output data-testid="session-status">{status}</output><button onClick={() => void update()}>session update</button></>;
}
function modal(customer: Customer | null = null) { return <CustomerModal customer={customer} onClose={() => undefined} onRefresh={() => undefined} />; }
const gps = () => screen.queryByRole("button", { name: "Lấy tọa độ hiện tại" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  requests = [];
  renders = [];
  runtime.view = "";
  vi.stubGlobal("BroadcastChannel", class extends EventTarget { postMessage() {} close() {} });
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const request = { ...deferred<SyntheticResponse>(), path, signal: init?.signal };
    requests.push(request);
    if (path.startsWith("/api/customers/")) request.resolve(response({ edits: [], notes: [] }));
    return request.promise;
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("pending current-user broker", () => {
  it("shares one fetch and parses successful JSON once without settled reuse", async () => {
    const broker = new CurrentUserRequestBroker("scope-a");
    const first = broker.request();
    const second = broker.request();
    expect(meRequests()).toHaveLength(1);
    const result = await answer(meRequests()[0]);
    expect(await first).toBe(await second);
    expect(result.json).toHaveBeenCalledTimes(1);
    const third = broker.request();
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1]);
    await third;
  });

  it("rejects only the detached caller and lets the other finish", async () => {
    const broker = new CurrentUserRequestBroker("scope-a");
    const controller = new AbortController();
    const first = broker.request(controller.signal).catch((error) => error);
    const second = broker.request();
    controller.abort();
    await flush();
    expect(meRequests()[0].signal?.aborted).toBe(false);
    expect(await Promise.race([first, Promise.resolve("still pending")])).toMatchObject({ name: "AbortError" });
    await answer(meRequests()[0]);
    expect(await second).toMatchObject({ id: "scope-a" });
  });

  it.each(["success", "error"])("evicts on last detach before late %s and protects replacement", async (completion) => {
    const broker = new CurrentUserRequestBroker("scope-a");
    const controller = new AbortController();
    const first = broker.request(controller.signal).catch((error) => error);
    controller.abort();
    expect(meRequests()[0].signal?.aborted).toBe(true);
    const second = broker.request();
    expect(meRequests()).toHaveLength(2);
    if (completion === "success") await answer(meRequests()[0]);
    else { meRequests()[0].reject(new Error("obsolete network")); await flush(); }
    const third = broker.request();
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1]);
    expect(await first).toMatchObject({ name: "AbortError" });
    expect(await second).toBe(await third);
  });

  it("abortAll fences pending parse and remains reusable; dispose rejects future callers", async () => {
    const broker = new CurrentUserRequestBroker("scope-a");
    const json = deferred<unknown>();
    const first = broker.request().catch((error) => error);
    meRequests()[0].resolve({ ok: true, status: 200, json: () => json.promise });
    await flush();
    broker.abortAll();
    expect(meRequests()[0].signal?.aborted).toBe(true);
    const next = broker.request();
    const joined = broker.request();
    json.resolve(payload());
    await flush();
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1]);
    expect(await first).toMatchObject({ name: "AbortError" });
    expect(await next).toBe(await joined);
    const pending = broker.request().catch((error) => error);
    broker.dispose();
    await flush();
    expect(await Promise.race([pending, Promise.resolve("still pending")])).toMatchObject({ name: "AbortError" });
    expect(await broker.request().catch((error) => error)).toMatchObject({ name: "AbortError" });
  });

  it.each([401, 403, 404, 500, "parse", "network", "subject"])("does not cache %s failures", async (failure) => {
    const broker = new CurrentUserRequestBroker("scope-a");
    const first = broker.request().catch((error) => error);
    if (failure === "parse") meRequests()[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad JSON"); } });
    else if (failure === "network") meRequests()[0].reject(new TypeError("offline"));
    else await answer(meRequests()[0], failure === "subject" ? payload("scope-b") : payload(), Number(failure) || 200);
    await flush();
    const error = await first;
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("status", typeof failure === "number" ? failure : failure === "subject" ? 200 : null);
    const retry = broker.request();
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1]);
    await retry;
  });

  it("does not fetch for an already aborted caller or share across instances", async () => {
    const controller = new AbortController();
    controller.abort();
    const first = new CurrentUserRequestBroker("scope-a");
    const aborted = first.request(controller.signal).catch((error) => error);
    await flush();
    expect(await Promise.race([aborted, Promise.resolve("still pending")])).toMatchObject({ name: "AbortError" });
    expect(meRequests()).toHaveLength(0);
    const pending = first.request();
    const isolated = new CurrentUserRequestBroker("scope-a").request();
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[0]); await answer(meRequests()[1]);
    await Promise.all([pending, isolated]);
  });
});

describe("scoped current-user hook", () => {
  it.each(["unauthenticated", "loading"] as const)("does not fetch when %s without session", async (status) => {
    render(<Scope value={null} status={status}><Probe /></Scope>);
    await flush();
    expect(meRequests()).toHaveLength(0);
    expect(screen.getByTestId("first-data")).toHaveTextContent("null");
  });
  it("does not eagerly fetch without consumers or while disabled", async () => {
    const rendered = render(<Scope><span>no consumers</span></Scope>);
    await flush(); expect(meRequests()).toHaveLength(0);
    rendered.rerender(<Scope><Probe enabled={false} /></Scope>);
    await flush(); expect(meRequests()).toHaveLength(0);
  });
  it("shares pending consumers but refetches for a consumer mounted after settlement", async () => {
    const rendered = render(<Scope><Probe /><Probe label="second" /></Scope>);
    expect(meRequests()).toHaveLength(1);
    await answer(meRequests()[0]);
    rendered.rerender(<Scope><Probe /><Probe label="second" /><Probe label="third" /></Scope>);
    expect(meRequests()).toHaveLength(2);
    expect(screen.getByTestId("third-data")).toHaveTextContent("null");
    await answer(meRequests()[1]);
  });
  it("keeps standalone fallback brokers isolated", () => {
    render(<SessionContext.Provider value={{ data: session(), status: "authenticated", update: vi.fn() }}><Probe /><Probe label="second" /></SessionContext.Provider>);
    expect(meRequests()).toHaveLength(2);
  });
  it("preserves data and pending subscription through equivalent identity and retained loading", async () => {
    const rendered = render(<Scope><Probe /></Scope>);
    const renewed = { ...session(), expires: "2099-10-28T12:00:00.000Z", user: { ...session().user } };
    rendered.rerender(<Scope value={renewed} status="loading"><Probe /></Scope>);
    expect(meRequests()).toHaveLength(1);
    expect(meRequests()[0].signal?.aborted).toBe(false);
    await answer(meRequests()[0]);
    rendered.rerender(<Scope value={renewed}><Probe /></Scope>);
    expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
    expect(meRequests()).toHaveLength(1);
  });
  it.each(["id", "name", "role", "logout"])("masks data synchronously on %s change", async (field) => {
    const rendered = render(<Scope><Probe /></Scope>);
    await answer(meRequests()[0]);
    const changed = field === "logout" ? null : { ...session(), user: { ...session().user, [field]: field === "role" ? "CTV" : "scope-b" } };
    const start = renders.length;
    rendered.rerender(<Scope value={changed}><Probe /></Scope>);
    expect(renders.slice(start).every((entry) => entry.data === "")).toBe(true);
    expect(screen.getByTestId("first-data")).toHaveTextContent("null");
    if (changed) await answer(meRequests()[1], payload(changed.user.id, changed.user.role));
  });
  it.each(["success", "error"])("ignores obsolete ABA %s and logout completion", async (completion) => {
    const rendered = render(<Scope><Probe /></Scope>);
    rendered.rerender(<Scope value={session("scope-b")}><Probe /></Scope>);
    rendered.rerender(<Scope><Probe /></Scope>);
    expect(meRequests()).toHaveLength(3);
    await answer(meRequests()[2]);
    if (completion === "success") await answer(meRequests()[0], payload("scope-a", "CTV", true));
    else { meRequests()[0].reject(new Error("old failure")); await flush(); }
    expect(screen.getByTestId("first-data")).toHaveTextContent('"role":"ADMIN"');
    expect(screen.getByTestId("first-error")).toHaveTextContent("");
    rendered.rerender(<Scope value={null}><Probe /></Scope>);
    await answer(meRequests()[1], payload("scope-b"));
    expect(screen.getByTestId("first-data")).toHaveTextContent("null");
  });
  it("rejects subject mismatch without an automatic retry loop", async () => {
    render(<Scope><Probe /></Scope>);
    await answer(meRequests()[0], payload("scope-b"));
    expect(screen.getByTestId("first-data")).toHaveTextContent("null");
    expect(screen.getByTestId("first-error").textContent).not.toBe("");
    await tick(); expect(meRequests()).toHaveLength(1);
    fireEvent.click(screen.getByText("refresh first"));
    await answer(meRequests()[1]);
    expect(screen.getByTestId("first-error")).toHaveTextContent("");
    expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
  });
  it("coalesces visible focus, visibility, online and explicit refresh, ignores hidden and detached consumers", async () => {
    const rendered = render(<Scope><Probe /><Probe label="second" /></Scope>);
    await answer(meRequests()[0]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(window, new Event("focus"));
    fireEvent(document, new Event("visibilitychange"));
    expect(meRequests()).toHaveLength(1);
    visibility.mockReturnValue("visible");
    fireEvent(window, new Event("focus"));
    expect(meRequests()).toHaveLength(2);
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("online"));
    fireEvent.click(screen.getByText("refresh first"));
    expect(meRequests()).toHaveLength(2);
    rendered.rerender(<Scope><Probe enabled={false} /><Probe label="second" /></Scope>);
    expect(meRequests()[1].signal?.aborted).toBe(false);
    await answer(meRequests()[1]);
    fireEvent(window, new Event("focus"));
    expect(meRequests()).toHaveLength(3);
    await answer(meRequests()[2]);
    rendered.unmount();
    fireEvent(window, new Event("focus"));
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("online"));
    expect(meRequests()).toHaveLength(3);
  });
  it("survives StrictMode cleanup without poisoning the broker", async () => {
    render(<StrictMode><Scope><Probe /></Scope></StrictMode>);
    expect(meRequests().at(-1)?.signal?.aborted).toBe(false);
    await answer(meRequests().at(-1)!);
    expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
    fireEvent.click(screen.getByText("refresh first"));
    await answer(meRequests().at(-1)!);
    expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
  });
  it.each([false, true])("real SessionProvider.update preserves retained %s data and subscription", async (settled) => {
    render(<Providers session={session()}><Probe /><UpdateSession /></Providers>);
    expect(meRequests()).toHaveLength(1);
    if (settled) await answer(meRequests()[0]);
    fireEvent.click(screen.getByText("session update"));
    await flush();
    expect(screen.getByTestId("session-status")).toHaveTextContent("loading");
    expect(meRequests()[0].signal?.aborted).toBe(false);
    if (settled) expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
    else await answer(meRequests()[0]);
    const auth = requests.find((request) => request.path.includes("/api/auth/session"))!;
    expect(auth).toBeDefined();
    await answer(auth, { ...session(), expires: "2099-10-28T12:00:00.000Z" });
    expect(screen.getByTestId("session-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("first-data")).toHaveTextContent("scope-a");
    expect(meRequests()).toHaveLength(1);
  });
});

describe("real customer and KPI consumers", () => {
  it("joins customers and modal me but keeps users dropdown independent", async () => {
    render(<Scope><CustomersPage /></Scope>);
    fireEvent.click(screen.getByRole("button", { name: "Lọc nâng cao" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Thêm khách hàng/ })[0]);
    expect(meRequests()).toHaveLength(1);
    expect(gps()).toBeNull();
    const users = requests.find((request) => request.path === "/api/users")!;
    expect(users).toBeDefined();
    await answer(users, [{ id: "assigned", username: "USERS_ONLY" }]);
    await answer(meRequests()[0], payload("scope-a", "ADMIN", false, ["ME_ONLY"]));
    expect(gps()).not.toBeNull();
    const dropdown = screen.getByRole("combobox", { name: "Mã CTV (giao khách)" });
    expect(within(dropdown).getByRole("option", { name: /USERS_ONLY/ })).toBeInTheDocument();
    expect(within(dropdown).queryByRole("option", { name: /ME_ONLY/ })).toBeNull();
    expect(screen.getAllByRole("option", { name: /ME_ONLY/ }).length).toBeGreaterThan(0);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("online"));
    expect(meRequests()).toHaveLength(2);
    const focusResponse = await answer(meRequests()[1], payload("scope-a", "ADMIN", false, ["ME_ONLY"]));
    expect(focusResponse.json).toHaveBeenCalledTimes(1);
    expect(requests.filter((request) => request.path === "/api/users")).toHaveLength(1);
    visibility.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Thêm khách hàng/ })[0]);
    expect(meRequests()).toHaveLength(3);
    expect(gps()).toBeNull();
    await answer(meRequests()[2]);
    expect(gps()).not.toBeNull();
  });
  it.each([
    ["ADMIN", false, false, true], ["CTV", false, false, false], ["CTV", true, false, true], ["CTV", false, true, true],
  ] as const)("GPS %s permission %s editing %s requires success and denies failed refresh", async (role, permission, editing, allowed) => {
    render(<Scope value={session("scope-a", role)}>{modal(editing ? { id: "synthetic-customer", name: "Synthetic" } as Customer : null)}</Scope>);
    expect(gps()).toBeNull();
    await answer(meRequests()[0], payload("scope-a", role, permission));
    expect(Boolean(gps())).toBe(allowed);
    fireEvent(window, new Event("online"));
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1], {}, 500);
    expect(gps()).toBeNull();
    expect(requests.filter((request) => request.path === "/api/users")).toHaveLength(role === "ADMIN" ? 1 : 0);
  });
  it.each([401, 403, 404, 500, "parse", "network", "subject"] as const)("GPS edit exception denies initial %s failure until successful retry", async (failure) => {
    render(<Scope value={session("scope-a", "CTV")}>{modal({ id: "synthetic-customer", name: "Synthetic" } as Customer)}</Scope>);
    if (failure === "parse") meRequests()[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad JSON"); } });
    else if (failure === "network") meRequests()[0].reject(new TypeError("offline"));
    else await answer(meRequests()[0], failure === "subject" ? payload("scope-b", "ADMIN", true) : {}, typeof failure === "number" ? failure : 200);
    await flush();
    expect(gps()).toBeNull();
    await tick();
    expect(meRequests()).toHaveLength(1);
    fireEvent(window, new Event("online"));
    await answer(meRequests()[1], payload("scope-a", "CTV", false));
    expect(gps()).not.toBeNull();
  });
  it.each(["ADMIN", "MANAGER"])("%s users list has stable identity deps and fences scope changes", async (role) => {
    const rendered = render(<Scope value={session("scope-a", role)}>{modal()}</Scope>);
    const oldUsers = requests.find((request) => request.path === "/api/users")!;
    rendered.rerender(<Scope value={{ ...session("scope-a", role), expires: "2099-10-28T12:00:00.000Z" }}>{modal()}</Scope>);
    expect(requests.filter((request) => request.path === "/api/users")).toHaveLength(1);
    rendered.rerender(<Scope value={session("scope-b", role)}>{modal()}</Scope>);
    expect(oldUsers.signal?.aborted).toBe(true);
    await answer(oldUsers, [{ id: "old", username: "OLD_USERS" }]);
    expect(screen.queryByRole("option", { name: /OLD_USERS/ })).toBeNull();
    const nextUsers = requests.filter((request) => request.path === "/api/users")[1];
    await answer(nextUsers, [{ id: "new", username: "NEW_USERS" }]);
    expect(screen.getByRole("option", { name: /NEW_USERS/ })).toBeInTheDocument();
  });
  it.each(["", "kpi-calculator"])("KPI %s fences old CTV reports while new me is pending", async (view) => {
    runtime.view = view;
    const rendered = render(<Scope><PrepaidPage /></Scope>);
    expect(reports()).toHaveLength(0);
    await answer(meRequests()[0]);
    await tick();
    expect(reports()).toHaveLength(1);
    expect(reports()[0].path).toContain("ctvUser=CTV_A");
    const label = view ? "calculator-ctv" : "personal-ctv";
    fireEvent.change(screen.getByLabelText(label), { target: { value: "CTV_B" } });
    await tick();
    expect(reports().at(-1)?.path).toContain("ctvUser=CTV_B");
    const count = reports().length;
    rendered.rerender(<Scope value={session("scope-b")}><PrepaidPage /></Scope>);
    expect(screen.getByLabelText(label)).toHaveValue("");
    expect(reports()).toHaveLength(count);
    await tick(); expect(reports()).toHaveLength(count);
    await answer(meRequests()[1], payload("scope-b", "ADMIN", false, ["CTV_NEW"]));
    await tick();
    expect(screen.getByLabelText(label)).toHaveValue("CTV_NEW");
    expect(reports()).toHaveLength(count + 1);
    expect(reports().at(-1)?.path).toContain("ctvUser=CTV_NEW");
  });
  it("KPI preserves valid selection on refresh and defaults first only when invalid", async () => {
    const rendered = render(<Scope><PrepaidPage /></Scope>);
    await answer(meRequests()[0]); await tick();
    fireEvent.change(screen.getByLabelText("personal-ctv"), { target: { value: "CTV_B" } });
    await tick();
    rendered.rerender(<Scope value={{ ...session(), expires: "2099-10-28T12:00:00.000Z" }}><PrepaidPage /></Scope>);
    expect(meRequests()).toHaveLength(1);
    expect(screen.getByLabelText("personal-ctv")).toHaveValue("CTV_B");
    fireEvent(window, new Event("online"));
    expect(meRequests()).toHaveLength(2);
    await answer(meRequests()[1], payload("scope-a", "ADMIN", false, ["CTV_A", "CTV_B", "CTV_C"]));
    expect(screen.getByLabelText("personal-ctv")).toHaveValue("CTV_B");
    fireEvent(window, new Event("online"));
    await answer(meRequests()[2], payload("scope-a", "ADMIN", false, ["CTV_C"]));
    expect(screen.getByLabelText("personal-ctv")).toHaveValue("CTV_C");
  });
  it("KPI treats a refreshed non-array CTV list as empty without issuing an old-CTV report", async () => {
    render(<Scope><PrepaidPage /></Scope>);
    await answer(meRequests()[0]); await tick();
    const count = reports().length;
    fireEvent(window, new Event("online"));
    await answer(meRequests()[1], { ...payload(), ctvList: {} });
    await tick();
    expect(screen.getByLabelText("personal-ctv")).toHaveValue("");
    expect(reports()).toHaveLength(count);
  });
  it("KPI manual refresh does not send removed CTV during refreshed selection debounce", async () => {
    render(<Scope><PrepaidPage /></Scope>);
    await answer(meRequests()[0]); await tick();
    await answer(reports()[0], { rows: [] });
    fireEvent.change(screen.getByLabelText("personal-ctv"), { target: { value: "CTV_B" } });
    await tick();
    expect(reports().at(-1)?.path).toContain("ctvUser=CTV_B");
    await answer(reports().at(-1)!, { rows: [] });
    const count = reports().length;
    fireEvent(window, new Event("online"));
    await answer(meRequests()[1], payload("scope-a", "ADMIN", false, ["CTV_C"]));
    expect(screen.getByLabelText("personal-ctv")).toHaveValue("CTV_C");
    fireEvent.click(screen.getByRole("button", { name: "personal refresh" }));
    await flush();
    expect(reports()).toHaveLength(count);
    await tick();
    expect(reports()).toHaveLength(count + 1);
    expect(reports().at(-1)?.path).toContain("ctvUser=CTV_C");
  });
  it.each([
    { view: "", settleSelection: true, panel: "personal" },
    { view: "", settleSelection: false, panel: "personal" },
    { view: "kpi-calculator", settleSelection: true, panel: "calculator" },
  ])("deferred import uses live $panel selection and latest date when CTV debounce settled=$settleSelection", async ({ view, settleSelection, panel }) => {
    const rendered = render(<Scope><PrepaidPage /></Scope>);
    const initialDate = view ? "2026-10-25" : undefined;
    await answer(meRequests()[0], payload("scope-a", "ADMIN", false, ["CTV_B"]));
    await tick();
    await answer(reports().at(-1)!, { rows: [], reportDate: initialDate });
    await tick();
    fireEvent.change(screen.getByLabelText("personal-import"), { target: { files: [new File(["synthetic"], "synthetic.xlsx")] } });
    await flush();
    const pendingImport = requests.find((request) => request.path === "/api/kpi/import")!;
    expect(pendingImport).toBeDefined();
    if (view) {
      runtime.view = view;
      rendered.rerender(<Scope><PrepaidPage /></Scope>);
      await flush();
      await answer(reports().at(-1)!, { rows: [], reportDate: initialDate });
    }
    fireEvent(window, new Event("online"));
    await answer(meRequests()[1], payload("scope-a", "ADMIN", false, ["CTV_C"]));
    expect(screen.getByLabelText(`${panel}-ctv`)).toHaveValue("CTV_C");
    if (settleSelection) {
      await tick();
      expect(reports().at(-1)?.path).toContain("ctvUser=CTV_C");
      await answer(reports().at(-1)!, { rows: [], reportDate: initialDate });
    }
    const beforeCompletion = reports().length;
    await answer(pendingImport, { inserted: 1 });
    const afterCompletion = reports().slice(beforeCompletion);
    expect(afterCompletion.every((request) => new URL(request.path, "https://synthetic.invalid").searchParams.get("ctvUser") === "CTV_C")).toBe(true);
    if (!settleSelection) expect(afterCompletion).toHaveLength(0);
    await tick();
    const importedReports = reports().slice(beforeCompletion);
    expect(importedReports).toHaveLength(1);
    const latest = importedReports[0];
    const parameters = new URL(latest.path, "https://synthetic.invalid").searchParams;
    expect(parameters.get("ctvUser")).toBe("CTV_C");
    expect(parameters.has("reportDate")).toBe(false);
    await answer(latest, { rows: [], reportDate: "2026-10-26" });
    await tick();
    expect(screen.getByTestId(`${panel}-date`)).toHaveTextContent("2026-10-26");
    expect(reports()).toHaveLength(beforeCompletion + 1);
  });
  it("KPI CTV role skips me and summary is not gated by pending list", async () => {
    const rendered = render(<Scope value={session("scope-a", "CTV")}><PrepaidPage /></Scope>);
    await tick();
    expect(meRequests()).toHaveLength(0);
    expect(reports()).toHaveLength(1);
    runtime.view = "summary";
    rendered.rerender(<Scope><PrepaidPage /></Scope>);
    await flush();
    expect(meRequests()).toHaveLength(1);
    expect(requests.some((request) => request.path.startsWith("/api/kpi/summary"))).toBe(true);
  });
  it.each([500, "network", "parse"] as const)("KPI %s retains network/parse-only CTV toast", async (failure) => {
    render(<Scope><PrepaidPage /></Scope>);
    if (failure === "network") meRequests()[0].reject(new TypeError("offline"));
    else if (failure === "parse") meRequests()[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad JSON"); } });
    else await answer(meRequests()[0], {}, failure);
    await flush();
    expect(runtime.error).toHaveBeenCalledTimes(failure === 500 ? 0 : 1);
    if (failure !== 500) expect(runtime.error).toHaveBeenCalledWith("Không tải được danh sách CTV");
  });
});
