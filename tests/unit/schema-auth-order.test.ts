import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ensureRuntimeSchema: vi.fn(),
  ensureKpiTables: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
  customer: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  editHistoryCreate: vi.fn(),
  recordAuditLog: vi.fn(),
  getAccessibleCtvCodes: vi.fn(),
  canAccessCustomerByCtvCode: vi.fn(),
  findNearestNodeName: vi.fn(),
  getMappedNodeNameForAccount: vi.fn(),
  getMappedNodeNamesByAccounts: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCacheByPrefix: vi.fn(),
  parseGbocWorkbook: vi.fn(),
  assertArchiveMonthWritable: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.ensureRuntimeSchema }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: mocks.execute,
    $queryRawUnsafe: mocks.query,
    $transaction: mocks.transaction,
    customer: mocks.customer,
    user: mocks.user,
    editHistory: { create: mocks.editHistoryCreate },
  },
}));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensureKpiTables }));
vi.mock("@/lib/audit", () => ({ recordAuditLog: mocks.recordAuditLog }));
vi.mock("@/lib/scope", () => ({
  getAccessibleCtvCodes: mocks.getAccessibleCtvCodes,
  canAccessCustomerByCtvCode: mocks.canAccessCustomerByCtvCode,
}));
vi.mock("@/lib/nodeUtils", () => ({ findNearestNodeName: mocks.findNearestNodeName }));
vi.mock("@/lib/customer-node-mapping", () => ({
  getMappedNodeNameForAccount: mocks.getMappedNodeNameForAccount,
  getMappedNodeNamesByAccounts: mocks.getMappedNodeNamesByAccounts,
  normalizeCustomerAccountKey: (account: unknown) => String(account || "").trim().toLowerCase(),
}));
vi.mock("@/lib/kpi-cache", () => ({
  getCache: mocks.getCache,
  setCache: mocks.setCache,
  clearCacheByPrefix: mocks.clearCacheByPrefix,
}));
vi.mock("@/lib/kpi", () => ({ parseGbocWorkbook: mocks.parseGbocWorkbook }));
vi.mock("@/lib/archive", () => ({ assertArchiveMonthWritable: mocks.assertArchiveMonthWritable }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
type RouteCase = {
  path: string;
  method: Method;
  domain?: "users" | "customer";
  load: () => Promise<Partial<Record<Method, Handler>>>;
};

const routes: RouteCase[] = [
  { path: "users", method: "GET", domain: "users", load: () => import("@/app/api/users/route") },
  { path: "users", method: "POST", domain: "users", load: () => import("@/app/api/users/route") },
  { path: "users/fixture-id", method: "PUT", domain: "users", load: () => import("@/app/api/users/[id]/route") },
  { path: "users/fixture-id", method: "DELETE", load: () => import("@/app/api/users/[id]/route") },
  { path: "kpi/import", method: "POST", domain: "users", load: () => import("@/app/api/kpi/import/route") },
  { path: "customers", method: "GET", domain: "customer", load: () => import("@/app/api/customers/route") },
  { path: "customers", method: "POST", domain: "customer", load: () => import("@/app/api/customers/route") },
  { path: "customers/fixture-id", method: "GET", domain: "customer", load: () => import("@/app/api/customers/[id]/route") },
  { path: "customers/fixture-id", method: "PUT", domain: "customer", load: () => import("@/app/api/customers/[id]/route") },
  { path: "customers/fixture-id", method: "DELETE", load: () => import("@/app/api/customers/[id]/route") },
  { path: "customers/map-data", method: "GET", domain: "customer", load: () => import("@/app/api/customers/map-data/route") },
  { path: "customers/search-map", method: "GET", domain: "customer", load: () => import("@/app/api/customers/search-map/route") },
];

const admin = { user: { id: "fixture-admin", name: "fixture-admin", role: "ADMIN" } };
const customer = { id: "fixture-id", name: "Fixture Customer", account: null, ctvCode: "fixture-ctv", latitude: null, longitude: null };
const user = { id: "fixture-id", username: "fixture-user", role: "CTV" };

function requestFor(route: RouteCase, body: object = {}) {
  if (route.path === "kpi/import") {
    const form = new FormData();
    form.set("file", new File(["fixture-workbook"], "fixture.xlsx"));
    return new Request(`http://localhost/api/${route.path}`, { method: route.method, body: form });
  }
  return new Request(`http://localhost/api/${route.path}?q=fixture`, {
    method: route.method,
    ...(["POST", "PUT"].includes(route.method) ? {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : {}),
  });
}

async function invoke(route: RouteCase, request = requestFor(route)) {
  const routeModule = await route.load();
  const handler = routeModule[route.method];
  expect(handler).toBeTypeOf("function");
  return handler!(request, { params: Promise.resolve({ id: "fixture-id" }) });
}

function expectNoWrites() {
  for (const mutation of [
    mocks.execute, mocks.transaction, mocks.customer.create, mocks.customer.update, mocks.customer.delete,
    mocks.user.create, mocks.user.update, mocks.user.delete, mocks.editHistoryCreate, mocks.recordAuditLog,
  ]) {
    expect(mutation).not.toHaveBeenCalled();
  }
}

function expectNoDatabaseAccess() {
  expectNoWrites();
  for (const query of [
    mocks.query, mocks.customer.findMany, mocks.customer.findFirst, mocks.customer.findUnique,
    mocks.customer.count, mocks.user.findMany, mocks.user.findUnique,
    mocks.getAccessibleCtvCodes, mocks.canAccessCustomerByCtvCode,
    mocks.getMappedNodeNameForAccount, mocks.getMappedNodeNamesByAccounts, mocks.findNearestNodeName,
  ]) {
    expect(query).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.auth.mockResolvedValue(null);
  mocks.ensureRuntimeSchema.mockResolvedValue(undefined);
  mocks.ensureKpiTables.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue(0);
  mocks.query.mockResolvedValue([]);
  mocks.transaction.mockResolvedValue(undefined);
  mocks.customer.findMany.mockResolvedValue([]);
  mocks.customer.findFirst.mockResolvedValue(null);
  mocks.customer.findUnique.mockResolvedValue(customer);
  mocks.customer.create.mockResolvedValue(customer);
  mocks.customer.update.mockResolvedValue(customer);
  mocks.user.findMany.mockResolvedValue([{ username: "fixture-ctv", secondaryCode: "fixture-secondary" }]);
  mocks.user.findUnique.mockResolvedValue(null);
  mocks.user.create.mockResolvedValue(user);
  mocks.user.update.mockResolvedValue(user);
  mocks.getAccessibleCtvCodes.mockResolvedValue(null);
  mocks.canAccessCustomerByCtvCode.mockResolvedValue(true);
  mocks.getMappedNodeNamesByAccounts.mockResolvedValue(new Map());
  mocks.getMappedNodeNameForAccount.mockResolvedValue(null);
  mocks.parseGbocWorkbook.mockReturnValue([{ ctvUser: "fixture-secondary", reportDate: "2026-08-31", kpiCode: "fixture-kpi", kpiName: "Fixture KPI" }]);
  mocks.hash.mockResolvedValue("fixture-hash");
});

afterEach(() => vi.restoreAllMocks());

describe("schema guards run only after authentication", () => {
  it.each(routes)("$method $path returns 401 without schema or database access", async (route) => {
    const request = requestFor(route);
    const json = vi.spyOn(request, "json");
    const formData = vi.spyOn(request, "formData");
    const response = await invoke(route, request);
    expect(response.status).toBe(401);
    expectNoDatabaseAccess();
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(formData).not.toHaveBeenCalled();
  });

  const adminOnly = routes.filter((route) => route.path.startsWith("users") && route.method !== "GET" || route.path === "kpi/import" || route.method === "DELETE");
  for (const role of ["CTV", "MANAGER"]) {
    it.each(adminOnly)(`$method $path denies ${role} before schema or database access`, async (route) => {
      mocks.auth.mockResolvedValue({ user: { id: "fixture-denied", name: "fixture-denied", role } });
      const response = await invoke(route);
      expect(response.status).toBe(route.path === "kpi/import" ? 401 : 403);
      expectNoDatabaseAccess();
      expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
      expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    });
  }
});

describe("invalid writes validate before readiness or database access", () => {
  const writes = routes.filter((route) => ["POST", "PUT"].includes(route.method) && route.path !== "kpi/import");
  it.each(writes)("$method $path returns 422 without touching the database", async (route) => {
    mocks.auth.mockResolvedValue(admin);
    const response = await invoke(route, requestFor(route, { name: "", username: "!" }));
    expect(response.status).toBe(422);
    expectNoDatabaseAccess();
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
  });

  it("KPI import rejects a missing file before either schema guard", async () => {
    mocks.auth.mockResolvedValue(admin);
    const route = routes.find((entry) => entry.path === "kpi/import")!;
    const response = await invoke(route, new Request("http://localhost/api/kpi/import", { method: "POST", body: new FormData() }));
    expect(response.status).toBe(400);
    expectNoDatabaseAccess();
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
  });

  it("KPI import rejects an empty workbook before either schema guard", async () => {
    mocks.auth.mockResolvedValue(admin);
    mocks.parseGbocWorkbook.mockReturnValue([]);
    const response = await invoke(routes.find((entry) => entry.path === "kpi/import")!);
    expect(response.status).toBe(400);
    expectNoDatabaseAccess();
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
  });
});

describe("customer permission checks precede readiness", () => {
  it.each(routes.filter((route) => route.path === "customers/fixture-id" && route.method !== "DELETE"))("$method rejects an inaccessible customer before the schema guard", async (route) => {
    mocks.auth.mockResolvedValue(admin);
    mocks.canAccessCustomerByCtvCode.mockResolvedValue(false);
    const response = await invoke(route, requestFor(route, { name: "Fixture Customer" }));
    expect(response.status).toBe(403);
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it.each(routes.filter((route) => ["POST", "PUT"].includes(route.method) && route.path.startsWith("customers")))("$method rejects an out-of-scope reassignment before readiness", async (route) => {
    mocks.auth.mockResolvedValue({ user: { id: "fixture-manager", name: "fixture-manager", role: "MANAGER" } });
    mocks.getAccessibleCtvCodes.mockResolvedValue(["fixture-ctv"]);
    const response = await invoke(route, requestFor(route, { name: "Fixture Customer", ctvCode: "another-ctv" }));
    expect(response.status).toBe(403);
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("customer PUT rejects denied GPS permission before readiness", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "fixture-ctv", name: "fixture-ctv", role: "CTV" } });
    mocks.user.findUnique.mockResolvedValue({ canUseGps: false });
    const route = routes.find((entry) => entry.path === "customers/fixture-id" && entry.method === "PUT")!;
    const response = await invoke(route, requestFor(route, { latitude: 10, longitude: 106 }));
    expect(response.status).toBe(403);
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expectNoWrites();
  });
});

describe("authorized requests delegate to read-only readiness", () => {
  it.each(routes.filter((route) => route.domain))("$method $path checks its schema domain without DDL", async (route) => {
    mocks.auth.mockResolvedValue(admin);
    const response = await invoke(route, requestFor(route, { name: "Fixture Customer", username: "fixture-user", password: "fixture-password", role: "CTV" }));
    expect(response.status).toBe(route.method === "POST" && route.path !== "kpi/import" ? 201 : 200);
    expect(mocks.ensureRuntimeSchema).toHaveBeenCalledWith(route.domain);
    expect(mocks.execute).not.toHaveBeenCalled();
    if (route.path === "kpi/import") expect(mocks.ensureKpiTables).toHaveBeenCalledOnce();
  });

  it.each(routes.filter((route) => route.domain))("$method $path fails closed when readiness fails", async (route) => {
    mocks.auth.mockResolvedValue(admin);
    mocks.ensureRuntimeSchema.mockRejectedValue(new Error("fixture migration required"));
    const response = await invoke(route, requestFor(route, { name: "Fixture Customer", username: "fixture-user", password: "fixture-password", role: "CTV" }));
    expect(response.status).toBe(500);
    expect(mocks.ensureRuntimeSchema).toHaveBeenCalledWith(route.domain);
    expectNoWrites();
  });
});

const helpers = [
  { domain: "customer", load: async () => (await import("@/lib/ensure-customer-schema")).ensureCustomerSchema },
  { domain: "mapping", load: async () => (await import("@/lib/customer-node-mapping-db")).ensureCustomerNodeMappingTable },
  { domain: "node", load: async () => (await import("@/lib/node-efficiency-db")).ensureNodeEfficiencyColumns },
  { domain: "documents", load: async () => (await import("@/lib/official-docs-db")).ensureOfficialDocTables },
];

describe("legacy schema helper delegation", () => {
  it.each(helpers)("$domain forwards every call to shared readiness without SQL", async ({ domain, load }) => {
    const ensure = await load();
    await ensure();
    await ensure();
    expect(mocks.ensureRuntimeSchema.mock.calls).toEqual([[domain], [domain]]);
    expectNoDatabaseAccess();
  });

  it.each(helpers)("$domain propagates readiness errors instead of swallowing them", async ({ domain, load }) => {
    const failure = new Error("fixture migration required");
    mocks.ensureRuntimeSchema.mockRejectedValue(failure);
    const ensure = await load();
    await expect(ensure()).rejects.toBe(failure);
    expect(mocks.ensureRuntimeSchema).toHaveBeenCalledWith(domain);
    expectNoDatabaseAccess();
  });
});
