// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { ConfirmDialogOptions } from "@/components/ui/ConfirmDialogProvider";
import LogsPage from "@/app/(dashboard)/logs/page";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn<(options: ConfirmDialogOptions) => Promise<boolean>>(),
  error: vi.fn<(message: string) => void>(),
  success: vi.fn<(message: string) => void>(),
  router: { push: vi.fn() },
  session: { user: { id: "download-fixture-admin", role: "ADMIN" } },
}));

vi.mock("react", async (importOriginal) => importOriginal<typeof import("react")>());
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/ui/ConfirmDialogProvider", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.error, success: mocks.success } }));

const BACKUP_URL = "/api/admin/backup";
const DOWNLOAD_LABEL = "Tải backup";
const SUCCESS_MESSAGE = "Đã gửi yêu cầu tải backup. Vui lòng kiểm tra file đã lưu.";
const GENERIC_ERROR = "Có lỗi khi tải backup.";
const HTTP_ERROR = "Không thể tải file backup.";
const NativeURL = globalThis.URL;
const nativeCreateElement = document.createElement.bind(document);
const nativeAppendChild = document.body.appendChild.bind(document.body);
const fetchMock = vi.fn<typeof fetch>();
const downloadReply = vi.fn<() => Promise<Response>>();
const createObjectURL = vi.fn<typeof URL.createObjectURL>();
const revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>();
const createAnchor = vi.fn<() => HTMLAnchorElement>();
const appendAnchor = vi.fn<(anchor: HTMLAnchorElement) => HTMLAnchorElement>();

type LogFixture = {
  id: string;
  createdAt: string;
  details: string;
  user: { username: string };
  customer: { name: string; account: string };
};

type AnchorFixture = {
  anchor: HTMLAnchorElement;
  click: MockInstance<() => void>;
  remove: MockInstance<() => void>;
};

let logsReply: { data: LogFixture[]; total: number; totalPages: number };
let reply: ReturnType<typeof makeDownloadReply>;
let anchors: AnchorFixture[];
let submissions: { href: string; filename: string; connected: boolean }[];
let events: string[];
let urlSequence: number;

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response;
}

function makeDownloadReply({
  ok = true,
  disposition = 'attachment; filename="fixture-export.json"',
  body = null,
}: { ok?: boolean; disposition?: string | null; body?: unknown } = {}) {
  const payload = new Blob(["synthetic opaque download fixture"], { type: "application/octet-stream" });
  const blob = vi.fn<() => Promise<Blob>>().mockResolvedValue(payload);
  const json = vi.fn<() => Promise<unknown>>().mockResolvedValue(body);
  const getHeader = vi.fn<(name: string) => string | null>().mockImplementation((name) => (
    name.toLowerCase() === "content-disposition" ? disposition : null
  ));
  const response = { ok, status: ok ? 200 : 409, blob, json, headers: { get: getHeader } } as unknown as Response;
  return { response, payload, blob, json, getHeader };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeAnchor(): AnchorFixture {
  const anchor = nativeCreateElement("a");
  const nativeRemove = anchor.remove.bind(anchor);
  const click = vi.spyOn(anchor, "click").mockImplementation(() => {
    events.push("click");
    submissions.push({ href: anchor.href, filename: anchor.download, connected: anchor.isConnected });
  });
  const remove = vi.spyOn(anchor, "remove").mockImplementation(() => {
    events.push("remove");
    nativeRemove();
  });
  const fixture = { anchor, click, remove };
  anchors.push(fixture);
  return fixture;
}

function backupRequests() {
  return fetchMock.mock.calls.filter(([request]) => request === BACKUP_URL);
}

function logsRequests() {
  return fetchMock.mock.calls.filter(([request]) => typeof request === "string" && request.startsWith("/api/logs?"));
}

function expectRequests(count: number, logsCount = 1) {
  expect(backupRequests()).toEqual(Array.from({ length: count }, () => [BACKUP_URL]));
  expect(logsRequests()).toHaveLength(logsCount);
  expect(fetchMock).toHaveBeenCalledTimes(count + logsCount);
  expect(fetchMock.mock.calls.every(([, options]) => options === undefined)).toBe(true);
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.router.push).not.toHaveBeenCalled();
}

function expectNoResources() {
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(createAnchor).not.toHaveBeenCalled();
  expect(appendAnchor).not.toHaveBeenCalled();
  expect(revokeObjectURL).not.toHaveBeenCalled();
  expect(anchors).toHaveLength(0);
  expect(submissions).toHaveLength(0);
}

function expectCleanup() {
  expect(anchors).toHaveLength(1);
  expect(anchors[0].remove).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-fixture-1");
}

async function mountPage() {
  const view = render(<LogsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
  expect(fetchMock).toHaveBeenCalledWith("/api/logs?page=1&limit=20");
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Expected the existing LogsPage restore file input");
  return {
    ...view,
    input,
    download: screen.getByRole("button", { name: DOWNLOAD_LABEL }),
    restore: screen.getByRole("button", { name: "Khôi phục dữ liệu" }),
  };
}

type PageHarness = Awaited<ReturnType<typeof mountPage>>;

async function clickDownload(harness: PageHarness, clicks = 1) {
  await act(async () => {
    for (let clickIndex = 0; clickIndex < clicks; clickIndex += 1) {
      fireEvent.click(harness.download);
    }
  });
}

async function expectReleased(harness: PageHarness, count = 1, logsCount = 1) {
  await waitFor(() => expect(harness.download).toBeEnabled());
  await act(async () => undefined);
  expectRequests(count, logsCount);
}

async function expectGenericFailure(harness: PageHarness) {
  await expectReleased(harness);
  expect(mocks.error).toHaveBeenCalledTimes(1);
  expect(mocks.error).toHaveBeenCalledWith(GENERIC_ERROR);
  expect(mocks.success).not.toHaveBeenCalled();
}

async function expectManualRetry(harness: PageHarness, logsCount = 1) {
  const previousRequests = backupRequests().length;
  const previousSuccesses = mocks.success.mock.calls.length;
  const previousErrors = mocks.error.mock.calls.length;
  await expectReleased(harness, previousRequests, logsCount);
  const retry = makeDownloadReply();
  downloadReply.mockResolvedValueOnce(retry.response);
  await clickDownload(harness);
  await expectReleased(harness, previousRequests + 1, logsCount);
  expect(retry.blob).toHaveBeenCalledTimes(1);
  expect(retry.json).not.toHaveBeenCalled();
  expect(mocks.success).toHaveBeenCalledTimes(previousSuccesses + 1);
  expect(mocks.success).toHaveBeenLastCalledWith(SUCCESS_MESSAGE);
  expect(mocks.error).toHaveBeenCalledTimes(previousErrors);
}

beforeEach(() => {
  vi.clearAllMocks();
  events = [];
  anchors = [];
  submissions = [];
  urlSequence = 0;
  logsReply = { data: [], total: 0, totalPages: 1 };
  reply = makeDownloadReply();
  mocks.confirm.mockReset().mockResolvedValue(false);
  mocks.error.mockReset();
  mocks.success.mockReset().mockImplementation(() => { events.push("success"); });
  mocks.router.push.mockReset();
  downloadReply.mockReset().mockResolvedValue(reply.response);
  fetchMock.mockReset().mockImplementation((request, options) => {
    if (options !== undefined) throw new Error("Fixture only permits existing GETs with no options");
    if (typeof request === "string" && request.startsWith("/api/logs?")) {
      return Promise.resolve(jsonResponse(logsReply));
    }
    if (request === BACKUP_URL) return downloadReply();
    throw new Error(`Unexpected fixture request: ${String(request)}`);
  });
  createObjectURL.mockReset().mockImplementation(() => {
    events.push("url");
    urlSequence += 1;
    return `blob:download-fixture-${urlSequence}`;
  });
  revokeObjectURL.mockReset().mockImplementation(() => { events.push("revoke"); });
  createAnchor.mockReset().mockImplementation(() => {
    events.push("create");
    return makeAnchor().anchor;
  });
  appendAnchor.mockReset().mockImplementation((anchor) => {
    events.push("append");
    return nativeAppendChild(anchor);
  });
  class FixtureURL extends NativeURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("URL", FixtureURL);
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
    tagName.toLowerCase() === "a" ? createAnchor() : nativeCreateElement(tagName, options)
  ));
  vi.spyOn(document.body, "appendChild").mockImplementation(<NodeType extends Node>(node: NodeType): NodeType => {
    if (node instanceof HTMLAnchorElement && anchors.some(({ anchor }) => anchor === node)) {
      appendAnchor(node);
      return node;
    }
    return nativeAppendChild(node);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const { anchor } of anchors) anchor.remove();
  vi.unstubAllGlobals();
});

describe("LogsPage backup download feedback", () => {
  it("admits one GET before the first await and holds the lock through deferred fetch and blob", async () => {
    const harness = await mountPage();
    const fetching = deferred<Response>();
    const reading = deferred<Blob>();
    downloadReply.mockReturnValueOnce(fetching.promise);
    reply.blob.mockReturnValueOnce(reading.promise);
    await act(async () => {
      fireEvent.click(harness.download);
      fireEvent.click(harness.download);
      expect(backupRequests()).toHaveLength(1);
    });
    expect(harness.download).toBeDisabled();
    await clickDownload(harness, 2);
    expectRequests(1);
    expect(reply.blob).not.toHaveBeenCalled();
    expectNoResources();
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => fetching.resolve(reply.response));
    expect(reply.blob).toHaveBeenCalledTimes(1);
    expect(harness.download).toBeDisabled();
    await clickDownload(harness, 2);
    expectRequests(1);
    expectNoResources();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    await act(async () => reading.resolve(reply.payload));
    await expectReleased(harness);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    expectCleanup();
    await expectManualRetry(harness);
  });

  it("submits the opaque blob once, then reports only a download request and cleans its resources", async () => {
    const harness = await mountPage();
    await clickDownload(harness);
    await expectReleased(harness);
    expect(reply.blob).toHaveBeenCalledTimes(1);
    expect(reply.json).not.toHaveBeenCalled();
    expect(reply.getHeader).toHaveBeenCalledWith("content-disposition");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(reply.payload);
    expect(appendAnchor).toHaveBeenCalledTimes(1);
    expect(anchors[0].click).toHaveBeenCalledTimes(1);
    expect(submissions).toEqual([{
      href: "blob:download-fixture-1", filename: "fixture-export.json", connected: true,
    }]);
    expect(events.slice(0, 4)).toEqual(["url", "create", "append", "click"]);
    expect(events.indexOf("success")).toBeGreaterThan(events.indexOf("click"));
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    expect(mocks.success).not.toHaveBeenCalledWith("Tải backup thành công.");
    expect(mocks.error).not.toHaveBeenCalled();
    expectCleanup();
    expect(anchors[0].anchor.isConnected).toBe(false);
  });

  it("allows repeated successful downloads only on explicit manual clicks with fresh resources", async () => {
    const harness = await mountPage();
    await clickDownload(harness);
    await expectReleased(harness);
    await expectManualRetry(harness);
    await expectManualRetry(harness);
    expectRequests(3);
    expect(mocks.success).toHaveBeenCalledTimes(3);
    expect(submissions.map(({ href }) => href)).toEqual([
      "blob:download-fixture-1", "blob:download-fixture-2", "blob:download-fixture-3",
    ]);
    expect(anchors).toHaveLength(3);
    for (const fixture of anchors) {
      expect(fixture.click).toHaveBeenCalledTimes(1);
      expect(fixture.remove).toHaveBeenCalledTimes(1);
      expect(fixture.anchor.isConnected).toBe(false);
    }
    expect(revokeObjectURL.mock.calls).toEqual(submissions.map(({ href }) => [href]));
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing header", disposition: null, filename: "backup.json" },
    { label: "unquoted filename", disposition: "attachment; filename=fixture.json", filename: "backup.json" },
    { label: "extended filename only", disposition: "attachment; filename*=UTF-8''fixture.json", filename: "backup.json" },
    { label: "existing greedy quoted regex", disposition: 'attachment; filename="fixture.json"; note="tail"', filename: 'fixture.json"; note="tail' },
  ])("preserves the existing filename regex and fallback for $label", async ({ disposition, filename }) => {
    const harness = await mountPage();
    const response = makeDownloadReply({ disposition });
    downloadReply.mockResolvedValueOnce(response.response);
    await clickDownload(harness);
    await expectReleased(harness);
    expect(response.blob).toHaveBeenCalledTimes(1);
    expect(response.json).not.toHaveBeenCalled();
    expect(submissions[0].filename).toBe(filename);
    expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    expectCleanup();
  });

  it.each(["rejected fetch", "synchronous fetch throw"])("keeps the generic error after %s without resources or automatic retry", async (failure) => {
    const harness = await mountPage();
    const error = new TypeError("Synthetic transport failure");
    if (failure === "rejected fetch") downloadReply.mockRejectedValueOnce(error);
    else downloadReply.mockImplementationOnce(() => { throw error; });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(reply.blob).not.toHaveBeenCalled();
    expectNoResources();
    expect(vi.mocked(console.error).mock.calls.flat()).toContain(error);
    await expectManualRetry(harness);
  });

  it("releases after blob rejection without creating an anchor or object URL", async () => {
    const harness = await mountPage();
    reply.blob.mockRejectedValueOnce(new Error("Synthetic blob failure"));
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(reply.blob).toHaveBeenCalledTimes(1);
    expect(reply.json).not.toHaveBeenCalled();
    expectNoResources();
    await expectManualRetry(harness);
  });

  it("does not revoke an uncreated URL when URL creation throws and permits a manual retry", async () => {
    const harness = await mountPage();
    createObjectURL.mockImplementationOnce(() => { throw new Error("Synthetic URL creation failure"); });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(reply.blob).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createAnchor).not.toHaveBeenCalled();
    expect(appendAnchor).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(submissions).toHaveLength(0);
    await expectManualRetry(harness);
  });

  it("revokes the created URL when anchor creation fails without inventing an anchor", async () => {
    const harness = await mountPage();
    createAnchor.mockImplementationOnce(() => { throw new Error("Synthetic createElement failure"); });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createAnchor).toHaveBeenCalledTimes(1);
    expect(anchors).toHaveLength(0);
    expect(appendAnchor).not.toHaveBeenCalled();
    expect(revokeObjectURL.mock.calls).toEqual([["blob:download-fixture-1"]]);
    expect(submissions).toHaveLength(0);
    await expectManualRetry(harness);
  });

  it("removes the anchor and revokes its URL when appendChild throws after insertion", async () => {
    const harness = await mountPage();
    appendAnchor.mockImplementationOnce((anchor) => {
      nativeAppendChild(anchor);
      throw new Error("Synthetic append failure after insertion");
    });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(anchors[0].click).not.toHaveBeenCalled();
    expectCleanup();
    expect(anchors[0].anchor.isConnected).toBe(false);
    await expectManualRetry(harness);
  });

  it("cleans both resources after anchor.click throws without announcing success", async () => {
    const harness = await mountPage();
    createAnchor.mockImplementationOnce(() => {
      const fixture = makeAnchor();
      fixture.click.mockImplementationOnce(() => { throw new Error("Synthetic click failure"); });
      return fixture.anchor;
    });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(anchors[0].click).toHaveBeenCalledTimes(1);
    expectCleanup();
    expect(anchors[0].anchor.isConnected).toBe(false);
    await expectManualRetry(harness);
  });

  it("still cleans both resources and releases the lock if the success notification throws", async () => {
    const harness = await mountPage();
    mocks.success.mockImplementationOnce(() => { throw new Error("Synthetic success notification failure"); });
    await clickDownload(harness);
    await expectReleased(harness);
    expect(submissions).toHaveLength(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(GENERIC_ERROR);
    expectCleanup();
    expect(anchors[0].anchor.isConnected).toBe(false);
    await expectManualRetry(harness);
  });

  it.each(["anchor.remove", "revokeObjectURL", "both"])("logs %s cleanup failure without denying a submitted click or keeping the lock", async (failure) => {
    const harness = await mountPage();
    const removeError = new Error("Synthetic remove failure");
    const revokeError = new Error("Synthetic revoke failure");
    if (failure !== "revokeObjectURL") {
      createAnchor.mockImplementationOnce(() => {
        const fixture = makeAnchor();
        fixture.remove.mockImplementationOnce(() => { throw removeError; });
        return fixture.anchor;
      });
    }
    if (failure !== "anchor.remove") revokeObjectURL.mockImplementationOnce(() => { throw revokeError; });
    await clickDownload(harness);
    await expectReleased(harness);
    expect(submissions).toHaveLength(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    expect(mocks.error).not.toHaveBeenCalled();
    expectCleanup();
    if (failure !== "revokeObjectURL") expect(vi.mocked(console.error).mock.calls.flat()).toContain(removeError);
    if (failure !== "anchor.remove") expect(vi.mocked(console.error).mock.calls.flat()).toContain(revokeError);
    await expectManualRetry(harness);
  });

  it("independently attempts both cleanups and releases even when append and both cleanups throw", async () => {
    const harness = await mountPage();
    const removeError = new Error("Synthetic failed-download remove failure");
    const revokeError = new Error("Synthetic failed-download revoke failure");
    createAnchor.mockImplementationOnce(() => {
      const fixture = makeAnchor();
      fixture.remove.mockImplementationOnce(() => { throw removeError; });
      return fixture.anchor;
    });
    appendAnchor.mockImplementationOnce(() => { throw new Error("Synthetic append failure"); });
    revokeObjectURL.mockImplementationOnce(() => { throw revokeError; });
    await clickDownload(harness);
    await expectGenericFailure(harness);
    expect(anchors[0].click).not.toHaveBeenCalled();
    expectCleanup();
    expect(vi.mocked(console.error).mock.calls.flat()).toContain(removeError);
    expect(vi.mocked(console.error).mock.calls.flat()).toContain(revokeError);
    await expectManualRetry(harness);
  });

  it.each([
    { label: "nonempty string error", body: { error: "  Synthetic request rejected.  " }, message: "  Synthetic request rejected.  " },
    { label: "empty string error", body: { error: "" }, message: HTTP_ERROR },
    { label: "whitespace string error", body: { error: " \t " }, message: HTTP_ERROR },
    { label: "object error", body: { error: { message: "Not a toast string" } }, message: HTTP_ERROR },
    { label: "null error", body: { error: null }, message: HTTP_ERROR },
    { label: "missing error", body: {}, message: HTTP_ERROR },
    { label: "null response body", body: null, message: HTTP_ERROR },
  ])("uses safe non-ok feedback for a $label without reading a blob or starting a download", async ({ body, message }) => {
    const harness = await mountPage();
    const response = makeDownloadReply({ ok: false, body });
    downloadReply.mockResolvedValueOnce(response.response);
    await clickDownload(harness);
    await expectReleased(harness);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.blob).not.toHaveBeenCalled();
    expect(response.getHeader).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(message);
    expect(mocks.success).not.toHaveBeenCalled();
    expectNoResources();
    await expectManualRetry(harness);
  });

  it("uses the HTTP fallback when a non-ok response JSON cannot be read", async () => {
    const harness = await mountPage();
    const response = makeDownloadReply({ ok: false });
    response.json.mockRejectedValueOnce(new SyntaxError("Synthetic unreadable error body"));
    downloadReply.mockResolvedValueOnce(response.response);
    await clickDownload(harness);
    await expectReleased(harness);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.blob).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(HTTP_ERROR);
    expect(mocks.success).not.toHaveBeenCalled();
    expectNoResources();
    await expectManualRetry(harness);
  });

  it("holds the lock while non-ok error JSON is pending, then permits only a manual retry", async () => {
    const harness = await mountPage();
    const reading = deferred<unknown>();
    const response = makeDownloadReply({ ok: false });
    response.json.mockReturnValueOnce(reading.promise);
    downloadReply.mockResolvedValueOnce(response.response);
    await clickDownload(harness);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(harness.download).toBeDisabled();
    await clickDownload(harness, 2);
    expectRequests(1);
    expect(response.blob).not.toHaveBeenCalled();
    expectNoResources();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => reading.resolve({ error: "Synthetic pending rejection." }));
    await expectReleased(harness);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith("Synthetic pending rejection.");
    await expectManualRetry(harness);
  });

  it.each(["success", "failure"])("retains logs, filters, pagination, selected rows, details and restore file after download %s", async (outcome) => {
    logsReply = {
      data: [{
        id: "download-retained-log",
        createdAt: "2026-10-30T08:00:00.000Z",
        details: JSON.stringify({ action: "UPDATE", changes: { note: { old: "Fixture before", new: "Fixture after" } } }),
        user: { username: "download-fixture-operator" },
        customer: { name: "Synthetic retained customer", account: "retained-fixture-account" },
      }, {
        id: "download-filtered-out-log",
        createdAt: "2026-10-29T08:00:00.000Z",
        details: JSON.stringify({ action: "CREATE" }),
        user: { username: "download-fixture-other" },
        customer: { name: "Synthetic hidden customer", account: "other-fixture-account" },
      }],
      total: 60,
      totalPages: 3,
    };
    const harness = await mountPage();
    const [startDate, endDate] = harness.container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const [actionFilter, limit] = screen.getAllByRole("combobox");
    const search = screen.getByPlaceholderText("Tên khách, account, CTV...");
    await act(async () => {
      fireEvent.change(startDate, { target: { value: "2026-10-01" } });
      fireEvent.change(endDate, { target: { value: "2026-10-30" } });
      fireEvent.change(actionFilter, { target: { value: "UPDATE" } });
      fireEvent.change(search, { target: { value: "retained-fixture-account" } });
      fireEvent.change(limit, { target: { value: "50" } });
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lọc" })).toBeEnabled());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=2&limit=50&startDate=2026-10-01&endDate=2026-10-30");
    fireEvent.click(screen.getByText("Synthetic retained customer"));
    fireEvent.click(screen.getByRole("checkbox"));
    const selectedFile = new File(["synthetic unparsed selection"], "retained-download-selection.json", { type: "application/json" });
    const readFile = vi.fn<() => Promise<string>>().mockResolvedValue("synthetic unparsed selection");
    Object.defineProperty(selectedFile, "text", { configurable: true, value: readFile });
    fireEvent.change(harness.input, { target: { files: [selectedFile] } });
    const initialLogs = logsRequests().length;
    if (outcome === "failure") downloadReply.mockRejectedValueOnce(new Error("Synthetic retained-UI failure"));
    await clickDownload(harness);
    await expectReleased(harness, 1, initialLogs);
    expect(startDate).toHaveValue("2026-10-01");
    expect(endDate).toHaveValue("2026-10-30");
    expect(actionFilter).toHaveValue("UPDATE");
    expect(search).toHaveValue("retained-fixture-account");
    expect(limit).toHaveValue("50");
    expect(screen.getByText("Trang 2/3")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Xóa 1 dòng" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Chi tiết thao tác" })).toBeInTheDocument();
    expect(screen.getByText("Fixture before")).toBeInTheDocument();
    expect(screen.getByText("Fixture after")).toBeInTheDocument();
    expect(screen.queryByText("Synthetic hidden customer")).not.toBeInTheDocument();
    expect(harness.input.files?.[0]).toBe(selectedFile);
    expect(harness.input).toBeEnabled();
    expect(harness.input).toHaveAttribute("accept", "application/json,.json");
    expect(harness.restore).toBeEnabled();
    expect(screen.getByText(`Đã chọn: ${selectedFile.name}`)).toBeInTheDocument();
    expect(readFile).not.toHaveBeenCalled();
    if (outcome === "success") {
      expect(mocks.success).toHaveBeenCalledWith(SUCCESS_MESSAGE);
      expect(mocks.error).not.toHaveBeenCalled();
    } else {
      expect(mocks.error).toHaveBeenCalledWith(GENERIC_ERROR);
      expect(mocks.success).not.toHaveBeenCalled();
    }
    await expectManualRetry(harness, initialLogs);
    expect(harness.input.files?.[0]).toBe(selectedFile);
    expect(readFile).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("Trang 2/3")).toBeInTheDocument();
  });
});
