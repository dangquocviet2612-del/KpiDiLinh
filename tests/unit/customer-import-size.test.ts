import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/import/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), rows: vi.fn(), users: vi.fn(), customers: vi.fn(), nodes: vi.fn(), scope: vi.fn(), mapping: vi.fn(), transaction: vi.fn(), createMany: vi.fn(), update: vi.fn(), clearCache: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("xlsx", () => ({ read: mocks.read, utils: { sheet_to_json: mocks.rows } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.users }, customer: { findMany: mocks.customers }, node: { findMany: mocks.nodes }, $transaction: mocks.transaction } }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.scope }));
vi.mock("@/lib/kpi-cache", () => ({ clearCacheByPrefix: mocks.clearCache }));
vi.mock("@/lib/customer-node-mapping", () => ({ getMappedNodeNamesByAccounts: mocks.mapping, normalizeCustomerAccountKey: (value: unknown) => String(value ?? "").trim().toLowerCase() }));

const cap = 4_000_000;
const sizeMessage = "File Excel tối đa 4 MB cho mỗi lần import trên web. Hãy chia nhỏ file rồi thử lại.";

function fixtureFile(size: number) {
  const file = new File(["fixture"], "customers.xlsx");
  Object.defineProperty(file, "size", { value: size });
  const read = vi.spyOn(file, "arrayBuffer").mockResolvedValue(new Uint8Array([1, 2]).buffer);
  return { file, read };
}

function requestFor(file: File | string | null) {
  const formData = vi.fn().mockResolvedValue({ get: () => file });
  return { request: { formData } as unknown as Request, formData };
}

function expectNoBusinessAccess() {
  for (const mock of [mocks.users, mocks.customers, mocks.nodes, mocks.scope, mocks.mapping, mocks.transaction, mocks.createMany, mocks.update, mocks.clearCache]) expect(mock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "1");
  mocks.auth.mockResolvedValue({ user: { id: "fixture-admin", name: "fixture-admin", role: "ADMIN" } });
  mocks.read.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
  mocks.rows.mockReturnValue([]);
  mocks.users.mockResolvedValue([{ username: "fixture-ctv" }]);
  mocks.customers.mockResolvedValue([]);
  mocks.nodes.mockResolvedValue([]);
  mocks.scope.mockResolvedValue(null);
  mocks.mapping.mockResolvedValue(new Map());
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (operation: (transaction: { customer: { createMany: typeof mocks.createMany; update: typeof mocks.update } }) => Promise<void>) => operation({ customer: { createMany: mocks.createMany, update: mocks.update } }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("customer import hosted file-size gate", () => {
  it.each(["ADMIN", "MANAGER", "CTV"])("rejects oversized metadata for %s before reading file or touching business services", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "fixture-user", role, name: "fixture-ctv" } });
    const { file, read } = fixtureFile(cap + 1);
    const { request } = requestFor(file);
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: sizeMessage });
    expect(read).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([cap - 1, cap])("passes filesize%s to the unchanged workbook parser", async (size) => {
    const { file, read } = fixtureFile(size);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "File rỗng hoặc không hợp lệ" });
    expect(read).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledWith(expect.any(Buffer), { type: "buffer", dense: true });
    expectNoBusinessAccess();
  });

  it.each([undefined, "0", "true"])("keeps existing local/non-Vercel behavior for flag%s", async (flag) => {
    vi.stubEnv("VERCEL", flag);
    const { file, read } = fixtureFile(cap + 1);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(read).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("does not trust a client cap0 to bypass hosted validation", async () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES", "0");
    const { file, read } = fixtureFile(cap + 1);
    expect((await POST(requestFor(file).request)).status).toBe(413);
    expect(read).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("keeps auth rejection before reading multipart or filesize", async () => {
    mocks.auth.mockResolvedValue(null);
    const { file, read } = fixtureFile(cap + 1);
    const { request, formData } = requestFor(file);
    expect((await POST(request)).status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([null, "not a File"])("preserves missing/wrong file validation for%s", async (file) => {
    expect((await POST(requestFor(file).request)).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each(["1", undefined])("keeps a normal successful import on platform%s", async (flag) => {
    vi.stubEnv("VERCEL", flag);
    mocks.rows.mockReturnValue([{ Account: "fixture-account", "Tên khách hàng": "Fixture Customer", "Mã CTV": "fixture-ctv" }]);
    const { file } = fixtureFile(100);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Import hoàn tất.", added: 1, updated: 0 });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ account: "fixture-account", name: "Fixture Customer", ctvCode: "fixture-ctv" })] });
    expect(mocks.clearCache.mock.calls.map(([prefix]) => prefix)).toEqual(["customers:list", "customers:search-map", "map:data", "map:detail"]);
  });

  it("leaves multipart headroom for the current one-file request at the cap", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(cap)], "khach-hang.xlsx"));
    const request = new Request("http://localhost/api/import", { method: "POST", body: form });
    const bytes = (await request.arrayBuffer()).byteLength;
    expect(bytes).toBeGreaterThan(cap);
    expect(bytes).toBeLessThan(4_500_000);
  });
});
