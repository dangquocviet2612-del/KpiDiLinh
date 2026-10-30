import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as cache from "@/lib/kpi-cache";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  nodeWrite: vi.fn(),
  readiness: vi.fn(),
  mappingReady: vi.fn(),
  scope: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $queryRawUnsafe: mocks.query,
  $executeRawUnsafe: mocks.execute,
  $transaction: mocks.transaction,
  node: { create: mocks.nodeWrite, update: mocks.nodeWrite, delete: mocks.nodeWrite },
} }));
vi.mock("@/lib/node-efficiency-db", () => ({ ensureNodeEfficiencyColumns: mocks.readiness }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: mocks.mappingReady }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.scope }));

import { GET } from "@/app/api/nodes/route";

const rows = [
  { id: "zero", name: "Same <node> & \"name\"", latitude: 0, longitude: 0 },
  { id: "second", name: "Same <node> & \"name\"", latitude: 11, longitude: 107 },
  { id: "null", name: "Last", latitude: null, longitude: null },
].map((row) => Object.freeze({
  ...row,
  description: "metadata retained only in legacy cache",
  totalIntPort: 16,
  usedPort: 0,
  portEfficiency: 0,
  dateKd: null,
  efficiencyStatus: "fixture",
  futureSecret: Object.freeze({ nested: "must not leak" }),
}));
Object.freeze(rows);
const coordinates = { data: rows.map((row) => ({
  id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude,
})) };
const key = "nodes:list";
const session = (role = "ADMIN") => ({ user: { id: "fixture-user", name: "fixture", role } });

function request(query = "") {
  return GET(new Request(`http://localhost/api/nodes${query}`));
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function expectListRead() {
  expect(mocks.query).toHaveBeenCalledOnce();
  expect(mocks.query.mock.calls[0]).toHaveLength(1);
  expect(mocks.query.mock.calls[0][0].replace(/\s+/g, " ").trim()).toBe(
    'SELECT id, name, description, latitude, longitude, totalIntPort, usedPort, portEfficiency, dateKd, efficiencyStatus FROM "Node" ORDER BY name ASC',
  );
  expect(mocks.readiness).toHaveBeenCalledExactlyOnceWith();
  expect(mocks.mappingReady).not.toHaveBeenCalled();
  expect(mocks.scope).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  cache.clearCacheByPrefix("");
  mocks.auth.mockResolvedValue(session());
  mocks.query.mockResolvedValue(rows);
  mocks.readiness.mockResolvedValue(undefined);
  mocks.mappingReady.mockResolvedValue(undefined);
  mocks.scope.mockResolvedValue(null);
  vi.spyOn(cache, "getCache");
  vi.spyOn(cache, "getCacheGeneration");
  vi.spyOn(cache, "setCache");
});

afterEach(() => {
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.nodeWrite).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("node coordinates default-list projection", () => {
  it("projects the cold response while caching the full legacy array by identity", async () => {
    const generation = cache.getCacheGeneration();
    const response = await request("?projection=coordinates");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(coordinates);
    expectListRead();
    expect(cache.setCache).toHaveBeenCalledExactlyOnceWith(key, { data: rows }, 60_000, generation);
    expect(cache.getCache<{ data: typeof rows }>(key)?.data).toBe(rows);
  });

  it.each([true, false])("keeps full cache identity for coordinates-first=%s and both repeated hits", async (coordinatesFirst) => {
    const firstQuery = coordinatesFirst ? "?projection=coordinates" : "";
    const secondQuery = coordinatesFirst ? "" : "?projection=coordinates";
    const firstResponse = await request(firstQuery);
    expect(await firstResponse.json()).toEqual(coordinatesFirst ? coordinates : { data: rows });
    const stored = cache.getCache<{ data: typeof rows }>(key)!;
    Object.freeze(stored);
    expect(stored.data).toBe(rows);
    for (const query of [secondQuery, firstQuery, secondQuery]) {
      const response = await request(query);
      expect(await response.json()).toEqual(query ? coordinates : { data: rows });
      expect(cache.getCache(key)).toBe(stored);
      expect(stored.data).toBe(rows);
    }
    expectListRead();
    expect(cache.setCache).toHaveBeenCalledTimes(1);
    expect(mocks.auth).toHaveBeenCalledTimes(4);
  });

  it("uses a pure four-field mapper without mutating frozen legacy/future fields, zero, null, duplicates or order", async () => {
    expect(await (await request("?projection=coordinates")).json()).toEqual(coordinates);
    const { projectNodeCoordinates } = await vi.importActual<typeof import("@/lib/node-coordinates")>("@/lib/node-coordinates");
    const legacy: { data: any[] } = { data: [...rows] };
    Object.freeze(legacy.data);
    Object.freeze(legacy);
    const before = JSON.stringify(legacy);
    const projected = projectNodeCoordinates(legacy);
    expect(projected).toEqual(coordinates);
    expect(projected).not.toBe(legacy);
    expect(projected.data).not.toBe(legacy.data);
    projected.data.forEach((row, index) => {
      expect(Object.keys(row)).toEqual(["id", "name", "latitude", "longitude"]);
      expect(row).not.toBe(legacy.data[index]);
    });
    expect(JSON.stringify(legacy)).toBe(before);
    expect(projectNodeCoordinates({ data: [] })).toEqual({ data: [] });
    const minimal = { data: [{ id: "only", name: "minimal", latitude: 1, longitude: 2 }] };
    expect(projectNodeCoordinates(minimal)).toEqual(minimal);
  });

  it.each(["", "?projection=", "?projection=unknown", "?projection=Coordinates", "?projection=COORDINATES", "?projection=coordinates%20"])(
    "keeps the full legacy response on misses and hits for %s", async (query) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(await (await request(query)).json()).toEqual({ data: rows });
      }
      expectListRead();
      expect(cache.setCache).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["ADMIN", "MANAGER", "CTV"])("authenticates %s before cache/readiness/SQL without changing default-list scope", async (role) => {
    mocks.auth.mockResolvedValue(session(role));
    expect((await request("?projection=coordinates")).status).toBe(200);
    expectListRead();
    expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(cache.getCache).mock.invocationCallOrder[0]);
    expect(vi.mocked(cache.getCacheGeneration).mock.invocationCallOrder[0]).toBeLessThan(mocks.auth.mock.invocationCallOrder[0]);
    expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.readiness.mock.invocationCallOrder[0]);
    expect(mocks.readiness.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[0]);
  });

  it.each(["", "?projection=coordinates"])("rejects unauthenticated cached requests before cache/DB/readiness %s", async (query) => {
    cache.setCache(key, { data: rows }, 60_000);
    vi.mocked(cache.setCache).mockClear();
    mocks.auth.mockResolvedValue(null);
    const response = await request(query);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(cache.getCache).not.toHaveBeenCalled();
    expect(cache.setCache).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
    expect(mocks.mappingReady).not.toHaveBeenCalled();
    expect(mocks.scope).not.toHaveBeenCalled();
  });

  it.each(["auth", "readiness", "query"] as const)("retains %s failure status and never fills a cache", async (boundary) => {
    mocks[boundary].mockRejectedValue(new Error(`fixture ${boundary} failure`));
    const response = await request("?projection=coordinates");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: `fixture ${boundary} failure` });
    expect(cache.setCache).not.toHaveBeenCalled();
    if (boundary !== "query") expect(mocks.query).not.toHaveBeenCalled();
    if (boundary === "auth") {
      expect(cache.getCache).not.toHaveBeenCalled();
      expect(mocks.readiness).not.toHaveBeenCalled();
    }
  });

  it("preserves empty list misses and both-mode hits without extra queries", async () => {
    mocks.query.mockResolvedValue([]);
    for (const query of ["?projection=coordinates", "", "?projection=coordinates"]) {
      expect(await (await request(query)).json()).toEqual({ data: [] });
    }
    expectListRead();
    expect(cache.setCache).toHaveBeenCalledTimes(1);
  });

  it("keeps the 60-second TTL without refreshing it on projection hits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
    await request("?projection=coordinates");
    const stored = cache.getCache(key);
    vi.advanceTimersByTime(59_999);
    await request("");
    expect(cache.getCache(key)).toBe(stored);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(cache.getCache(key)).toBeNull();
    await request("?projection=coordinates");
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("captures generation before pending auth and rejects a stale projected fill", async () => {
    const pending = deferred<ReturnType<typeof session>>();
    const generation = cache.getCacheGeneration();
    mocks.auth.mockReturnValueOnce(pending.promise);
    const response = request("?projection=coordinates");
    expect(mocks.auth).toHaveBeenCalledOnce();
    cache.clearCacheByPrefix("nodes:");
    pending.resolve(session());
    expect(await (await response).json()).toEqual(coordinates);
    expect(cache.setCache).toHaveBeenCalledExactlyOnceWith(key, { data: rows }, 60_000, generation);
    expect(cache.getCache(key)).toBeNull();
  });

  it("does not let an invalidated pending projection overwrite a newer full legacy fill", async () => {
    const pending = deferred<typeof rows>();
    const oldGeneration = cache.getCacheGeneration();
    const newerRows = [{ ...rows[0], description: "newer metadata", name: "newer" }];
    mocks.query.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(newerRows);
    const oldResponse = request("?projection=coordinates");
    await vi.waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    cache.clearCacheByPrefix("nodes:");
    await request();
    const stored = cache.getCache<{ data: typeof newerRows }>(key)!;
    expect(stored.data).toBe(newerRows);
    pending.resolve(rows);
    expect(await (await oldResponse).json()).toEqual(coordinates);
    expect(cache.getCache(key)).toBe(stored);
    expect(cache.setCache).toHaveBeenLastCalledWith(key, { data: rows }, 60_000, oldGeneration);
    expect(await (await request("?projection=coordinates")).json()).toEqual({ data: [{
      id: newerRows[0].id, name: "newer", latitude: 0, longitude: 0,
    }] });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});

describe("projection does not change earlier node modes", () => {
  it.each(["account-node-map", "node-efficiency"])("keeps %s download precedence, binary headers and workbook data", async (template) => {
    const xlsx = await import("xlsx");
    const suffix = `?downloadTemplate=${template}&view=account-node-mappings&page=2&projection=coordinates`;
    const response = await request(suffix);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const filename = template === "account-node-map" ? "mau_node_thue_bao.xlsx" : "mau_hieu_suat_node.xlsx";
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${filename}"`);
    const workbook = xlsx.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    const sheetName = template === "account-node-map" ? "NodeThueBao" : "HieuSuatNode";
    expect(workbook.SheetNames).toEqual([sheetName]);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const legacy = await request(suffix.replace("&projection=coordinates", ""));
    const legacyBook = xlsx.read(Buffer.from(await legacy.arrayBuffer()), { type: "buffer" });
    expect(data).toEqual(xlsx.utils.sheet_to_json(legacyBook.Sheets[sheetName]));
    expect(data).toHaveLength(2);
    expect(Object.keys(data[0] as object)).toEqual(template === "account-node-map"
      ? ["Accout", "Node", "Địa chỉ accout"]
      : ["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY", "DATE_KD", "EFFICIENCY_STATUS"]);
    expect(cache.getCache).not.toHaveBeenCalled();
    expect(cache.setCache).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
    expect(mocks.mappingReady).not.toHaveBeenCalled();
  });

  it.each(["MANAGER", "CTV"])("preserves %s restrictions for both downloads and account mappings", async (role) => {
    mocks.auth.mockResolvedValue(session(role));
    for (const mode of ["downloadTemplate=account-node-map", "downloadTemplate=node-efficiency", "view=account-node-mappings"]) {
      const legacy = await request(`?${mode}`);
      const projected = await request(`?${mode}&projection=coordinates`);
      expect(projected.status).toBe(403);
      expect(await projected.json()).toEqual(await legacy.json());
    }
    expect(cache.getCache).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mappingReady).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
    expect(mocks.scope).not.toHaveBeenCalled();
  });

  it("keeps account mapping search, paging and metadata identical with projection ignored", async () => {
    const items = [{ id: "mapping", account: "acc", nodeName: "Node", accountAddress: "address", createdAt: "date", updatedAt: "date" }];
    mocks.query.mockResolvedValueOnce([{ total: 5 }]).mockResolvedValueOnce(items)
      .mockResolvedValueOnce([{ total: 5 }]).mockResolvedValueOnce(items);
    const query = "?view=account-node-mappings&q=+MiXeD+&page=2&limit=2";
    expect(await (await request(`${query}&projection=coordinates`)).json()).toEqual({ items, total: 5, page: 2, totalPages: 3 });
    expect(await (await request(query)).json()).toEqual({ items, total: 5, page: 2, totalPages: 3 });
    expect(mocks.query.mock.calls.slice(0, 2)).toEqual(mocks.query.mock.calls.slice(2));
    expect(mocks.query.mock.calls[0].slice(1)).toEqual(["%mixed%", "%mixed%", "%mixed%"]);
    expect(mocks.query.mock.calls[1].slice(1)).toEqual(["%mixed%", "%mixed%", "%mixed%", 2, 2]);
    expect(mocks.mappingReady).toHaveBeenCalledTimes(2);
    expect(cache.getCache).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
  });

  it.each([
    { role: "ADMIN", scope: null },
    { role: "MANAGER", scope: ["CTV_A", "CTV_B"] },
    { role: "CTV", scope: ["CTV_A"] },
  ])("keeps $role node-account scope, paging, SQL parameters and response", async ({ role, scope }) => {
    mocks.auth.mockResolvedValue(session(role));
    mocks.scope.mockResolvedValue(scope);
    const items = [{ id: "account", account: "acc", accountAddress: null }];
    mocks.query.mockResolvedValueOnce([{ total: 7 }]).mockResolvedValueOnce(items)
      .mockResolvedValueOnce([{ total: 7 }]).mockResolvedValueOnce(items);
    const query = "?view=node-accounts&nodeName=+Node+&page=3&limit=2";
    const projected = await request(`${query}&projection=coordinates`);
    expect(await projected.json()).toEqual({ items, total: 7, page: 3, totalPages: 4, nodeName: "Node" });
    expect(await (await request(query)).json()).toEqual({ items, total: 7, page: 3, totalPages: 4, nodeName: "Node" });
    expect(mocks.query.mock.calls.slice(0, 2)).toEqual(mocks.query.mock.calls.slice(2));
    const scoped = scope ?? [];
    expect(mocks.query.mock.calls[0].slice(1)).toEqual(["Node", "Node-%", ...scoped, "Node", "Node-%", ...scoped]);
    expect(mocks.query.mock.calls[1].slice(1)).toEqual(["Node", "Node-%", ...scoped, "Node", "Node-%", ...scoped, 2, 4]);
    expect(mocks.query.mock.calls[0][0].includes('c."ctvCode" IN')).toBe(scope !== null);
    expect(mocks.scope).toHaveBeenCalledWith(session(role));
    expect(cache.getCache).not.toHaveBeenCalled();
    expect(cache.setCache).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
  });

  it("keeps node-account missing-name and empty-scope short circuits", async () => {
    const missing = await request("?view=node-accounts&projection=coordinates");
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "Thiếu tên node." });
    mocks.scope.mockResolvedValue([]);
    expect(await (await request("?view=node-accounts&nodeName=Node&page=9&projection=coordinates")).json()).toEqual({
      items: [], total: 0, page: 1, totalPages: 1, nodeName: "Node",
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(cache.getCache).not.toHaveBeenCalled();
  });

  it.each(["account-node-mappings", "node-accounts"])("keeps %s mapping readiness errors", async (view) => {
    mocks.mappingReady.mockRejectedValue(new Error("fixture mapping readiness"));
    const response = await request(`?view=${view}&nodeName=Node&projection=coordinates`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fixture mapping readiness" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(cache.getCache).not.toHaveBeenCalled();
  });
});
