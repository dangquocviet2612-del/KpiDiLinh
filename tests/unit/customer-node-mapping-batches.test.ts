import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as cache from "@/lib/kpi-cache";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  scope: vi.fn(),
  schemaReady: vi.fn(),
  mappingReady: vi.fn(),
  query: vi.fn(),
  findMany: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  customerWrite: vi.fn(),
  nearest: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $queryRawUnsafe: mocks.query,
  $executeRawUnsafe: mocks.execute,
  $transaction: mocks.transaction,
  customer: {
    findMany: mocks.findMany,
    create: mocks.customerWrite,
    update: mocks.customerWrite,
    delete: mocks.customerWrite,
    createMany: mocks.customerWrite,
    updateMany: mocks.customerWrite,
    deleteMany: mocks.customerWrite,
    upsert: mocks.customerWrite,
  },
} }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.scope }));
vi.mock("@/lib/ensure-customer-schema", () => ({ ensureCustomerSchema: mocks.schemaReady }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: mocks.mappingReady }));
vi.mock("@/lib/nodeUtils", () => ({ findNearestNodeName: mocks.nearest }));

import { getMappedNodeNamesByAccounts, normalizeCustomerAccountKey } from "@/lib/customer-node-mapping";
import { toTrimmedString } from "@/lib/import-utils";
import { GET } from "@/app/api/customers/map-data/route";

type MappingRow = { accountKey: string; nodeName: string };
const session = (role = "ADMIN") => ({ user: { id: "fixture-user", name: "fixture-user", role } });
const accountKeys = (count: number) => Array.from({ length: count }, (_, index) => `account-${index}`);
const mappingRows = (keys: string[]): MappingRow[] => keys.map((accountKey) => ({ accountKey, nodeName: `node:${accountKey}` })).reverse();

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function expectReads(keys: string[]) {
  expect(mocks.query).toHaveBeenCalledTimes(Math.ceil(keys.length / 900));
  const queriedKeys: string[] = [];
  for (const [sql, ...params] of mocks.query.mock.calls) {
    expect(params.length).toBeGreaterThan(0);
    expect(params.length).toBeLessThanOrEqual(900);
    expect(sql.match(/\?/g)?.length).toBe(params.length);
    expect(sql).toBe(`SELECT "accountKey", "nodeName" FROM "CustomerNodeMapping" WHERE "accountKey" IN (${params.map(() => "?").join(", ")})`);
    queriedKeys.push(...params);
  }
  expect(queriedKeys).toEqual(keys);
  expect(new Set(queriedKeys).size).toBe(keys.length);
  if (keys.length) {
    expect(mocks.mappingReady).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.mappingReady.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[0]);
  } else {
    expect(mocks.mappingReady).not.toHaveBeenCalled();
  }
}

function request(query = "") {
  return GET(new Request(`http://localhost/api/customers/map-data${query}`));
}

function cacheKey(role = "ADMIN", coordinates = false, details = true, take = 10000, scope = "all") {
  return ["map:data", role, "fixture-user", coordinates ? "1" : "0", details ? "1" : "0", String(take), scope].join("|");
}

const customers = [
  { id: "zeta", account: " ZETA ", nodeName: "stored-zeta", ctvCode: "fixture-a", latitude: 0, longitude: 0 },
  { id: "alpha", account: "ALPHA", nodeName: "stored-alpha", ctvCode: "fixture-a", latitude: 10, longitude: 106 },
  { id: "empty", account: " Empty ", nodeName: "stored-empty", ctvCode: "fixture-b", latitude: null, longitude: null },
  { id: "other", account: "Other", nodeName: null, ctvCode: "fixture-c", latitude: 11, longitude: 107 },
].map((customer) => Object.freeze({
  ...customer,
  name: `Name ${customer.id}`,
  phone: null,
  status: "ACTIVE",
  subscriberType: "fixture-type",
  billingType: "fixture-billing",
  expirationDate: "2026-10-29T00:00:00.000Z",
  address: `Address ${customer.id}`,
  package: "fixture-package",
}));
Object.freeze(customers);
const storedMappings: Record<string, string> = { zeta: "mapped-zeta", empty: "", other: "mapped-other" };
const roleScopes = [
  { role: "ADMIN", codes: null },
  { role: "MANAGER", codes: ["fixture-a", "fixture-b"] },
  { role: "CTV", codes: ["fixture-a"] },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  cache.clearCacheByPrefix("");
  mocks.auth.mockResolvedValue(session());
  mocks.scope.mockResolvedValue(null);
  mocks.schemaReady.mockResolvedValue(undefined);
  mocks.mappingReady.mockResolvedValue(undefined);
  mocks.query.mockImplementation(async (_sql: string, ...keys: string[]) => mappingRows(keys));
  mocks.findMany.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  for (const boundary of [mocks.execute, mocks.transaction, mocks.customerWrite, mocks.nearest]) {
    expect(boundary).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
});

describe("real bulk customer mapping read batches", () => {
  it.each([0, 1, 299, 300, 301, 899, 900, 901, 1800, 1801, 1000, 10000])(
    "%i unique accounts use ceil(unique/900) disjoint parameterized reads",
    async (count) => {
      const keys = accountKeys(count);
      const input = [...keys];
      Object.freeze(input);
      const result = await getMappedNodeNamesByAccounts(input);
      expectReads(keys);
      expect(result.size).toBe(count);
      for (const key of keys) expect(result.get(key)).toBe(`node:${key}`);
      expect(input).toEqual(keys);
      expect(mocks.auth).not.toHaveBeenCalled();
      expect(mocks.schemaReady).not.toHaveBeenCalled();
      expect(mocks.findMany).not.toHaveBeenCalled();
    },
  );

  it("uses real import text normalization without mutation or SQL interpolation", async () => {
    const input: unknown[] = [" ACCount ", "account", " ACCOUNT", 0, " 0 ", null, undefined, "", " \t\n ", " ĐẶNG ", "đặng", " E\u0301 ", "É", " X'); DROP TABLE CustomerNodeMapping; -- ", "x'); drop table customernodemapping; --", ' a"b ', " a?b "];
    Object.freeze(input);
    const original = [...input];
    const keys = ["account", "0", "đặng", "e\u0301", "é", "x'); drop table customernodemapping; --", 'a"b', "a?b"];
    expect(input.map(toTrimmedString)).toEqual(["ACCount", "account", "ACCOUNT", "0", "0", "", "", "", "", "ĐẶNG", "đặng", "E\u0301", "É", "X'); DROP TABLE CustomerNodeMapping; --", "x'); drop table customernodemapping; --", 'a"b', "a?b"]);
    expect(input.map(normalizeCustomerAccountKey)).toEqual(["account", "account", "account", "0", "0", "", "", "", "", "đặng", "đặng", "e\u0301", "é", "x'); drop table customernodemapping; --", "x'); drop table customernodemapping; --", 'a"b', "a?b"]);
    const result = await getMappedNodeNamesByAccounts(input);
    expectReads(keys);
    expect(result.size).toBe(keys.length);
    for (const key of keys) expect(result.get(key)).toBe(`node:${key}`);
    expect(input).toEqual(original);
  });

  it("deduplicates before splitting even when duplicates straddle all batch boundaries", async () => {
    const keys = accountKeys(1000);
    const input = keys.flatMap((key) => [` ${key.toUpperCase()} `, key, null, " "]);
    const original = [...input];
    Object.freeze(input);
    const result = await getMappedNodeNamesByAccounts(input);
    expectReads(keys);
    expect(result.size).toBe(keys.length);
    for (const key of keys) expect(result.get(key)).toBe(`node:${key}`);
    expect(input).toEqual(original);
  });

  it("returns an empty Map for null/undefined/blank elements before readiness", async () => {
    const result = await getMappedNodeNamesByAccounts([null, undefined, "", " \t\n "]);
    expect(result.size).toBe(0);
    expectReads([]);
  });

  it("keeps top-level null outside the array contract without readiness", async () => {
    await expect(getMappedNodeNamesByAccounts(null as unknown as unknown[])).rejects.toBeInstanceOf(TypeError);
    expectReads([]);
  });

  it("preserves empty node values and excludes missing rows by keyed lookup", async () => {
    mocks.query.mockResolvedValueOnce([{ accountKey: "empty", nodeName: "" }, { accountKey: "mapped", nodeName: " Node Value " }]);
    const result = await getMappedNodeNamesByAccounts(["mapped", "missing", "empty"]);
    expectReads(["mapped", "missing", "empty"]);
    expect(result.size).toBe(2);
    expect(result.get("mapped")).toBe(" Node Value ");
    expect(result.has("empty")).toBe(true);
    expect(result.get("empty")).toBe("");
    expect(result.has("missing")).toBe(false);
  });

  it("waits for readiness then each batch with at most one read in flight", async () => {
    const ready = deferred<void>();
    const batches = [deferred<MappingRow[]>(), deferred<MappingRow[]>(), deferred<MappingRow[]>()];
    const keys = accountKeys(1801);
    let active = 0;
    let maxActive = 0;
    mocks.mappingReady.mockReturnValueOnce(ready.promise);
    mocks.query.mockImplementation(async () => {
      const index = mocks.query.mock.calls.length - 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await batches[index].promise;
      } finally {
        active -= 1;
      }
    });
    const pending = getMappedNodeNamesByAccounts(keys);
    expect(mocks.mappingReady).toHaveBeenCalledOnce();
    expect(mocks.query).not.toHaveBeenCalled();
    ready.resolve();
    for (let index = 0; index < batches.length; index += 1) {
      await vi.waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(index + 1));
      expect(active).toBe(1);
      expect(mocks.query.mock.calls[index].slice(1)).toEqual(keys.slice(index * 900, (index + 1) * 900));
      batches[index].resolve(mappingRows(keys.slice(index * 900, (index + 1) * 900)));
    }
    const result = await pending;
    expect(active).toBe(0);
    expect(maxActive).toBe(1);
    expectReads(keys);
    expect(result.size).toBe(keys.length);
    for (const key of keys) expect(result.get(key)).toBe(`node:${key}`);
  });

  it("propagates readiness rejection before any SELECT or result", async () => {
    const failure = new Error("synthetic mapping readiness failed");
    const fulfilled = vi.fn();
    mocks.mappingReady.mockRejectedValueOnce(failure);
    await expect(getMappedNodeNamesByAccounts(accountKeys(1801)).then(fulfilled)).rejects.toBe(failure);
    expect(fulfilled).not.toHaveBeenCalled();
    expect(mocks.mappingReady).toHaveBeenCalledOnce();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("propagates the second batch rejection without partial result or third read", async () => {
    const keys = accountKeys(1801);
    const failure = new Error("synthetic second batch failed");
    const fulfilled = vi.fn();
    mocks.query.mockResolvedValueOnce(mappingRows(keys.slice(0, 900))).mockRejectedValueOnce(failure);
    await expect(getMappedNodeNamesByAccounts(keys).then(fulfilled)).rejects.toBe(failure);
    await Promise.resolve();
    expect(fulfilled).not.toHaveBeenCalled();
    expect(mocks.mappingReady).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual(keys.slice(0, 900));
    expect(mocks.query.mock.calls[1].slice(1)).toEqual(keys.slice(900, 1800));
  });
});

describe("real map-data route, mapping and cache", () => {
  for (const { role, codes } of roleScopes) {
    for (const coordinates of [false, true]) {
      it.each([false, true])(`${role} coordinates=${coordinates} details=%s keeps scoped DTO/order/meta and warm cache`, async (details) => {
        const currentSession = session(role);
        mocks.auth.mockResolvedValue(currentSession);
        mocks.scope.mockResolvedValue(codes);
        const scoped = customers.filter((customer) => (codes === null || codes.includes(customer.ctvCode)) && (!coordinates || customer.latitude !== null && customer.longitude !== null));
        const projected = scoped.map((customer) => details ? customer : {
          id: customer.id, name: customer.name, latitude: customer.latitude, longitude: customer.longitude,
          phone: customer.phone, ctvCode: customer.ctvCode, status: customer.status, subscriberType: customer.subscriberType,
          billingType: customer.billingType, expirationDate: customer.expirationDate,
        });
        mocks.findMany.mockResolvedValueOnce(projected);
        mocks.query.mockImplementation(async (_sql: string, ...keys: string[]) => keys.filter((key) => Object.hasOwn(storedMappings, key)).map((accountKey) => ({ accountKey, nodeName: storedMappings[accountKey] })).reverse());
        const generation = cache.getCacheGeneration();
        vi.spyOn(cache, "setCache");
        const query = `?includeDetails=${details}&hasCoordinates=${coordinates}&take=5`;
        const response = await request(query);
        const payload = {
          success: true,
          data: projected.map((customer) => {
            const mapped = details ? storedMappings[normalizeCustomerAccountKey("account" in customer ? customer.account : null)] : undefined;
            return mapped ? { ...customer, nodeName: mapped } : customer;
          }),
          meta: { count: projected.length, take: 5, includeDetails: details },
        };
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(payload);
        expect(mocks.scope).toHaveBeenCalledExactlyOnceWith(currentSession);
        expect(mocks.schemaReady).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.scope.mock.invocationCallOrder[0]);
        expect(mocks.scope.mock.invocationCallOrder[0]).toBeLessThan(mocks.schemaReady.mock.invocationCallOrder[0]);
        expect(mocks.schemaReady.mock.invocationCallOrder[0]).toBeLessThan(mocks.findMany.mock.invocationCallOrder[0]);
        expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
          where: {
            ...(codes === null ? {} : { ctvCode: { in: codes } }),
            ...(coordinates ? { latitude: { not: null }, longitude: { not: null } } : {}),
          },
          take: 5,
          select: {
            id: true, name: true, latitude: true, longitude: true, phone: true, ctvCode: true,
            status: true, subscriberType: true, billingType: true, expirationDate: true,
            ...(details ? { account: true, nodeName: true, address: true, package: true } : {}),
          },
        });
        expectReads(details ? scoped.map((customer) => normalizeCustomerAccountKey(customer.account)) : []);
        if (details) expect(mocks.findMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.mappingReady.mock.invocationCallOrder[0]);
        const key = cacheKey(role, coordinates, details, 5, codes?.join(",") ?? "all");
        expect(cache.setCache).toHaveBeenCalledExactlyOnceWith(key, payload, 60_000, generation);
        const cached = cache.getCache(key);
        expect(cached).toEqual(payload);
        mocks.schemaReady.mockRejectedValue(new Error("backend must be ignored on warm cache"));
        mocks.mappingReady.mockRejectedValue(new Error("mapping must be ignored on warm cache"));
        mocks.findMany.mockRejectedValue(new Error("customer read must be ignored on warm cache"));
        mocks.query.mockRejectedValue(new Error("SQL must be ignored on warm cache"));
        const warm = await request(query);
        expect(warm.status).toBe(200);
        expect(await warm.json()).toEqual(payload);
        expect(cache.getCache(key)).toBe(cached);
        expect(mocks.auth).toHaveBeenCalledTimes(2);
        expect(mocks.scope).toHaveBeenCalledTimes(2);
        expect(mocks.schemaReady).toHaveBeenCalledOnce();
        expect(mocks.findMany).toHaveBeenCalledOnce();
        expect(mocks.query).toHaveBeenCalledTimes(details ? 1 : 0);
        expect(cache.setCache).toHaveBeenCalledOnce();
      });
    }
  }

  it("batches 901 scoped customer accounts through the real route and helper", async () => {
    const rows = accountKeys(901).map((account, index) => Object.freeze({ ...customers[0], id: `scoped-${index}`, account }));
    Object.freeze(rows);
    mocks.auth.mockResolvedValue(session("CTV"));
    mocks.scope.mockResolvedValue(["fixture-a"]);
    mocks.findMany.mockResolvedValueOnce(rows);
    const response = await request("?includeDetails=true");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true, data: rows.map((customer) => ({ ...customer, nodeName: `node:${customer.account}` })),
      meta: { count: 901, take: 10000, includeDetails: true },
    });
    expectReads(accountKeys(901));
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ ctvCode: { in: ["fixture-a"] } });
    expect(mocks.schemaReady).toHaveBeenCalledOnce();
  });

  it("skips mapping for an empty details-on customer result", async () => {
    expect(await (await request("?includeDetails=true")).json()).toEqual({ success: true, data: [], meta: { count: 0, take: 10000, includeDetails: true } });
    expect(mocks.schemaReady).toHaveBeenCalledOnce();
    expect(mocks.findMany).toHaveBeenCalledOnce();
    expectReads([]);
  });

  it.each([["", 10000], ["?take=not-a-number", 10000], ["?take=-1", 10000], ["?take=0", 10000], ["?take=3.9", 3], ["?take=20001", 20000]] as const)("keeps take normalization for %s", async (query, take) => {
    const response = await request(query);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [], meta: { count: 0, take, includeDetails: false } });
    expect(mocks.findMany.mock.calls[0][0].take).toBe(take);
    expectReads([]);
  });

  it("rejects unauthenticated requests before scope, readiness, SQL or cache lookup even with warm cache", async () => {
    cache.setCache(cacheKey(), { success: true, data: customers }, 60_000);
    vi.spyOn(cache, "getCache");
    vi.spyOn(cache, "setCache");
    mocks.auth.mockResolvedValueOnce(null);
    const response = await request("?includeDetails=true");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    for (const boundary of [mocks.scope, mocks.schemaReady, mocks.mappingReady, mocks.findMany, mocks.query, cache.getCache, cache.setCache]) {
      expect(boundary).not.toHaveBeenCalled();
    }
  });

  it("keeps real cache entries isolated across all three role/scope keys", async () => {
    for (const { role, codes } of roleScopes) {
      mocks.auth.mockResolvedValue(session(role));
      mocks.scope.mockResolvedValue(codes);
      const rows = customers.filter((customer) => codes === null || codes.includes(customer.ctvCode));
      mocks.findMany.mockResolvedValueOnce(rows);
      const response = await request("?includeDetails=true");
      expect(response.status).toBe(200);
      expect((await response.json()).data.map((customer: { id: string }) => customer.id)).toEqual(rows.map((customer) => customer.id));
      expect(cache.getCache(cacheKey(role, false, true, 10000, codes?.join(",") ?? "all"))).not.toBeNull();
    }
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
    expect(mocks.schemaReady).toHaveBeenCalledTimes(3);
    expect(mocks.mappingReady).toHaveBeenCalledTimes(3);
  });

  it.each(["scope", "schema", "mapping", "later-batch"])("does not cache or return partial data after %s failure", async (boundary) => {
    const failure = new Error(`synthetic ${boundary} failure`);
    mocks.findMany.mockResolvedValue(accountKeys(1801).map((account) => ({ ...customers[0], account })));
    if (boundary === "scope") mocks.scope.mockRejectedValueOnce(failure);
    if (boundary === "schema") mocks.schemaReady.mockRejectedValueOnce(failure);
    if (boundary === "mapping") mocks.mappingReady.mockRejectedValueOnce(failure);
    if (boundary === "later-batch") mocks.query.mockResolvedValueOnce(mappingRows(accountKeys(900))).mockRejectedValueOnce(failure);
    vi.spyOn(cache, "setCache");
    const response = await request("?includeDetails=true");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: failure.message });
    expect(cache.setCache).not.toHaveBeenCalled();
    expect(cache.getCache(cacheKey())).toBeNull();
    expect(mocks.schemaReady).toHaveBeenCalledTimes(boundary === "scope" ? 0 : 1);
    expect(mocks.findMany).toHaveBeenCalledTimes(boundary === "scope" || boundary === "schema" ? 0 : 1);
    expect(mocks.mappingReady).toHaveBeenCalledTimes(boundary === "scope" || boundary === "schema" ? 0 : 1);
    expect(mocks.query).toHaveBeenCalledTimes(boundary === "later-batch" ? 2 : 0);
  });

  it("captures the generation before awaiting auth and fences a stale setter", async () => {
    const auth = deferred<ReturnType<typeof session>>();
    const generation = cache.getCacheGeneration();
    mocks.auth.mockReturnValueOnce(auth.promise);
    mocks.findMany.mockResolvedValueOnce([customers[0]]);
    vi.spyOn(cache, "setCache");
    const pending = request("?includeDetails=true");
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.schemaReady).not.toHaveBeenCalled();
    cache.clearCacheByPrefix("map:data");
    auth.resolve(session());
    const response = await pending;
    expect(response.status).toBe(200);
    expect((await response.json()).data[0].nodeName).toBe("node:zeta");
    expect(cache.setCache).toHaveBeenCalledWith(cacheKey(), expect.any(Object), 60_000, generation);
    expect(cache.getCacheGeneration()).not.toBe(generation);
    expect(cache.getCache(cacheKey())).toBeNull();
  });

  it("cannot overwrite a newer cached response after an old mapping read finishes", async () => {
    const oldRead = deferred<MappingRow[]>();
    const originalGeneration = cache.getCacheGeneration();
    mocks.findMany.mockResolvedValueOnce([customers[0]]).mockResolvedValueOnce([customers[1]]);
    mocks.query.mockReturnValueOnce(oldRead.promise);
    const setter = vi.spyOn(cache, "setCache");
    const pending = request("?includeDetails=true");
    await vi.waitFor(() => expect(mocks.query).toHaveBeenCalledOnce());
    cache.clearCacheByPrefix("map:data");
    const generation = cache.getCacheGeneration();
    const fresh = await request("?includeDetails=true");
    expect(fresh.status).toBe(200);
    const payload = await fresh.json();
    const cached = cache.getCache(cacheKey());
    expect(cached).toEqual(payload);
    oldRead.resolve([{ accountKey: "zeta", nodeName: "old-mapped-node" }]);
    const stale = await pending;
    expect(stale.status).toBe(200);
    expect((await stale.json()).data[0].nodeName).toBe("old-mapped-node");
    expect(setter.mock.calls.map((call) => call[3])).toEqual([generation, originalGeneration]);
    expect(cache.getCache(cacheKey())).toBe(cached);
    expect(cache.getCache(cacheKey())).toEqual(payload);
    expect((await (await request("?includeDetails=true")).json())).toEqual(payload);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
