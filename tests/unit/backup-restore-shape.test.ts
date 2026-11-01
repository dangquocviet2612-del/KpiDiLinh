import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    user: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    customer: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    node: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    editHistory: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    customerNote: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  };
  return {
    auth: vi.fn(), transaction,
    database: {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (context: typeof transaction) => Promise<unknown>) => callback(transaction)),
    },
    nodeSchema: vi.fn(), runtimeSchema: vi.fn(), documentSchema: vi.fn(), mappingSchema: vi.fn(), node0Schema: vi.fn(),
    defaults: vi.fn(), cache: vi.fn(), nearestCache: vi.fn(), assetRows: vi.fn(),
  };
});
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.database }));
vi.mock("@/lib/node-efficiency-db", () => ({ ensureNodeEfficiencyColumns: mocks.nodeSchema }));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.runtimeSchema }));
vi.mock("@/lib/official-docs-db", () => ({ ensureOfficialDocTables: mocks.documentSchema }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: mocks.mappingSchema }));
vi.mock("@/lib/node-0tb-db", () => ({ ensureNode0TbTable: mocks.node0Schema }));
vi.mock("@/lib/restore-system-defaults", () => ({ applyRestoreSystemDefaults: mocks.defaults }));
vi.mock("@/lib/cache-tags", () => ({ invalidateCacheForMutation: mocks.cache }));
vi.mock("@/lib/nodeUtils", () => ({ invalidateNearestNodeCache: mocks.nearestCache }));
vi.mock("@/lib/official-doc-assets", () => ({ getOfficialDocumentAssetRowsForBackup: mocks.assetRows }));

import { POST } from "@/app/api/admin/backup/route";

const collections = [
  "users", "customers", "nodes", "editHistory", "customerNotes", "kpiMetricConfigs", "kpiDailyResults",
  "managerKpiDailyResults", "cuocDailyResults", "cuocCdDailyResults", "cuocCdConfigs", "cdtTransactions",
  "cdtOutstandingRecords", "disconnectRecords", "churnRiskRecords", "archiveLogs", "archiveExportLogs",
  "cuocConfigs", "officialDocuments", "officialDocumentAssets", "officialDocumentRevisions", "customerNodeMappings", "node0TbRecords",
] as const;
function legacyData(): Record<string, unknown> {
  return {
    users: [{ id: "fixture-admin", username: "fixture-admin", password: "fixture-hash", role: "ADMIN", canUseGps: false }],
    customers: [], nodes: [], editHistory: [], customerNotes: [],
  };
}
function request(body: unknown) {
  return new Request("http://localhost/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function accessCounts() {
  return {
    reads: mocks.database.user.findMany.mock.calls.length + mocks.database.$queryRawUnsafe.mock.calls.length,
    transactions: mocks.database.$transaction.mock.calls.length,
    coreDeletes: Object.values(mocks.transaction).reduce((count, value) => count + (typeof value === "object" && "deleteMany" in value ? value.deleteMany.mock.calls.length : 0), 0),
    rawWrites: mocks.transaction.$executeRawUnsafe.mock.calls.length,
    schema: [mocks.nodeSchema, mocks.runtimeSchema, mocks.documentSchema, mocks.mappingSchema, mocks.node0Schema].reduce((count, mock) => count + mock.mock.calls.length, 0),
    defaults: mocks.defaults.mock.calls.length, cache: mocks.cache.mock.calls.length + mocks.nearestCache.mock.calls.length,
  };
}
async function expectRejected(body: unknown) {
  const response = await POST(request(body));
  expect({ status: response.status, ...accessCounts() }).toEqual({ status: 400, reads: 0, transactions: 0, coreDeletes: 0, rawWrites: 0, schema: 0, defaults: 0, cache: 0 });
  expect(await response.json()).toEqual({ error: "File backup không hợp lệ" });
  expect(console.error).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "0");
  mocks.auth.mockResolvedValue({ user: { id: "fixture-admin", role: "ADMIN" } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("backup restore rejects malformed shapes before database access", () => {
  for (const key of collections) {
    it.each([null, {}, "not-an-array"])(`rejects non-array collection ${key}: %j`, async (value) => {
      await expectRejected({ data: { ...legacyData(), [key]: value } });
    });
    it.each([null, [], "not-a-record"].map((row) => ({ row })))(`rejects invalid row in ${key}: %j`, async ({ row }) => {
      await expectRejected({ data: { ...legacyData(), [key]: [row] } });
    });
  }
  it.each([false, 42])("rejects boolean/number collection %j", async (value) => {
    await expectRejected({ data: { ...legacyData(), customers: value } });
  });
  it.each([false, 42])("rejects boolean/number row %j", async (row) => {
    await expectRejected({ data: { ...legacyData(), customers: [row] } });
  });
  it.each([null, [], true, false, 42, "invalid-data"].map((data) => ({ data })))("rejects non-object data %j", async ({ data }) => {
    await expectRejected({ data });
  });
  it.each([null, [], true, 42, "invalid-root", {}].map((body) => ({ body })))("rejects invalid top-level payload %j", async ({ body }) => {
    await expectRejected(body);
  });
  it("checks every row, not only the first valid record", async () => {
    await expectRejected({ data: { ...legacyData(), customers: [{ id: "fixture-customer", name: "Fixture", subscriberType: "internet" }, null] } });
  });
});

describe("backup restore preserves existing compatibility and boundaries", () => {
  it.each([null, { user: { role: "CTV" } }, { user: { role: "MANAGER" } }])("authorizes before reading even a malformed body: %j", async (session) => {
    mocks.auth.mockResolvedValue(session);
    const input = request({ data: { ...legacyData(), kpiDailyResults: null } });
    const json = vi.spyOn(input, "json"); const reader = vi.spyOn(input.body!, "getReader");
    expect((await POST(input)).status).toBe(401);
    expect(json).not.toHaveBeenCalled(); expect(reader).not.toHaveBeenCalled();
    expect(accessCounts()).toEqual({ reads: 0, transactions: 0, coreDeletes: 0, rawWrites: 0, schema: 0, defaults: 0, cache: 0 });
  });
  it("restores a legacy payload with optional collections absent", async () => {
    const response = await POST(request({ data: legacyData() }));
    expect(response.status).toBe(200); expect((await response.json()).restored.users).toBe(1);
    expect(mocks.database.$transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.defaults).toHaveBeenCalledOnce(); expect(mocks.cache).toHaveBeenCalledWith("restore");
  });
  it("accepts all23known arrays including explicit empties and preserves optional-table clearing", async () => {
    const data = { ...Object.fromEntries(collections.map((key) => [key, []])), users: legacyData().users };
    const response = await POST(request({ meta: { schemaVersion: 10 }, data }));
    expect(response.status).toBe(200);
    const statements = mocks.transaction.$executeRawUnsafe.mock.calls.map((call) => call[0]);
    expect(statements).toContain('DELETE FROM "KpiDailyResult"'); expect(statements).toContain('DELETE FROM "Node0Tb"');
    expect(statements).toHaveLength(18); expect(mocks.defaults).toHaveBeenCalledOnce();
  });
  it("keeps unknown fields and metadata backward compatible", async () => {
    const response = await POST(request({ meta: { custom: "fixture" }, data: { ...legacyData(), futureField: { arbitrary: null } } }));
    expect(response.status).toBe(200); expect(mocks.database.$transaction).toHaveBeenCalledOnce();
  });
  it.each(["customers", "nodes", "editHistory", "customerNotes"])("keeps existing absent core collection behavior: %s", async (key) => {
    const data = legacyData(); delete data[key];
    expect((await POST(request({ data }))).status).toBe(200);
    expect(mocks.database.$transaction).toHaveBeenCalledOnce();
  });
  it("still rejects empty users through the existing business rule", async () => {
    const response = await POST(request({ data: { ...legacyData(), users: [] } }));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "File backup không có dữ liệu người dùng." });
    expect(mocks.database.$transaction).not.toHaveBeenCalled();
  });
  it("still applies required-field checks to valid object rows", async () => {
    const response = await POST(request({ data: { ...legacyData(), customers: [{}] } }));
    expect(response.status).toBe(400); expect((await response.json()).error).toContain("khách hàng thiếu dữ liệu bắt buộc");
    expect(mocks.database.user.findMany).toHaveBeenCalledOnce(); expect(mocks.database.$transaction).not.toHaveBeenCalled();
  });
  it("keeps valid customer/node/history/note rows on the normal transaction path", async () => {
    const data = {
      ...legacyData(),
      customers: [{ id: "fixture-customer", name: "Fixture", subscriberType: "internet", price: 0 }],
      nodes: [{ id: "fixture-node", name: "Fixture node", latitude: 0, longitude: 0 }],
      editHistory: [{ id: "fixture-history", customerId: "fixture-customer", userId: "fixture-admin", details: "Fixture update" }],
      customerNotes: [{ id: "fixture-note", customerId: "fixture-customer", userId: "fixture-admin", content: "Fixture note" }],
    };
    const response = await POST(request({ data }));
    expect(response.status).toBe(200);
    expect((await response.json()).restored).toMatchObject({ users: 1, customers: 1, nodes: 1, editHistory: 1, customerNotes: 1 });
    expect(mocks.transaction.customer.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ id: "fixture-customer", price: 0 })] });
    expect(mocks.transaction.node.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ latitude: 0, longitude: 0 })] });
    expect(mocks.defaults).toHaveBeenCalledOnce(); expect(mocks.nearestCache).toHaveBeenCalledOnce();
  });
  it("preserves size413 before shape validation", async () => {
    vi.stubEnv("VERCEL", "1");
    const input = request({ data: null }); input.headers.set("Content-Length", "4000001");
    expect((await POST(input)).status).toBe(413);
    expect(accessCounts()).toEqual({ reads: 0, transactions: 0, coreDeletes: 0, rawWrites: 0, schema: 0, defaults: 0, cache: 0 });
  });
});
