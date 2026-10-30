// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomers, type CustomerFilters } from "@/hooks/useCustomers";
import CustomersPage from "@/app/(dashboard)/customers/page";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import { syntheticCustomer } from "../fixtures/customer-mobile-controls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "synthetic-user", role: "ADMIN" } }, status: "authenticated" }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { id: "synthetic-user", ctvList: [], canUseGps: false }, error: null, loading: false }) }));

let requests: { url: string; resolve: (response: Response) => void }[];
let originalUrl: string;
function makeWrapper() {
  const cache = new Map(); const config = { provider: () => cache, shouldRetryOnError: false };
  return function Wrapper({ children }: { children: ReactNode }) { return <SWRConfig value={config}><ConfirmDialogProvider>{children}</ConfirmDialogProvider></SWRConfig>; };
}
function mount(fixedFilters?: Partial<CustomerFilters>) { return renderHook(() => useCustomers({ syncUrl: true, fixedFilters }), { wrapper: makeWrapper() }); }
async function advance(milliseconds: number) { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); }); }
async function reply(index = 0) { await act(async () => requests[index].resolve({ ok: true, json: async () => ({ data: [{ ...syntheticCustomer }], total: 95, totalPages: 10 }) } as Response)); }
function query(index = requests.length - 1) { return new URL(requests[index].url, "http://fixture.invalid").searchParams; }
function popTo(href: string) { act(() => { window.history.replaceState(null, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }); }

beforeEach(() => {
  originalUrl = window.location.pathname + window.location.search + window.location.hash;
  window.history.replaceState(null, "", "/customers"); requests = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input); expect(url.startsWith("/api/customers?")).toBe(true);
    return new Promise<Response>((resolve) => requests.push({ url, resolve }));
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState(null, "", originalUrl); });

describe("customer URL hydration and whitelist", () => {
  it("loads the whole URL atomically without an initial unfiltered or delayed follow-up request", async () => {
    window.history.replaceState(null, "", "/customers?q=seed&page=3&limit=20&subscriberType=FIXED&billingType=PREPAID&prepaidPeriod=6&ctvCode=CTV_A&expirationFilter=soon&status=Hoat+dong");
    const push = vi.spyOn(window.history, "pushState"); const { result } = mount();
    expect(result.current.page).toBe(3); expect(result.current.limit).toBe(20);
    expect(result.current.filters).toEqual({ search: "seed", subscriberType: "FIXED", billingType: "PREPAID", prepaidPeriod: "6", ctvCode: "CTV_A", expirationFilter: "soon", status: "Hoat dong" });
    expect(requests).toHaveLength(1); expect(query().get("search")).toBe("seed"); expect(query().get("page")).toBe("3"); expect(query().get("limit")).toBe("20"); expect(query().get("ctvCode")).toBe("CTV_A");
    await reply(); await advance(500); expect(requests).toHaveLength(1); expect(push).not.toHaveBeenCalled();
  });

  it("supports the node-map q link and preserves Unicode, whitespace and literal plus", () => {
    const search = "  Khách + ACCOUNT_01  "; window.history.replaceState(null, "", "/customers?q=" + encodeURIComponent(search));
    const { result } = mount(); expect(result.current.filters.search).toBe(search); expect(query().get("search")).toBe(search);
  });

  it("reads legacy search only when canonical q is absent", () => {
    window.history.replaceState(null, "", "/customers?search=legacy"); const { result } = mount();
    expect(result.current.filters.search).toBe("legacy"); expect(query().get("search")).toBe("legacy");
  });

  it("lets an explicit empty q override the legacy alias", () => {
    window.history.replaceState(null, "", "/customers?q=&search=legacy"); const { result } = mount(); expect(result.current.filters.search).toBe(""); expect(query().get("search")).toBe("");
  });

  it.each(["0", "-2", "2.5", "2e3", "Infinity", "NaN", "abc", ""])("rejects invalid page %s", (page) => {
    window.history.replaceState(null, "", "/customers?page=" + page); const { result } = mount(); expect(result.current.page).toBe(1); expect(query().get("page")).toBe("1");
  });

  it("caps a positive page at the existing API maximum", () => {
    window.history.replaceState(null, "", "/customers?page=999999"); const { result } = mount(); expect(result.current.page).toBe(10000); expect(query().get("page")).toBe("10000");
  });

  it.each(["1", "0", "15", "-10", "20.5", "1000", "20e0"])("rejects a non-UI limit %s", (limit) => {
    window.history.replaceState(null, "", "/customers?limit=" + limit); const { result } = mount(); expect(result.current.limit).toBe(10); expect(query().get("limit")).toBe("10");
  });

  it.each([["subscriberType", "OTHER"], ["billingType", "OTHER"], ["prepaidPeriod", "5"], ["expirationFilter", "OTHER"], ["status", "OTHER"]] as const)("does not forward an invalid %s enum", (key, value) => {
    window.history.replaceState(null, "", `/customers?${key}=${value}`); const { result } = mount(); expect(result.current.filters[key]).toBe(""); expect(query().get(key)).toBe("");
  });

  it.each(["q", "page", "limit", "subscriberType", "billingType", "prepaidPeriod", "ctvCode", "expirationFilter", "status"])("does not resolve ambiguous duplicate %s parameters by picking an arbitrary value", (key) => {
    const values: Record<string, [string, string]> = { q: ["first", "second"], page: ["2", "3"], limit: ["20", "50"], subscriberType: ["FIXED", "MOBILE"], billingType: ["PREPAID", "MONTHLY"], prepaidPeriod: ["3", "6"], ctvCode: ["A", "B"], expirationFilter: ["soon", "expired"], status: ["Hoat dong", "Roi mang"] };
    const params = new URLSearchParams(); for (const value of values[key]) params.append(key, value);
    window.history.replaceState(null, "", "/customers?" + params.toString()); const { result } = mount();
    if (key === "page") expect(result.current.page).toBe(1); else if (key === "limit") expect(result.current.limit).toBe(10); else expect(result.current.filters[key === "q" ? "search" : key as keyof CustomerFilters]).toBe("");
  });

  it("does not accept URL flags as API controls or authorization", () => {
    window.history.replaceState(null, "", "/customers?role=ADMIN&includeTotal=false&hasCoordinates=true&owner=other&from=node"); mount();
    for (const key of ["role", "hasCoordinates", "owner", "from"]) expect(query().has(key)).toBe(false); expect(query().get("includeTotal")).toBe("true");
  });

  it("keeps fixed filters above URL input and user edits", () => {
    window.history.replaceState(null, "", "/customers?ctvCode=URL"); const fixedFilters = { ctvCode: "FIXED" }; const { result } = mount(fixedFilters);
    expect(result.current.filters.ctvCode).toBe("FIXED"); expect(query().get("ctvCode")).toBe("FIXED");
    act(() => result.current.setFilter("ctvCode", "OTHER")); expect(result.current.filters.ctvCode).toBe("FIXED");
  });

  it("keeps the legacy hook opt-out and an unrelated pathname untouched", async () => {
    window.history.replaceState(null, "", "/elsewhere?q=ignored&page=4"); const push = vi.spyOn(window.history, "pushState"); const { result } = mount();
    expect(result.current.page).toBe(1); expect(result.current.filters.search).toBe(""); await reply();
    act(() => result.current.setFilter("search", "local")); await advance(500); expect(push).not.toHaveBeenCalled(); expect(window.location.pathname).toBe("/elsewhere");
  });
});

describe("customer URL intent and history restoration", () => {
  it("writes one debounced search entry and preserves unrelated params/hash", async () => {
    window.history.replaceState(null, "", "/customers?from=node#list"); const { result } = mount(); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.setFilter("search", "A")); await advance(250);
    act(() => result.current.setFilter("search", "AB")); await advance(499); expect(push).not.toHaveBeenCalled(); expect(requests).toHaveLength(1);
    await advance(1); expect(push).toHaveBeenCalledTimes(1); expect(new URLSearchParams(window.location.search).get("q")).toBe("AB");
    expect(new URLSearchParams(window.location.search).get("from")).toBe("node"); expect(window.location.hash).toBe("#list"); expect(query().get("search")).toBe("AB");
  });

  it("pushes page/limit intents without persisting default values or changing the search", async () => {
    window.history.replaceState(null, "", "/customers?q=seed"); const { result } = mount(); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.setPage(2)); expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    act(() => result.current.setLimit(50)); expect(result.current.page).toBe(1); expect(new URLSearchParams(window.location.search).has("page")).toBe(false); expect(new URLSearchParams(window.location.search).get("limit")).toBe("50");
    expect(new URLSearchParams(window.location.search).get("q")).toBe("seed"); expect(push).toHaveBeenCalledTimes(2);
  });

  it("does not create history entries on refresh, no-op updates or settling restored debounce", async () => {
    window.history.replaceState(null, "", "/customers?q=seed"); const { result } = mount();
    expect(result.current.page).toBe(1); expect(result.current.filters.search).toBe("seed"); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.setPage((page) => page)); act(() => result.current.setFilter("search", "seed")); await advance(500);
    expect(requests).toHaveLength(1);
    let refresh!: Promise<void>; act(() => { refresh = result.current.fetchCustomers(); }); expect(requests).toHaveLength(2);
    await reply(1); expect(requests).toHaveLength(2); await act(async () => refresh);
    expect(push).not.toHaveBeenCalled();
  });

  it("preserves the existing page reset when the same filter value is set on a later page", async () => {
    window.history.replaceState(null, "", "/customers?q=seed&page=2"); const { result } = mount(); await reply();
    act(() => result.current.setFilter("search", "seed")); expect(result.current.page).toBe(1); expect(query().get("page")).toBe("1"); expect(new URLSearchParams(window.location.search).has("page")).toBe(false);
  });

  it("does not push a semantically identical page merely to reorder URL parameters", async () => {
    window.history.replaceState(null, "", "/customers?q=seed&limit=20&page=2&from=node"); const { result } = mount(); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.setPage((page) => page)); expect(push).not.toHaveBeenCalled(); expect(window.location.search).toBe("?q=seed&limit=20&page=2&from=node");
  });

  it("clears several filters into one history entry after the last debounce, keeping the hash", async () => {
    window.history.replaceState(null, "", "/customers?q=seed&status=Hoat+dong&billingType=PREPAID&from=node#list"); const { result } = mount(); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => { result.current.setFilter("search", ""); result.current.setFilter("status", ""); result.current.setFilter("billingType", ""); });
    await advance(300); expect(push).not.toHaveBeenCalled(); await advance(200); expect(push).toHaveBeenCalledTimes(1); expect(window.location.search).toBe("?from=node"); expect(window.location.hash).toBe("#list");
  });

  it("restores popstate atomically, clears selection, and does not echo a history write", async () => {
    window.history.replaceState(null, "", "/customers?q=first&page=2"); const { result } = mount(); await reply(); act(() => result.current.setSelectedIds([syntheticCustomer.id])); const push = vi.spyOn(window.history, "pushState");
    popTo("/customers?q=second&page=3&limit=50&status=Roi+mang");
    expect(result.current.filters.search).toBe("second"); expect(result.current.filters.status).toBe("Roi mang"); expect(result.current.page).toBe(3); expect(result.current.limit).toBe(50); expect(result.current.selectedIds).toEqual([]);
    expect(query().get("search")).toBe("second"); expect(query().get("page")).toBe("3"); expect(query().get("limit")).toBe("50");
    const count = requests.length; await advance(500); expect(requests).toHaveLength(count); expect(push).not.toHaveBeenCalled();
  });

  it("fences a pending edit when history restores a different query", async () => {
    const { result } = mount(); await reply(); const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.setFilter("search", "obsolete")); await advance(200); popTo("/customers?q=restored&page=4");
    expect(query().get("search")).toBe("restored"); expect(query().get("page")).toBe("4"); await advance(500);
    expect(result.current.filters.search).toBe("restored"); expect(requests.some((request) => new URL(request.url, "http://fixture.invalid").searchParams.get("search") === "obsolete")).toBe(false); expect(push).not.toHaveBeenCalled();
  });

  it("still debounces a user edit made before the restored seed timer catches up", async () => {
    window.history.replaceState(null, "", "/customers?q=seed"); const { result } = mount(); await reply();
    act(() => result.current.setFilter("search", "edited")); await advance(499); expect(requests).toHaveLength(1); expect(query().get("search")).toBe("seed");
    await advance(1); expect(requests).toHaveLength(2); expect(query().get("search")).toBe("edited"); expect(new URLSearchParams(window.location.search).get("q")).toBe("edited");
  });

  it("does not navigate back to customers if a debounce settles after leaving the route", async () => {
    const { result } = mount(); await reply(); act(() => result.current.setFilter("search", "pending"));
    window.history.replaceState(null, "", "/elsewhere?keep=1"); await advance(500); expect(window.location.pathname).toBe("/elsewhere"); expect(window.location.search).toBe("?keep=1");
  });

  it("keeps filtering usable when the browser refuses history persistence", async () => {
    const { result } = mount(); await reply(); vi.spyOn(window.history, "pushState").mockImplementation(() => { throw new DOMException("synthetic refusal", "SecurityError"); });
    act(() => result.current.setPage(2)); expect(result.current.page).toBe(2); expect(query().get("page")).toBe("2");
  });

  it("removes the native history subscription on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener"); const { unmount } = mount(); unmount(); expect(remove).toHaveBeenCalledWith("popstate", expect.any(Function));
    const count = requests.length; popTo("/customers?q=after-unmount"); expect(requests).toHaveLength(count);
  });

  it("does not read the browser URL or fetch while server-rendering the initial view", () => {
    window.history.replaceState(null, "", "/customers?q=client-only&page=3");
    function Probe() { const state = useCustomers({ syncUrl: true }); return <output>{`${state.page}|${state.filters.search}|${state.loading}`}</output>; }
    const Wrapper = makeWrapper(); const html = renderToString(<Wrapper><Probe /></Wrapper>); expect(html).toContain("1||true"); expect(requests).toHaveLength(0);
  });

  it("keeps URL synchronization opt-in for an existing plain hook consumer", async () => {
    window.history.replaceState(null, "", "/customers?q=ignored&page=4"); const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() });
    expect(result.current.page).toBe(1); expect(result.current.filters.search).toBe(""); await reply();
    act(() => result.current.setFilter("search", "local")); await advance(500); expect(push).not.toHaveBeenCalled(); expect(new URLSearchParams(window.location.search).get("q")).toBe("ignored");
  });

  it("wires the actual customer page to the q deep link", async () => {
    window.history.replaceState(null, "", "/customers?q=NODE_ACCOUNT&status=Hoat+dong"); render(<CustomersPage />, { wrapper: makeWrapper() }); await act(async () => undefined);
    expect(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0]).toHaveValue("NODE_ACCOUNT"); expect(query().get("search")).toBe("NODE_ACCOUNT");
    await reply(); fireEvent.click(screen.getByRole("button", { name: "Trang sau" })); expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  });
});
