// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/(dashboard)/customers/page";
import { useCustomers, type CustomerFilters } from "@/hooks/useCustomers";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import type { Customer, PaginatedResponse } from "@/types";
import { syntheticCustomer } from "../fixtures/customer-mobile-controls";

const runtime = vi.hoisted(() => ({ role: "ADMIN", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: runtime.push }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "synthetic-user", role: runtime.role } }, status: "authenticated" }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { id: "synthetic-user", ctvList: [], canUseGps: false }, error: null, loading: false }) }));

type PendingRequest = { url: string; resolve: (value: Response) => void; reject: (reason: Error) => void };
let requests: PendingRequest[];
const oldName = "Khách trước cập nhật";
const newName = "Khách sau cập nhật";
const payload = (name = oldName, page = 1): PaginatedResponse<Customer> => ({ data: [{ ...syntheticCustomer, name }], total: 35, page, totalPages: 4 });
const emptyPayload: PaginatedResponse<Customer> = { data: [], total: 0, page: 1, totalPages: 1 };
const oldResultDescription = "Dữ liệu đang hiển thị có thể chưa khớp bộ lọc hoặc trang vừa chọn.";

function makeWrapper() {
  const cache = new Map();
  const config = { provider: () => cache, shouldRetryOnError: false };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={config}><ConfirmDialogProvider>{children}</ConfirmDialogProvider></SWRConfig>;
  };
}

async function reply(index: number, body: unknown = payload(), status = 200) {
  expect(requests[index]).toBeDefined();
  await act(async () => requests[index].resolve({ ok: status < 400, json: async () => body } as Response));
}

async function reject(index: number) {
  await act(async () => requests[index].reject(new Error("synthetic network rejection")));
}

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

async function mountPage() {
  const view = render(<CustomersPage />, { wrapper: makeWrapper() });
  await act(async () => undefined);
  expect(requests).toHaveLength(1);
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  requests = []; runtime.role = "ADMIN"; runtime.push.mockClear();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input); expect(url.startsWith("/api/customers?")).toBe(true);
    return new Promise<Response>((resolve, rejectRequest) => requests.push({ url, resolve, reject: rejectRequest }));
  }));
});

afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("customer query state using real SWR", () => {
  it("distinguishes the first load from refresh and records an empty success as data", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() });
    expect(result.current.loading).toBe(true); expect(result.current.refreshing).toBe(false); expect(result.current.hasData).toBe(false);
    await reply(0, emptyPayload);
    expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(false); expect(result.current.hasData).toBe(true); expect(result.current.customers).toEqual([]);
  });

  it("keeps loaded rows visible while a new page key has no cached data", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0);
    const previousRows = result.current.customers;
    act(() => result.current.setPage(2));
    expect(requests).toHaveLength(2); expect(new URL(requests[1].url, "http://fixture.invalid").searchParams.get("page")).toBe("2");
    expect(result.current.customers).toBe(previousRows); expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(true);
    await reply(1, payload(newName, 2));
    expect(result.current.customers[0].name).toBe(newName); expect(result.current.refreshing).toBe(false);
  });

  it.each([
    ["search", "  tìm + mới  ", 500], ["subscriberType", "FIXED", 300], ["billingType", "PREPAID", 300],
    ["prepaidPeriod", "6", 300], ["ctvCode", "CTV_GIA_LAP", 300], ["expirationFilter", "soon", 300], ["status", "Hoat dong", 300],
  ] as const)("reports pending %s immediately without changing its debounce/request value", async (key, value, delay) => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0);
    act(() => result.current.setFilter(key, value));
    expect(result.current.filters[key]).toBe(value); expect(result.current.refreshing).toBe(true); expect(result.current.loading).toBe(false); expect(requests).toHaveLength(1);
    await advance(delay - 1); expect(requests).toHaveLength(1); expect(result.current.refreshing).toBe(true);
    await advance(1); expect(requests).toHaveLength(2);
    expect(new URL(requests[1].url, "http://fixture.invalid").searchParams.get(key)).toBe(value);
    await reply(1); expect(result.current.refreshing).toBe(false);
  });

  it("treats a cached empty response as previous data during debounce and key loading", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0, emptyPayload);
    act(() => result.current.setFilter("search", "new"));
    expect(result.current.hasData).toBe(true); expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(true);
    await advance(500); expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(true);
    await reply(1); expect(result.current.customers[0].name).toBe(oldName);
  });

  it("retains rows and the hook error after a failed manual revalidation", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.fetchCustomers().catch(() => undefined); });
    expect(result.current.refreshing).toBe(true); expect(result.current.loading).toBe(false); expect(requests).toHaveLength(2);
    await reply(1, { error: "synthetic failure" }, 500); await act(async () => refresh);
    expect(result.current.error).toBe("synthetic failure"); expect(result.current.hasData).toBe(true); expect(result.current.customers[0].name).toBe(oldName); expect(result.current.refreshing).toBe(false);
  });

  it("does not let an older page response replace a newer page", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0);
    act(() => result.current.setPage(2)); act(() => result.current.setPage(3)); expect(requests).toHaveLength(3);
    await reply(2, payload(newName, 3)); await reply(1, payload("Khách trang cũ", 2));
    expect(result.current.page).toBe(3); expect(result.current.customers[0].name).toBe(newName); expect(result.current.refreshing).toBe(false);
  });

  it("preserves page reset, selection clearing and the exact limit query", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: makeWrapper() }); await reply(0);
    act(() => result.current.setPage(2)); await reply(1, payload(oldName, 2));
    act(() => result.current.setSelectedIds([syntheticCustomer.id])); expect(result.current.selectedIds).toHaveLength(1);
    act(() => result.current.setLimit(50));
    expect(result.current.page).toBe(1); expect(result.current.limit).toBe(50); expect(result.current.selectedIds).toEqual([]);
    const query = new URL(requests[2].url, "http://fixture.invalid").searchParams;
    expect(query.get("page")).toBe("1"); expect(query.get("limit")).toBe("50"); expect(query.get("includeTotal")).toBe("true");
    await reply(2);
  });

  it("does not override a fixed filter or manufacture a request for it", async () => {
    const fixedFilters: Partial<CustomerFilters> = { ctvCode: "CTV_FIXED" };
    const { result } = renderHook(() => useCustomers({ fixedFilters }), { wrapper: makeWrapper() }); await reply(0);
    act(() => result.current.setFilter("ctvCode", "OTHER")); await advance(300);
    expect(result.current.filters.ctvCode).toBe("CTV_FIXED"); expect(requests).toHaveLength(1); expect(result.current.refreshing).toBe(false);
  });
});

describe("customer page loading, stale data and read failure", () => {
  it.each(["http", "network"])("shows a retryable initial %s error instead of a false empty result", async (failure) => {
    await mountPage(); expect(screen.getByRole("status", { name: "Đang tải danh sách khách hàng" })).toBeInTheDocument();
    if (failure === "http") await reply(0, { error: "synthetic backend detail" }, 500); else await reject(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được danh sách khách hàng");
    expect(screen.queryByText("Chưa có khách hàng")).not.toBeInTheDocument(); expect(screen.queryByText("Không tìm thấy khách hàng")).not.toBeInTheDocument();
    expect(screen.queryByText("synthetic backend detail")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Danh sách khách hàng" })).toHaveAttribute("aria-busy", "false");
    const retry = screen.getByRole("button", { name: "Thử lại" }); expect(retry).toHaveAttribute("type", "button");
    fireEvent.click(retry); expect(requests).toHaveLength(2); expect(requests[1].url).toBe(requests[0].url);
    await reply(1, emptyPayload); expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByText("Chưa có khách hàng")).toBeInTheDocument();
  });

  it("keeps the same row DOM during page changes and marks only the list busy", async () => {
    await mountPage(); await reply(0); const previousRow = screen.getAllByText(oldName)[0];
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(previousRow).toBeInTheDocument(); expect(screen.queryByRole("status", { name: "Đang tải danh sách khách hàng" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đang cập nhật danh sách"); expect(screen.getByRole("status")).toHaveTextContent(oldResultDescription);
    const list = screen.getByRole("region", { name: "Danh sách khách hàng" }); expect(list).toHaveAttribute("aria-busy", "true"); expect(list).not.toContainElement(screen.getByRole("status"));
    await reply(1, payload(newName, 2)); expect(screen.queryByText(oldName)).not.toBeInTheDocument(); expect(screen.getAllByText(newName).length).toBeGreaterThan(0);
    expect(list).toHaveAttribute("aria-busy", "false"); expect(screen.queryByText("Đang cập nhật danh sách")).not.toBeInTheDocument();
  });

  it("announces the debounce gap and preserves the search until new rows arrive", async () => {
    await mountPage(); await reply(0);
    fireEvent.change(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0], { target: { value: "sau" } });
    expect(requests).toHaveLength(1); expect(screen.getByRole("status")).toHaveTextContent(oldResultDescription); expect(screen.getAllByText(oldName).length).toBeGreaterThan(0);
    await advance(500); expect(requests).toHaveLength(2); expect(screen.getByRole("status")).toHaveTextContent("Đang cập nhật danh sách");
    await reply(1, payload(newName)); expect(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0]).toHaveValue("sau");
    expect(screen.queryByText("Đang cập nhật danh sách")).not.toBeInTheDocument(); expect(screen.getAllByText(newName).length).toBeGreaterThan(0);
  });

  it("keeps a cached empty response from claiming the pending or failed filter has no results", async () => {
    await mountPage(); await reply(0, emptyPayload); expect(screen.getByText("Chưa có khách hàng")).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0], { target: { value: "sau" } });
    expect(screen.queryByText("Không tìm thấy khách hàng")).not.toBeInTheDocument(); expect(screen.queryByText("Chưa có khách hàng")).not.toBeInTheDocument();
    await advance(500); await reply(1, { error: "synthetic failed filter" }, 500);
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa cập nhật được danh sách"); expect(screen.queryByText("Không tìm thấy khách hàng")).not.toBeInTheDocument();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("keeps rows and filter context on refresh error and permits retry for %s", async (role) => {
    runtime.role = role; await mountPage(); await reply(0);
    fireEvent.change(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0], { target: { value: "sau" } });
    await advance(500); await reply(1, { error: "synthetic failed filter" }, 500);
    const alert = screen.getByRole("alert"); expect(alert).toHaveTextContent("Chưa cập nhật được danh sách"); expect(alert).toHaveTextContent(oldResultDescription);
    expect(screen.getAllByText(oldName).length).toBeGreaterThan(0); expect(screen.queryByRole("status", { name: "Đang tải danh sách khách hàng" })).not.toBeInTheDocument();
    const retry = within(alert).getByRole("button", { name: "Thử lại" });
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    expect(requests).toHaveLength(3); expect(requests[2].url).toBe(requests[1].url);
    await reply(2, payload(newName)); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0]).toHaveValue("sau"); expect(screen.getAllByText(newName).length).toBeGreaterThan(0);
  });

  it("does not let a pending retry for an old filter block retrying a new failed filter", async () => {
    await mountPage(); await reply(0);
    const search = screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })[0];
    fireEvent.change(search, { target: { value: "first" } }); await advance(500); await reply(1, { error: "synthetic first failure" }, 500);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); expect(requests).toHaveLength(3);
    fireEvent.change(search, { target: { value: "second" } }); await advance(500); expect(requests).toHaveLength(4);
    await reply(3, { error: "synthetic second failure" }, 500);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(requests).toHaveLength(5); expect(new URL(requests[4].url, "http://fixture.invalid").searchParams.get("search")).toBe("second");
    await reply(2, payload("Kết quả filter cũ"));
    expect(screen.queryByText("Kết quả filter cũ")).not.toBeInTheDocument(); expect(screen.getByRole("status")).toHaveTextContent("Đang cập nhật danh sách");
    await reply(4, payload(newName)); expect(screen.getAllByText(newName).length).toBeGreaterThan(0); expect(search).toHaveValue("second");
  });
});
