// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmDialogOptions } from "@/components/ui/ConfirmDialogProvider";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn<(options: ConfirmDialogOptions) => Promise<boolean>>(),
  error: vi.fn(),
  success: vi.fn(),
  router: { push: vi.fn() },
  session: { user: { id: "fixture-admin", role: "ADMIN" } },
}));

vi.mock("react", async (importOriginal) => importOriginal<typeof import("react")>());
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/ui/ConfirmDialogProvider", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.error, success: mocks.success } }));

const MAX_BYTES = 4_000_000;
const BACKUP_URL = "/api/admin/backup";
const RESTORE_LABEL = "Khôi phục dữ liệu";
const SIZE_MESSAGE = "Khôi phục trên web chỉ nhận file JSON tối đa 4 MB. Không chia nhỏ hoặc sửa file backup; hãy dùng quy trình khôi phục local/offline cho file lớn.";
const FILE_ERROR_MESSAGE = "File không hợp lệ hoặc có lỗi khi khôi phục.";
const FAKE_RESTORE_ERROR = "Fixture restore stopped without database access.";
const BACKUP_TEXT = `{
  "version": 1,
  "data": {
    "users": [{ "id": "fixture-user", "username": "admin" }],
    "customers": [{ "id": "fixture-customer", "name": "Khách hàng mẫu", "account": "000123" }],
    "logs": [],
    "settings": { "enabled": false, "note": null }
  }
}`;
const fetchMock = vi.fn<typeof fetch>();

type LogFixture = {
  id: string;
  createdAt: string;
  details: string;
  user: { username: string };
  customer: { name: string; account: string };
};

let logsReply: { data: LogFixture[]; total: number; page: number; limit: number; totalPages: number };

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(data) } as unknown as Response;
}

function metadataBackup(size: number, text = BACKUP_TEXT, name = "fixture-backup.json") {
  const file = new File(["metadata-only"], name, { type: "application/json" });
  Object.defineProperty(file, "size", { configurable: true, value: size });
  Object.defineProperty(file, "text", { configurable: true, writable: true, value: async () => text });
  const read = vi.spyOn(file, "text");
  return { file, read };
}

type BackupFixture = ReturnType<typeof metadataBackup>;

function restorePosts() {
  return fetchMock.mock.calls.filter(([request, options]) => request === BACKUP_URL && options?.method === "POST");
}

async function mountPage() {
  const { default: LogsPage } = await import("@/app/(dashboard)/logs/page");
  const busyHistory: boolean[] = [];
  const view = render(
    <React.Profiler
      id="backup-restore-size"
      onRender={() => {
        const button = screen.queryByRole("button", { name: RESTORE_LABEL });
        if (button) busyHistory.push(button.querySelector("svg.animate-spin") !== null);
      }}
    >
      <LogsPage />
    </React.Profiler>,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
  expect(fetchMock).toHaveBeenCalledWith("/api/logs?page=1&limit=20");
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Expected the existing LogsPage backup file input");
  return {
    ...view,
    input,
    restore: screen.getByRole("button", { name: RESTORE_LABEL }),
    busyHistory,
  };
}

type PageHarness = Awaited<ReturnType<typeof mountPage>>;

function selectBackup(harness: PageHarness, backup: BackupFixture) {
  fireEvent.change(harness.input, { target: { files: [backup.file] } });
  expect(screen.getByText(`Đã chọn: ${backup.file.name}`)).toBeInTheDocument();
  expect(harness.restore).toBeEnabled();
}

async function clickRestore(harness: PageHarness) {
  await act(async () => {
    fireEvent.click(harness.restore);
  });
}

function expectRetainedSelection(harness: PageHarness, backup: BackupFixture) {
  expect(harness.input.files?.[0]).toBe(backup.file);
  expect(screen.getByText(`Đã chọn: ${backup.file.name}`)).toBeInTheDocument();
  expect(harness.input).toBeEnabled();
  expect(harness.restore).toBeEnabled();
}

function expectNoRestoreWork(harness: PageHarness, backup: BackupFixture) {
  expect(backup.read).not.toHaveBeenCalled();
  expect(restorePosts()).toHaveLength(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(harness.busyHistory).not.toContain(true);
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.router.push).not.toHaveBeenCalled();
  expectRetainedSelection(harness, backup);
}

function expectSizeRejection(harness: PageHarness, backup: BackupFixture) {
  expect(mocks.error).toHaveBeenCalledTimes(1);
  expect(mocks.error).toHaveBeenCalledWith(SIZE_MESSAGE);
  expect(mocks.confirm).not.toHaveBeenCalled();
  expectNoRestoreWork(harness, backup);
}

function expectExistingConfirmation(backup: BackupFixture) {
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  const [options] = mocks.confirm.mock.calls[0];
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

function expectExistingPost(backup: BackupFixture) {
  expectExistingConfirmation(backup);
  expect(backup.read).toHaveBeenCalledTimes(1);
  expect(restorePosts()).toHaveLength(1);
  const [request, options] = restorePosts()[0];
  expect(request).toBe(BACKUP_URL);
  expect(options).toEqual({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(JSON.parse(BACKUP_TEXT)),
  });
  expect(options?.body).not.toBe(BACKUP_TEXT);
  expect(JSON.parse(options?.body as string)).toEqual(JSON.parse(BACKUP_TEXT));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES", "4000000");
  mocks.confirm.mockReset().mockResolvedValue(false);
  logsReply = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  fetchMock.mockReset().mockImplementation(async (request, options) => {
    if (typeof request === "string" && request.startsWith("/api/logs?") && (!options?.method || options.method === "GET")) {
      return jsonResponse(logsReply);
    }
    if (request === BACKUP_URL && options?.method === "POST") {
      return jsonResponse({ error: FAKE_RESTORE_ERROR }, 409);
    }
    throw new Error(`Unexpected fixture request: ${options?.method || "GET"} ${String(request)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("LogsPage backup restore size preflight", () => {
  it("rejects 4,000,001 bytes before confirmation, reading, POST, or observable busy state", async () => {
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES + 1);
    mocks.confirm.mockResolvedValue(true);
    selectBackup(harness, backup);
    const parse = vi.spyOn(JSON, "parse");
    await clickRestore(harness);
    expectSizeRejection(harness, backup);
    expect(parse).not.toHaveBeenCalled();
    expect(screen.getByText("Không có nhật ký phù hợp")).toBeInTheDocument();
  });

  it.each([
    { label: "missing", value: undefined },
    { label: "empty", value: "" },
    { label: "invalid", value: "not-a-number" },
    { label: "negative", value: "-1" },
    { label: "non-finite", value: "Infinity" },
  ])("uses the hosted cap for a $label public setting", async ({ value }) => {
    vi.stubEnv("NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES", value);
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES + 1);
    selectBackup(harness, backup);
    await clickRestore(harness);
    expectSizeRejection(harness, backup);
  });

  it.each([MAX_BYTES - 1, MAX_BYTES])("keeps the existing confirmation and selection when cancelling a %i-byte file", async (size) => {
    const harness = await mountPage();
    const backup = metadataBackup(size);
    selectBackup(harness, backup);
    await clickRestore(harness);
    expectExistingConfirmation(backup);
    expectNoRestoreWork(harness, backup);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([MAX_BYTES - 1, MAX_BYTES])("posts the existing parsed JSON payload after accepting a %i-byte file", async (size) => {
    const harness = await mountPage();
    const backup = metadataBackup(size);
    mocks.confirm.mockResolvedValue(true);
    selectBackup(harness, backup);
    expect(backup.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FAKE_RESTORE_ERROR));
    expectExistingPost(backup);
    expect(harness.restore).toBeEnabled();
    expect(mocks.error).not.toHaveBeenCalledWith(SIZE_MESSAGE);
  });

  it("keeps an over-cap local public-0 file on the confirmed JSON transport with fake HTTP only", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES", "0");
    const harness = await mountPage();
    const backup = metadataBackup(20_000_000, BACKUP_TEXT, "local-backup.json");
    mocks.confirm.mockResolvedValue(true);
    selectBackup(harness, backup);
    expect(restorePosts()).toHaveLength(0);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FAKE_RESTORE_ERROR));
    expectExistingPost(backup);
    expect(mocks.error).not.toHaveBeenCalledWith(SIZE_MESSAGE);
  });

  it("keeps restore disabled without a file and does not start confirmation or transport", async () => {
    const harness = await mountPage();
    expect(harness.restore).toBeDisabled();
    expect(harness.input.files).toHaveLength(0);
    await clickRestore(harness);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.busyHistory).not.toContain(true);
    expect(screen.queryByText(/^Đã chọn:/)).not.toBeInTheDocument();
  });

  it("still requires confirmation for an over-cap local public-0 file and does nothing on cancel", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES", "0");
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES + 1);
    selectBackup(harness, backup);
    await clickRestore(harness);
    expectExistingConfirmation(backup);
    expectNoRestoreWork(harness, backup);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not read, post, or become busy while the existing destructive confirmation is pending", async () => {
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES);
    let finishConfirmation!: (confirmed: boolean) => void;
    mocks.confirm.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      finishConfirmation = resolve;
    }));
    selectBackup(harness, backup);
    await clickRestore(harness);
    expectExistingConfirmation(backup);
    expectNoRestoreWork(harness, backup);
    await act(async () => finishConfirmation(false));
    expectNoRestoreWork(harness, backup);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("keeps the existing invalid-JSON error without POST after confirmation", async () => {
    const harness = await mountPage();
    const backup = metadataBackup(100, "{invalid-json");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.confirm.mockResolvedValue(true);
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FILE_ERROR_MESSAGE));
    expectExistingConfirmation(backup);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Failed to restore backup:", expect.any(SyntaxError));
    expectRetainedSelection(harness, backup);
  });

  it("keeps the existing file-read failure handling without POST after confirmation", async () => {
    const harness = await mountPage();
    const backup = metadataBackup(100);
    const readError = new Error("Fixture file read failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    backup.read.mockRejectedValueOnce(readError);
    mocks.confirm.mockResolvedValue(true);
    selectBackup(harness, backup);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FILE_ERROR_MESSAGE));
    expectExistingConfirmation(backup);
    expect(backup.read).toHaveBeenCalledTimes(1);
    expect(restorePosts()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Failed to restore backup:", readError);
    expectRetainedSelection(harness, backup);
  });

  it("only selects an oversized file in the unchanged picker without validating, confirming, reading, or sending", async () => {
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES + 1);
    expect(harness.input).toHaveAttribute("accept", "application/json,.json");
    selectBackup(harness, backup);
    await act(async () => undefined);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expectNoRestoreWork(harness, backup);
  });

  it("retains an oversized selection after rejection and restores the existing path when a valid file is chosen later", async () => {
    const harness = await mountPage();
    const oversized = metadataBackup(MAX_BYTES + 1, BACKUP_TEXT, "too-large.json");
    const valid = metadataBackup(MAX_BYTES, BACKUP_TEXT, "valid-later.json");
    selectBackup(harness, oversized);
    await clickRestore(harness);
    expectSizeRejection(harness, oversized);
    selectBackup(harness, valid);
    expect(screen.queryByText(`Đã chọn: ${oversized.file.name}`)).not.toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(valid.read).not.toHaveBeenCalled();
    expect(restorePosts()).toHaveLength(0);
    mocks.confirm.mockResolvedValue(true);
    await clickRestore(harness);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FAKE_RESTORE_ERROR));
    expectExistingPost(valid);
    expect(oversized.read).not.toHaveBeenCalled();
    expect(mocks.error.mock.calls.filter(([message]) => message === SIZE_MESSAGE)).toHaveLength(1);
  });

  it("preserves loaded logs and the selected file after rejecting an oversized backup", async () => {
    logsReply = {
      data: [{
        id: "retained-log",
        createdAt: "2026-10-30T08:00:00.000Z",
        details: JSON.stringify({ action: "UPDATE", changes: { phone: { old: "0900000000", new: "0911111111" } } }),
        user: { username: "fixture-admin" },
        customer: { name: "Fixture customer", account: "fixture-account" },
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    const harness = await mountPage();
    const backup = metadataBackup(MAX_BYTES + 1);
    const loadedLog = screen.getByText("Fixture customer");
    selectBackup(harness, backup);
    await clickRestore(harness);
    expectSizeRejection(harness, backup);
    expect(loadedLog).toBeInTheDocument();
    expect(screen.getByText("Fixture customer")).toBe(loadedLog);
    expect(screen.queryByText("Không có nhật ký phù hợp")).not.toBeInTheDocument();
  });
});
