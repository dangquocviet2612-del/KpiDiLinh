// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmDialogOptions } from "@/components/ui/ConfirmDialogProvider";
import LogsPage from "@/app/(dashboard)/logs/page";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn<(options: ConfirmDialogOptions) => Promise<boolean>>(),
  error: vi.fn<(message: string) => void>(), success: vi.fn<(message: string) => void>(),
  router: { push: vi.fn() }, session: { user: { id: "delete-fixture-admin", role: "ADMIN" } },
}));
vi.mock("react", async (original) => original<typeof import("react")>());
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: mocks.session, status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/ui/ConfirmDialogProvider", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.error, success: mocks.success } }));

const UNKNOWN = "Chưa xác định được kết quả xóa nhật ký. Dữ liệu có thể đã thay đổi; hãy kiểm tra trước khi thử lại.";
const CONFIRM_ERROR = "Không thể mở xác nhận xóa nhật ký. Vui lòng thử lại.";
const ACK_UI_ERROR = "Đã nhận xác nhận xóa nhật ký thành công, nhưng không thể cập nhật giao diện. Vui lòng tải lại trang để kiểm tra.";
const fetchMock = vi.fn<typeof fetch>();
const deleteReply = vi.fn<() => Promise<Response>>();
let logsReply: { data: { id: string; createdAt: string; details: string; user: { username: string }; customer: { name: string; account: string } }[]; total: number; totalPages: number };

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body) } as unknown as Response;
}
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function deletes() { return fetchMock.mock.calls.filter(([url, options]) => url === "/api/logs" && options?.method === "DELETE"); }
function gets() { return fetchMock.mock.calls.filter(([url]) => typeof url === "string" && url.startsWith("/api/logs?")); }
async function mount() {
  const view = render(<LogsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
  return view;
}
function chooseFirst() {
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getAllByText("fixture-operator-1")[0]);
  expect(screen.getByRole("heading", { name: "Chi tiết thao tác" })).toBeInTheDocument();
  return screen.getByRole("button", { name: "Xóa 1 dòng" });
}
async function click(button: HTMLElement, count = 1) {
  await act(async () => { for (let index = 0; index < count; index++) fireEvent.click(button); });
}
async function expectUnacknowledged(message = UNKNOWN, initialGets = 1) {
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(message));
  await waitFor(() => expect(screen.getByRole("button", { name: "Xóa 1 dòng" })).toBeEnabled());
  expect(mocks.error).toHaveBeenCalledTimes(1); expect(mocks.success).not.toHaveBeenCalled();
  expect(deletes()).toHaveLength(1); expect(gets()).toHaveLength(initialGets);
  expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
  expect(screen.getByRole("heading", { name: "Chi tiết thao tác" })).toBeInTheDocument();
  expect(mocks.router.push).not.toHaveBeenCalled();
}

beforeEach(() => {
  mocks.confirm.mockReset().mockResolvedValue(true); mocks.error.mockReset(); mocks.success.mockReset(); mocks.router.push.mockReset();
  logsReply = { data: [1, 2].map((index) => ({ id: "fixture-log-" + index, createdAt: "2026-10-01T10:00:00.000Z", details: JSON.stringify({ action: "UPDATE", changes: { phone: { old: "fixture-old", new: "fixture-new" } } }), user: { username: "fixture-operator-" + index }, customer: { name: "Fixture customer " + index, account: "fixture-account-" + index } })), total: 2, totalPages: 1 };
  deleteReply.mockReset().mockResolvedValue(response({ success: true, count: 1 }));
  fetchMock.mockReset().mockImplementation((url, options) => {
    if (typeof url === "string" && url.startsWith("/api/logs?")) return Promise.resolve(response(logsReply));
    if (url === "/api/logs" && options?.method === "DELETE") return deleteReply();
    return Promise.reject(new Error("Unexpected fixture request"));
  });
  vi.stubGlobal("fetch", fetchMock); vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("delete-log single-flight and confirmation lifecycle", () => {
  it("does not start a deletion without selected IDs or dates", async () => {
    await mount(); const button = screen.getByRole("button", { name: "Xóa theo bộ lọc" });
    expect(button).toBeDisabled(); await click(button);
    expect(deletes()).toHaveLength(0); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("allows only one confirmation while its promise is pending", async () => {
    const pending = deferred<boolean>(); mocks.confirm.mockReturnValue(pending.promise);
    await mount(); const button = chooseFirst(); await click(button, 3);
    expect(mocks.confirm).toHaveBeenCalledTimes(1); expect(deletes()).toHaveLength(0);
    await act(async () => pending.resolve(false));
    expect(button).toBeEnabled(); expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
  });
  it("sends one DELETE for same-tick duplicate clicks and keeps request disabled", async () => {
    const pending = deferred<Response>(); deleteReply.mockReturnValue(pending.promise);
    await mount(); const button = chooseFirst(); await click(button, 3);
    expect(mocks.confirm).toHaveBeenCalledTimes(1); expect(deletes()).toHaveLength(1); expect(button).toBeDisabled();
    await click(button); expect(deletes()).toHaveLength(1);
    await act(async () => pending.resolve(response({ success: true, count: 1 })));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa 1 bản ghi."));
  });
  it("releases the lock on cancel so a later explicit click can proceed", async () => {
    mocks.confirm.mockResolvedValueOnce(false); await mount(); const button = chooseFirst(); await click(button);
    expect(deletes()).toHaveLength(0); expect(mocks.error).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
    await click(button); await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa 1 bản ghi."));
    expect(mocks.confirm).toHaveBeenCalledTimes(2); expect(deletes()).toHaveLength(1);
  });
  it("handles rejected confirmation without an unhandled rejection or stuck lock", async () => {
    mocks.confirm.mockRejectedValueOnce(new Error("Fixture dialog failure"));
    await mount(); const button = chooseFirst(); await click(button);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(CONFIRM_ERROR));
    expect(deletes()).toHaveLength(0); expect(button).toBeEnabled(); expect(gets()).toHaveLength(1);
    await click(button); await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa 1 bản ghi."));
    expect(deletes()).toHaveLength(1);
  });
});

describe("delete-log acknowledgement and truthful failure feedback", () => {
  const invalid = [null, {}, [], true, { count: 1 }, { success: false, count: 1 }, { success: "true", count: 1 }, { success: true },
    { success: true, count: null }, { success: true, count: "1" }, { success: true, count: -1 }, { success: true, count: 1.5 },
    { success: true, count: Number.NaN }, { success: true, count: Number.POSITIVE_INFINITY }, { success: true, count: Number.MAX_SAFE_INTEGER + 1 }];
  it.each(invalid.map((ack) => ({ ack })))("does not treat invalid200 acknowledgement as success: %j", async ({ ack }) => {
    deleteReply.mockResolvedValueOnce(response(ack)); await mount(); const button = chooseFirst(); await click(button);
    await expectUnacknowledged();
  });
  it("treats an unreadable200 JSON body as an unknown mutation result", async () => {
    const reply = response(null); vi.mocked(reply.json).mockRejectedValue(new Error("Fixture JSON failure"));
    deleteReply.mockResolvedValueOnce(reply); await mount(); await click(chooseFirst()); await expectUnacknowledged();
  });
  it.each([500, 502, 503])("does not parse5xx or announce that deletion definitely failed: %s", async (status) => {
    const reply = response({ success: true, count: 999 }, status); deleteReply.mockResolvedValueOnce(reply);
    await mount(); await click(chooseFirst()); await expectUnacknowledged(); expect(reply.json).not.toHaveBeenCalled();
  });
  it("warns about an unknown result on network failure without auto retry", async () => {
    deleteReply.mockRejectedValueOnce(new Error("Fixture network failure"));
    await mount(); await click(chooseFirst()); await expectUnacknowledged();
  });
  it.each([null, {}, { error: {} }, { error: false }, { error: " " }].map((body) => ({ body })))("handles unstructured4xx safely: %j", async ({ body }) => {
    deleteReply.mockResolvedValueOnce(response(body, 400)); await mount(); await click(chooseFirst()); await expectUnacknowledged("Xóa log thất bại.");
  });
  it("preserves a structured4xx string error and existing selection/detail", async () => {
    deleteReply.mockResolvedValueOnce(response({ error: "Fixture permission denial" }, 403));
    await mount(); await click(chooseFirst()); await expectUnacknowledged("Fixture permission denial");
  });
  it("falls back for unreadable4xx without exposing raw response text", async () => {
    const reply = response(null, 401); vi.mocked(reply.json).mockRejectedValue(new Error("Fixture raw response"));
    deleteReply.mockResolvedValueOnce(reply); await mount(); await click(chooseFirst()); await expectUnacknowledged("Xóa log thất bại.");
  });
  it("keeps the current page on an unacknowledged result", async () => {
    logsReply.totalPages = 2; logsReply.total = 40; deleteReply.mockResolvedValueOnce(response({ success: false, count: 0 }));
    await mount(); await click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    await click(chooseFirst()); await expectUnacknowledged(UNKNOWN, 2); expect(screen.getByText("Trang 2/2")).toBeInTheDocument();
  });
  it("permits explicit manual retry after an unknown result, but does not retry automatically", async () => {
    deleteReply.mockRejectedValueOnce(new Error("Fixture network failure"));
    await mount(); const button = chooseFirst(); await click(button); await expectUnacknowledged();
    await click(button); await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa 1 bản ghi."));
    expect(deletes()).toHaveLength(2); expect(mocks.confirm).toHaveBeenCalledTimes(2); expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it("distinguishes UI failure after a known acknowledgement", async () => {
    mocks.success.mockImplementationOnce(() => { throw new Error("Fixture toast failure"); });
    await mount(); const button = chooseFirst(); await click(button);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(ACK_UI_ERROR));
    expect(button).toBeEnabled(); expect(deletes()).toHaveLength(1); expect(gets()).toHaveLength(1);
  });
});

describe("delete-log valid contract remains unchanged", () => {
  it.each([0, 2, Number.MAX_SAFE_INTEGER])("accepts valid safe-integer count%s and follows existing success/refresh", async (count) => {
    deleteReply.mockResolvedValueOnce(response({ success: true, count, extra: "fixture" }));
    await mount(); await click(chooseFirst());
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`Đã xóa ${count} bản ghi.`));
    await waitFor(() => expect(gets()).toHaveLength(2)); expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.getByText("Chọn một dòng nhật ký để xem chi tiết.")).toBeInTheDocument();
    expect(deletes()[0]).toEqual(["/api/logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ["fixture-log-1"] }) }]);
    expect(mocks.confirm.mock.calls[0][0]).toEqual({ title: "Xóa 1 nhật ký?", description: "Bạn có chắc muốn xóa 1 dòng log đã chọn?", confirmLabel: "Xóa nhật ký", destructive: true, confirmationText: undefined });
  });
  it("preserves date-scoped request and destructive confirmation text", async () => {
    const view = await mount(); const dateInputs = view.container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    fireEvent.change(dateInputs[1], { target: { value: "2026-10-31" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    await click(screen.getByRole("button", { name: "Xóa theo bộ lọc" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa 1 bản ghi."));
    expect(deletes()[0]?.[1]?.body).toBe(JSON.stringify({ startDate: "2026-10-01", endDate: "2026-10-31" }));
    expect(mocks.confirm.mock.calls[0][0]).toMatchObject({ title: "Xóa nhật ký theo bộ lọc?", destructive: true, confirmationText: "XOA NHAT KY" });
  });
});
