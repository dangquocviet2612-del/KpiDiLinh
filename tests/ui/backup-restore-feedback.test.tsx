// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmDialogOptions } from "@/components/ui/ConfirmDialogProvider";
import { BACKUP_RESTORE_SIZE_ERROR } from "@/lib/backup-restore-limits";
import LogsPage from "@/app/(dashboard)/logs/page";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn<(options: ConfirmDialogOptions) => Promise<boolean>>(),
  error: vi.fn(),
  success: vi.fn(),
  router: { push: vi.fn() },
  session: { user: { id: "feedback-admin", role: "ADMIN" } },
}));

vi.mock("react", async (importOriginal) => importOriginal<typeof import("react")>());
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/ui/ConfirmDialogProvider", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.error, success: mocks.success } }));

const BACKUP_URL = "/api/admin/backup";
const RESTORE_LABEL = "Khôi phục dữ liệu";
const UNKNOWN_MESSAGE = "Chưa xác định được kết quả khôi phục. Dữ liệu có thể đã thay đổi; hãy kiểm tra trước khi thử lại.";
const CONFIRM_ERROR_MESSAGE = "Không thể mở xác nhận khôi phục. Vui lòng thử lại.";
const FILE_ERROR_MESSAGE = "File không hợp lệ hoặc có lỗi khi khôi phục.";
const RESTORE_ERROR_MESSAGE = "Khôi phục dữ liệu thất bại.";
const ACK_UI_ERROR_MESSAGE = "Đã nhận xác nhận khôi phục thành công, nhưng không thể cập nhật giao diện. Vui lòng tải lại trang để kiểm tra.";
const ACK = { success: true, restored: { users: 2, customers: 3 } };
const BACKUP_TEXT = `{
  "version": 1,
  "data": {
    "users": [{ "id": "feedback-user", "username": "admin" }],
    "customers": [{ "id": "feedback-customer", "name": "Khách hàng mẫu", "account": "000123" }],
    "logs": [],
    "settings": { "enabled": false, "note": null }
  }
}`;
const fetchMock = vi.fn<typeof fetch>();
const restoreReply = vi.fn<() => Promise<Response>>();

type LogFixture = {
  id: string;
  createdAt: string;
  details: string;
  user: { username: string };
  customer: { name: string; account: string };
};

let logsReply: { data: LogFixture[]; total: number; page: number; limit: number; totalPages: number };
let getLogsReply: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeBackup(name = "feedback-backup.json", text = BACKUP_TEXT, size = 100) {
  const file = new File([text], name, { type: "application/json" });
  const read = vi.fn<() => Promise<string>>().mockResolvedValue(text);
  Object.defineProperty(file, "size", { configurable: true, value: size });
  Object.defineProperty(file, "text", { configurable: true, value: read });
  return { file, read, text };
}

type BackupFixture = ReturnType<typeof makeBackup>;

function restorePosts() {
  return fetchMock.mock.calls.filter(([request, options]) => request === BACKUP_URL && options?.method === "POST");
}

function logsGets() {
  return fetchMock.mock.calls.filter(([request, options]) => (
    typeof request === "string" && request.startsWith("/api/logs?") && (!options?.method || options.method === "GET")
  ));
}

async function mountPage() {
  const view = render(<LogsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
  expect(fetchMock).toHaveBeenCalledWith("/api/logs?page=1&limit=20");
  expect(screen.getByText("Không có nhật ký phù hợp")).toBeInTheDocument();
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Expected the existing LogsPage backup file input");
  return { ...view, input, restore: screen.getByRole("button", { name: RESTORE_LABEL }) };
}

type PageHarness = Awaited<ReturnType<typeof mountPage>>;

function selectBackup(harness: PageHarness, backup: BackupFixture) {
  expect(harness.input).toBeEnabled();
  fireEvent.change(harness.input, { target: { files: [backup.file] } });
  expect(harness.input.files?.[0]).toBe(backup.file);
  expect(screen.getByText(`Đã chọn: ${backup.file.name}`)).toBeInTheDocument();
}

async function clickRestore(harness: PageHarness, clicks = 1) {
  await act(async () => {
    for (let clickIndex = 0; clickIndex < clicks; clickIndex += 1) {
      fireEvent.click(harness.restore);
    }
  });
}

function expectRetainedFile(harness: PageHarness, backup: BackupFixture) {
  expect(harness.input.files?.[0]).toBe(backup.file);
  expect(screen.getByText(`Đã chọn: ${backup.file.name}`)).toBeInTheDocument();
  expect(harness.input).toBeEnabled();
  expect(harness.restore).toBeEnabled();
}

function expectConfirmation(backup: BackupFixture, index = 0) {
  const [options] = mocks.confirm.mock.calls[index];
  expect(options).toEqual({
    title: "Khôi phục toàn bộ dữ liệu?",
    description: "File backup sẽ ghi đè dữ liệu hiện tại. Hành động này có rủi ro cao và không thể hoàn tác tự động.",
    confirmLabel: RESTORE_LABEL,
    destructive: true,
    details: expect.anything(),
    confirmationText: "KHOI PHUC",
  });
  expect(options.details).toMatchObject({ type: "strong", props: { children: backup.file.name } });
}

function expectPost(backup: BackupFixture, index = 0) {
  expect(restorePosts()[index]).toEqual([BACKUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(JSON.parse(backup.text)),
  }]);
  expect(restorePosts()[index][1]?.body).not.toBe(backup.text);
}

function successMessage(customers: number, users: number) {
  return `Khôi phục thành công: ${customers} khách hàng, ${users} người dùng.`;
}

async function expectUnacknowledged(harness: PageHarness, backup: BackupFixture, message: string, initialGets = 1) {
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(message));
  await waitFor(() => expect(harness.restore).toBeEnabled());
  expect(mocks.error).toHaveBeenCalledTimes(1);
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  expect(backup.read).toHaveBeenCalledTimes(1);
  expect(restorePosts()).toHaveLength(1);
  expect(logsGets()).toHaveLength(initialGets);
  expect(fetchMock).toHaveBeenCalledTimes(initialGets + 1);
  expect(mocks.router.push).not.toHaveBeenCalled();
  expectRetainedFile(harness, backup);
}

async function expectManualCancelAfterRelease(harness: PageHarness, backup: BackupFixture) {
  const confirmations = mocks.confirm.mock.calls.length;
  const reads = backup.read.mock.calls.length;
  const posts = restorePosts().length;
  const errors = mocks.error.mock.calls.length;
  mocks.confirm.mockResolvedValueOnce(false);
  await clickRestore(harness);
  expect(mocks.confirm).toHaveBeenCalledTimes(confirmations + 1);
  expectConfirmation(backup, confirmations);
  expect(backup.read).toHaveBeenCalledTimes(reads);
  expect(restorePosts()).toHaveLength(posts);
  expect(mocks.error).toHaveBeenCalledTimes(errors);
  expectRetainedFile(harness, backup);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.error.mockReset();
  mocks.success.mockReset();
  mocks.router.push.mockReset();
  logsReply = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  getLogsReply = async () => jsonResponse(logsReply);
  restoreReply.mockReset().mockResolvedValue(jsonResponse(ACK));
  fetchMock.mockReset().mockImplementation(async (request, options) => {
    if (typeof request === "string" && request.startsWith("/api/logs?") && (!options?.method || options.method === "GET")) {
      return getLogsReply();
    }
    if (request === BACKUP_URL && options?.method === "POST") return restoreReply();
    throw new Error(`Unexpected fixture request: ${options?.method || "GET"} ${String(request)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LogsPage backup restore feedback", () => {
  it.each([
    { label: "missing success", body: { restored: { users: 2, customers: 3 } } },
    { label: "false success", body: { success: false, restored: { users: 2, customers: 3 } } },
    { label: "truthy non-boolean success", body: { success: "true", restored: { users: 2, customers: 3 } } },
    { label: "missing restored object", body: { success: true } },
    { label: "null restored object", body: { success: true, restored: null } },
    { label: "array restored object", body: { success: true, restored: [] } },
    { label: "missing users count", body: { success: true, restored: { customers: 3 } } },
    { label: "missing customers count", body: { success: true, restored: { users: 2 } } },
    { label: "negative users count", body: { success: true, restored: { users: -1, customers: 3 } } },
    { label: "fractional customers count", body: { success: true, restored: { users: 2, customers: 0.5 } } },
    { label: "string users count", body: { success: true, restored: { users: "2", customers: 3 } } },
    { label: "unsafe customers count", body: { success: true, restored: { users: 2, customers: Number.MAX_SAFE_INTEGER + 1 } } },
    { label: "null users count", body: { success: true, restored: { users: null, customers: 3 } } },
    { label: "null body", body: null },
  ])("treats HTTP 200 with $label as unknown without success effects or automatic retry", async ({ body }) => {
    const harness = await mountPage();
    const backup = makeBackup();
    restoreReply.mockResolvedValueOnce(jsonResponse(body));
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, UNKNOWN_MESSAGE);
    expectConfirmation(backup);
    expectPost(backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it("treats an unreadable HTTP 200 response body as unknown, not as a local file error", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    const reply = jsonResponse(undefined);
    vi.mocked(reply.json).mockRejectedValueOnce(new SyntaxError("Malformed response JSON"));
    restoreReply.mockResolvedValueOnce(reply);
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, UNKNOWN_MESSAGE);
    expect(reply.json).toHaveBeenCalledTimes(1);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each(["HTTP 503", "network rejection"])("warns of an unknown outcome after %s without refetching or retrying", async (failure) => {
    const harness = await mountPage();
    const backup = makeBackup();
    if (failure === "HTTP 503") {
      restoreReply.mockResolvedValueOnce(jsonResponse({ ...ACK, error: "Fixture server failure" }, 503));
    } else {
      restoreReply.mockRejectedValueOnce(new TypeError("Fixture connection lost after POST"));
    }
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, UNKNOWN_MESSAGE);
    expectPost(backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it("handles HTTP 413 with the existing size message before attempting response JSON", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    const reply = jsonResponse(undefined, 413);
    vi.mocked(reply.json).mockRejectedValueOnce(new SyntaxError("Non-JSON proxy response"));
    restoreReply.mockResolvedValueOnce(reply);
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, BACKUP_RESTORE_SIZE_ERROR);
    expect(reply.json).not.toHaveBeenCalled();
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each([
    { label: "nonempty string error", status: 409, body: { ...ACK, error: "Fixture restore request rejected." }, message: "Fixture restore request rejected." },
    { label: "empty string error", status: 400, body: { error: "" }, message: RESTORE_ERROR_MESSAGE },
    { label: "non-string error", status: 422, body: { error: { message: "Not a display string" } }, message: RESTORE_ERROR_MESSAGE },
  ])("keeps structured 4xx feedback for a $label without acknowledging restore", async ({ status, body, message }) => {
    const harness = await mountPage();
    const backup = makeBackup();
    restoreReply.mockResolvedValueOnce(jsonResponse(body, status));
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, message);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each([
    { label: "ordinary counts", users: 2, customers: 3 },
    { label: "zero and maximum safe counts", users: 0, customers: Number.MAX_SAFE_INTEGER },
  ])("acknowledges HTTP success with $label using the existing toast and transport", async ({ users, customers }) => {
    logsReply = { ...logsReply, total: 40, totalPages: 2 };
    const harness = await mountPage();
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    expect(screen.getByText("Trang 2/2")).toBeInTheDocument();
    const initialGets = logsGets().length;
    const backup = makeBackup();
    restoreReply.mockResolvedValueOnce(jsonResponse({ success: true, restored: { users, customers } }));
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(successMessage(customers, users), { duration: 5000 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expectConfirmation(backup);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expectPost(backup);
    expect(screen.queryByText(/^Đã chọn:/)).not.toBeInTheDocument();
    expect(harness.restore).toBeDisabled();
    expect(screen.getByText("Trang 1/2")).toBeInTheDocument();
    expect(logsGets().length).toBeGreaterThan(initialGets);
    expect(mocks.router.push).not.toHaveBeenCalled();
    selectBackup(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each(["cancel", "reject"])("handles confirmation %s before file work and releases the next manual attempt", async (outcome) => {
    const harness = await mountPage();
    const backup = makeBackup();
    if (outcome === "cancel") mocks.confirm.mockResolvedValueOnce(false);
    else mocks.confirm.mockRejectedValueOnce(new Error("Fixture confirmation unavailable"));
    selectBackup(harness, backup);
    await clickRestore(harness);
    if (outcome === "reject") {
      await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(CONFIRM_ERROR_MESSAGE));
      expect(mocks.error).toHaveBeenCalledTimes(1);
    } else {
      expect(mocks.error).not.toHaveBeenCalled();
    }
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expectConfirmation(backup);
    expect(backup.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    expect(logsGets()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expectRetainedFile(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each(["File.text rejection", "invalid local JSON"])("keeps the existing local-file error for %s before POST", async (failure) => {
    const harness = await mountPage();
    const backup = makeBackup();
    if (failure === "File.text rejection") backup.read.mockRejectedValueOnce(new Error("Fixture file read failed"));
    else backup.read.mockResolvedValueOnce("{invalid-local-json");
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FILE_ERROR_MESSAGE));
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expectConfirmation(backup);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(0);
    expect(logsGets()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expectRetainedFile(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it("admits one synchronous attempt across pending confirmation, file read, POST, and response JSON", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    const confirmation = deferred<boolean>();
    const fileRead = deferred<string>();
    const post = deferred<Response>();
    const responseBody = deferred<unknown>();
    const reply = jsonResponse(undefined);
    vi.mocked(reply.json).mockReturnValueOnce(responseBody.promise);
    mocks.confirm.mockReturnValueOnce(confirmation.promise);
    backup.read.mockReturnValueOnce(fileRead.promise);
    restoreReply.mockReturnValueOnce(post.promise);
    selectBackup(harness, backup);
    await clickRestore(harness, 2);
    await clickRestore(harness, 2);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expectConfirmation(backup);
    expect(backup.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    await act(async () => confirmation.resolve(true));
    await waitFor(() => expect(backup.read).toHaveBeenCalledTimes(1));
    await clickRestore(harness, 2);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(0);
    await act(async () => fileRead.resolve(BACKUP_TEXT));
    await waitFor(() => expect(restorePosts()).toHaveLength(1));
    await clickRestore(harness, 2);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => post.resolve(reply));
    await waitFor(() => expect(reply.json).toHaveBeenCalledTimes(1));
    await clickRestore(harness, 2);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => responseBody.resolve(ACK));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(successMessage(3, 2), { duration: 5000 }));
    expect(mocks.error).not.toHaveBeenCalled();
    expectPost(backup);
    selectBackup(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it.each([
    { stage: "confirmation", replacementName: "replacement-backup.json" },
    { stage: "POST", replacementName: "requested-backup.json" },
  ])("retains a new File selected during pending $stage while using the original snapshot", async ({ stage, replacementName }) => {
    const harness = await mountPage();
    const original = makeBackup("requested-backup.json");
    const replacement = makeBackup(replacementName, '{\n  "version": 1, "data": { "users": [], "customers": [], "logs": [] }\n}');
    const confirmation = deferred<boolean>();
    const post = deferred<Response>();
    if (stage === "confirmation") mocks.confirm.mockReturnValueOnce(confirmation.promise);
    restoreReply.mockReturnValueOnce(post.promise);
    selectBackup(harness, original);
    await clickRestore(harness);
    expectConfirmation(original);
    if (stage === "POST") await waitFor(() => expect(restorePosts()).toHaveLength(1));
    else expect(original.read).not.toHaveBeenCalled();
    selectBackup(harness, replacement);
    expect(replacement.file).not.toBe(original.file);
    expect(replacement.read).not.toHaveBeenCalled();
    if (stage === "confirmation") await act(async () => confirmation.resolve(true));
    await waitFor(() => expect(restorePosts()).toHaveLength(1));
    expect(original.read).toHaveBeenCalledTimes(1);
    expectPost(original);
    expect(replacement.read).not.toHaveBeenCalled();
    await act(async () => post.resolve(jsonResponse(ACK)));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(successMessage(3, 2), { duration: 5000 }));
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expect(replacement.read).not.toHaveBeenCalled();
    expectRetainedFile(harness, replacement);
    await expectManualCancelAfterRelease(harness, replacement);
  });

  it("allows a new POST only after an explicit manual retry of an unknown outcome", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    restoreReply.mockResolvedValueOnce(jsonResponse({ success: false, restored: ACK.restored }));
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, UNKNOWN_MESSAGE);
    await act(async () => undefined);
    expect(restorePosts()).toHaveLength(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(successMessage(3, 2), { duration: 5000 }));
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expectConfirmation(backup, 1);
    expect(backup.read).toHaveBeenCalledTimes(2);
    expect(restorePosts()).toHaveLength(2);
    expectPost(backup, 0);
    expectPost(backup, 1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Đã chọn:/)).not.toBeInTheDocument();
    expect(harness.restore).toBeDisabled();
  });

  it("preserves loaded logs, date/action/search/limit filters, page, and current file on unknown feedback", async () => {
    logsReply = { ...logsReply, total: 42, totalPages: 3 };
    const harness = await mountPage();
    logsReply = {
      ...logsReply,
      data: [{
        id: "retained-log",
        createdAt: "2026-10-30T08:00:00.000Z",
        details: JSON.stringify({ action: "UPDATE", changes: { phone: { old: "0900000000", new: "0911111111" } } }),
        user: { username: "feedback-admin" },
        customer: { name: "Retained customer", account: "retained-account" },
      }],
    };
    const [startDate, endDate] = harness.container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const [actionFilter, limit] = screen.getAllByRole("combobox");
    const search = screen.getByPlaceholderText("Tên khách, account, CTV...");
    await act(async () => {
      fireEvent.change(startDate, { target: { value: "2026-10-01" } });
      fireEvent.change(endDate, { target: { value: "2026-10-30" } });
      fireEvent.change(actionFilter, { target: { value: "UPDATE" } });
      fireEvent.change(search, { target: { value: "retained" } });
      fireEvent.change(limit, { target: { value: "50" } });
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    expect(screen.getByText("Trang 2/3")).toBeInTheDocument();
    const loadedLog = screen.getByText("Retained customer");
    const initialGets = logsGets().length;
    expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=2&limit=50&startDate=2026-10-01&endDate=2026-10-30");
    const backup = makeBackup();
    restoreReply.mockResolvedValueOnce(jsonResponse(null));
    selectBackup(harness, backup);
    await clickRestore(harness);
    await expectUnacknowledged(harness, backup, UNKNOWN_MESSAGE, initialGets);
    expect(screen.getByText("Retained customer")).toBe(loadedLog);
    expect(loadedLog).toBeInTheDocument();
    expect(startDate).toHaveValue("2026-10-01");
    expect(endDate).toHaveValue("2026-10-30");
    expect(actionFilter).toHaveValue("UPDATE");
    expect(search).toHaveValue("retained");
    expect(limit).toHaveValue("50");
    expect(screen.getByText("Trang 2/3")).toBeInTheDocument();
  });

  it("reports an acknowledged UI failure if success feedback throws without denying the acknowledgement or reposting", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    mocks.success.mockImplementationOnce(() => { throw new Error("Fixture toast rendering failed"); });
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(ACK_UI_ERROR_MESSAGE));
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(successMessage(3, 2), { duration: 5000 });
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expectPost(backup);
    selectBackup(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it("keeps a known acknowledgement when the actual fetchLogs catches a refresh failure", async () => {
    const harness = await mountPage();
    const backup = makeBackup();
    getLogsReply = async () => { throw new TypeError("Fixture log refresh disconnected"); };
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(successMessage(3, 2), { duration: 5000 }));
    expect(await screen.findByText("Không thể tải nhật ký")).toBeInTheDocument();
    expect(screen.getByText("Không thể kết nối máy chủ để tải nhật ký.")).toBeInTheDocument();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(1);
    expect(logsGets()).toHaveLength(2);
    expect(screen.queryByText(/^Đã chọn:/)).not.toBeInTheDocument();
    expect(harness.restore).toBeDisabled();
    selectBackup(harness, backup);
    await expectManualCancelAfterRelease(harness, backup);
  });

  it("preserves the no-file and 4 MB preflight gates before confirmation, file reads, or POST", async () => {
    const harness = await mountPage();
    expect(harness.restore).toBeDisabled();
    expect(harness.input.files).toHaveLength(0);
    expect(harness.input).toHaveAttribute("accept", "application/json,.json");
    await clickRestore(harness);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    const oversized = makeBackup("too-large.json", BACKUP_TEXT, 4_000_001);
    selectBackup(harness, oversized);
    await clickRestore(harness);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(BACKUP_RESTORE_SIZE_ERROR);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(oversized.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expectRetainedFile(harness, oversized);
    const valid = makeBackup("valid-after-preflight.json", BACKUP_TEXT, 4_000_000);
    selectBackup(harness, valid);
    await expectManualCancelAfterRelease(harness, valid);
    expect(valid.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
  });
});
