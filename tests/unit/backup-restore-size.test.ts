import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/backup/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), database: vi.fn(), schema: vi.fn(), defaults: vi.fn(), cache: vi.fn(), nearest: vi.fn(), assets: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $executeRawUnsafe: mocks.database, $queryRawUnsafe: mocks.database, $transaction: mocks.database, user: { findMany: mocks.database, findUnique: mocks.database }, customer: { findMany: mocks.database }, node: { findMany: mocks.database } } }));
vi.mock("@/lib/cache-tags", () => ({ invalidateCacheForMutation: mocks.cache }));
vi.mock("@/lib/node-efficiency-db", () => ({ ensureNodeEfficiencyColumns: mocks.schema }));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.schema }));
vi.mock("@/lib/restore-system-defaults", () => ({ applyRestoreSystemDefaults: mocks.defaults }));
vi.mock("@/lib/nodeUtils", () => ({ invalidateNearestNodeCache: mocks.nearest }));
vi.mock("@/lib/official-docs-db", () => ({ ensureOfficialDocTables: mocks.schema }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: mocks.schema }));
vi.mock("@/lib/node-0tb-db", () => ({ ensureNode0TbTable: mocks.schema }));
vi.mock("@/lib/official-doc-assets", () => ({ getOfficialDocumentAssetRowsForBackup: mocks.assets }));

const cap = 4_000_000;
const sizeMessage = "Khôi phục trên web chỉ nhận file JSON tối đa 4 MB. Không chia nhỏ hoặc sửa file backup; hãy dùng quy trình khôi phục local/offline cho file lớn.";
const emptyUsers = { data: { users: [] } };
const emptyUsersMessage = "File backup không có dữ liệu người dùng.";

function controlledRequest(chunks: Uint8Array[], declaredLength?: string) {
  let index = 0;
  const read = vi.fn(async () => index < chunks.length ? { done: false, value: chunks[index++] } : { done: true, value: undefined });
  const cancel = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const releaseLock = vi.fn();
  const getReader = vi.fn(() => ({ read, cancel, releaseLock }));
  const json = vi.fn().mockResolvedValue(emptyUsers);
  const headers = new Headers(declaredLength === undefined ? {} : { "content-length": declaredLength });
  return { request: { headers, body: { getReader }, json } as unknown as Request, read, cancel, releaseLock, getReader, json };
}

function nativeRequest(text?: string) {
  const request = new Request("http://localhost/api/admin/backup", { method: "POST", body: text });
  const json = vi.spyOn(request, "json");
  return { request, json };
}

function expectNoBusinessAccess() {
  for (const mock of [mocks.database, mocks.schema, mocks.defaults, mocks.cache, mocks.nearest, mocks.assets]) expect(mock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "1");
  mocks.auth.mockResolvedValue({ user: { id: "fixture-admin", role: "ADMIN" } });
  for (const mock of [mocks.database, mocks.schema, mocks.defaults, mocks.cache, mocks.nearest, mocks.assets]) mock.mockImplementation(() => { throw new Error("Unexpected fixture business access"); });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("backup restore hosted body limit before destructive work", () => {
  it("rejects declared oversized length without acquiring or reading the body", async () => {
    const fixture = controlledRequest([new Uint8Array([123, 125])], String(cap + 1));
    const response = await POST(fixture.request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: sizeMessage });
    expect(fixture.getReader).not.toHaveBeenCalled();
    expect(fixture.json).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([undefined, "1", "", "invalid", "-1", "4.5"])("counts real bytes despite absent/underreported/malformed length%s", async (declaredLength) => {
    const fixture = controlledRequest([new Uint8Array(cap + 1)], declaredLength);
    const response = await POST(fixture.request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: sizeMessage });
    expect(fixture.json).not.toHaveBeenCalled();
    expect(fixture.read).toHaveBeenCalledOnce();
    expect(fixture.cancel).toHaveBeenCalledOnce();
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("counts UTF8 bytes rather than JavaScript characters using a native Request", async () => {
    const text = JSON.stringify("é".repeat(2_000_000));
    expect(text.length).toBeLessThan(cap);
    expect(new TextEncoder().encode(text).byteLength).toBeGreaterThan(cap);
    const fixture = nativeRequest(text);
    const response = await POST(fixture.request);
    expect(response.status).toBe(413);
    expect(fixture.json).not.toHaveBeenCalled();
    expect(fixture.request.bodyUsed).toBe(true);
    expectNoBusinessAccess();
  });

  it("stops at the overflow chunk without asking for a trailing chunk", async () => {
    const fixture = controlledRequest([new Uint8Array(cap - 1), new Uint8Array(2), new Uint8Array(100)]);
    expect((await POST(fixture.request)).status).toBe(413);
    expect(fixture.read).toHaveBeenCalledTimes(2);
    expect(fixture.cancel).toHaveBeenCalledOnce();
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("keeps413 and handles a rejected cancellation without unhandled rejection", async () => {
    const fixture = controlledRequest([new Uint8Array(cap + 1)]);
    fixture.cancel.mockRejectedValue(new Error("Fixture cancellation failure"));
    expect((await POST(fixture.request)).status).toBe(413);
    await Promise.resolve();
    expect(fixture.cancel).toHaveBeenCalledOnce();
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("does not await a cancellation that never settles", async () => {
    const fixture = controlledRequest([new Uint8Array(cap + 1)]);
    fixture.cancel.mockImplementation(() => new Promise<void>(() => undefined));
    expect((await POST(fixture.request)).status).toBe(413);
    expect(fixture.cancel).toHaveBeenCalledOnce();
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it.each([cap - 1, cap])("allows native body%s into unchanged semantic validation without calling request.json", async (bytes) => {
    const text = JSON.stringify(emptyUsers).padEnd(bytes, " ");
    const fixture = nativeRequest(text);
    const response = await POST(fixture.request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: emptyUsersMessage });
    expect(fixture.json).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("retains native UTF8/BOM parsing before existing user validation", async () => {
    const fixture = nativeRequest("\uFEFF" + JSON.stringify({ ...emptyUsers, marker: "Việt Nam 😀" }));
    const response = await POST(fixture.request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: emptyUsersMessage });
    expect(fixture.json).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("snapshots Buffer chunks before a source reuses their backing memory", async () => {
    const text = JSON.stringify(emptyUsers);
    const firstChunk = Buffer.from(text.slice(0, 8));
    const secondChunk = Buffer.from(text.slice(8));
    const fixture = controlledRequest([firstChunk, secondChunk]);
    const originalRead = fixture.read.getMockImplementation();
    if (!originalRead) throw new Error("Expected controlled reader implementation");
    let readCount = 0;
    fixture.read.mockImplementation(async () => {
      readCount += 1;
      if (readCount === 2) firstChunk.fill(32);
      return originalRead();
    });
    const response = await POST(fixture.request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: emptyUsersMessage });
    expect(firstChunk.toString()).toBe(" ".repeat(8));
    expect(fixture.json).not.toHaveBeenCalled();
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it.each([undefined, "", "{broken"])("preserves generic500 for missing/malformed JSON%s", async (text) => {
    const fixture = nativeRequest(text);
    const response = await POST(fixture.request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Lỗi máy chủ nội bộ" });
    expectNoBusinessAccess();
  });

  it("releases the reader on read failure and preserves generic500", async () => {
    const fixture = controlledRequest([]);
    fixture.read.mockRejectedValue(new Error("Fixture read failure"));
    fixture.json.mockRejectedValue(new Error("Fixture read failure"));
    const response = await POST(fixture.request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Lỗi máy chủ nội bộ" });
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it.each([null, "MANAGER", "CTV"])("keeps nonADMIN%s401 before header/body access", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    const fixture = controlledRequest([new Uint8Array(cap + 1)], String(cap + 1));
    const headerRead = vi.spyOn(fixture.request.headers, "get");
    expect((await POST(fixture.request)).status).toBe(401);
    expect(headerRead).not.toHaveBeenCalled();
    expect(fixture.getReader).not.toHaveBeenCalled();
    expect(fixture.json).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([undefined, "0", "true"])("preserves old local request.json path for flag%s", async (flag) => {
    vi.stubEnv("VERCEL", flag);
    const fixture = controlledRequest([new Uint8Array(cap + 1)], String(cap + 1));
    const headerRead = vi.spyOn(fixture.request.headers, "get");
    const response = await POST(fixture.request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: emptyUsersMessage });
    expect(fixture.json).toHaveBeenCalledOnce();
    expect(fixture.getReader).not.toHaveBeenCalled();
    expect(headerRead).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("ignores a client public0 when hosted runtime enforcement is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES", "0");
    const fixture = controlledRequest([new Uint8Array(cap + 1)]);
    expect((await POST(fixture.request)).status).toBe(413);
    expect(fixture.json).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("retains a larger native JSON body on the unchanged local path", async () => {
    vi.stubEnv("VERCEL", undefined);
    const fixture = nativeRequest(JSON.stringify(emptyUsers).padEnd(cap + 1, " "));
    const response = await POST(fixture.request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: emptyUsersMessage });
    expect(fixture.json).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("retains null-payload400 rather than entering restore work", async () => {
    const response = await POST(nativeRequest("null").request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "File backup không hợp lệ" });
    expectNoBusinessAccess();
  });
});
