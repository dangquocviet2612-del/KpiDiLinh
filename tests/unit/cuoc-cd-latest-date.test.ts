import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Session = { user: { role: string; name: string } };
const mocks = vi.hoisted(() => ({ auth: vi.fn(), ensure: vi.fn(), scope: vi.fn(), raw: vi.fn(), execute: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensure }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.scope }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: mocks.raw, $executeRawUnsafe: mocks.execute } }));

type FixtureRow = { id: number; reportDate: string; ctvUser: string; employeeCodeRaw: string; managerCodeRaw: string; dauKy: number; luyKe: number };
const fixture: FixtureRow[] = [
  { id: 1, reportDate: "2026-10-29", ctvUser: "CTV_A", employeeCodeRaw: "NV-A", managerCodeRaw: "MGR-A", dauKy: 100.5, luyKe: 50.13 },
  { id: 2, reportDate: "2026-10-29", ctvUser: "ctv_b", employeeCodeRaw: "nv-b", managerCodeRaw: "MANAGER_A", dauKy: 200, luyKe: 205 },
  { id: 3, reportDate: "2026-10-29", ctvUser: "CTV_C", employeeCodeRaw: "NV-C", managerCodeRaw: "OTHER", dauKy: 0, luyKe: 0 },
  { id: 4, reportDate: "2026-10-29", ctvUser: "unregistered", employeeCodeRaw: "unknown", managerCodeRaw: "MANAGER_A", dauKy: 10000, luyKe: 2 },
  { id: 5, reportDate: "2026-10-29", ctvUser: " CTV_A ", employeeCodeRaw: "UNMAPPED", managerCodeRaw: "OTHER", dauKy: 2.01, luyKe: 2 },
  { id: 6, reportDate: "2026-10-29", ctvUser: "unmapped", employeeCodeRaw: "NV-A", managerCodeRaw: "", dauKy: 1.001, luyKe: 0.996 },
  { id: 7, reportDate: "2026-10-27", ctvUser: "CTV_A", employeeCodeRaw: "NV-A", managerCodeRaw: "MANAGER_A", dauKy: 1.3, luyKe: 0.3 },
];
const users = [{ username: "CTV_A", secondaryCode: "NV-A" }, { username: "CTV_B", secondaryCode: "NV-B" }, { username: "CTV_C", secondaryCode: "NV-C" }, { username: "MANAGER_A", secondaryCode: "MGR-A" }];
const metadataKey = "cuoc-cd:report:latest-date";
const prefix = "cuoc-cd:report";
const origin = Date.parse("2026-10-29T00:00:00Z");
let db: DatabaseSync;
let route: typeof import("@/app/api/cuoc-cd/report/route");
let cache: typeof import("@/lib/kpi-cache");
let session: Session | null;
let queries: Array<{ sql: string; params: SQLInputValue[] }>;
let extraRows: FixtureRow[];

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function setSessionRole(role: string) {
  session = { user: { role, name: role === "CTV" ? "CTV_A" : role === "MANAGER" ? "MANAGER_A" : "ADMIN_SYNTHETIC" } };
}

function request(reportDate?: string) {
  return new Request(`https://synthetic.invalid/api/cuoc-cd/report?${new URLSearchParams(reportDate === undefined ? {} : { reportDate })}`);
}

function readSql(sql: string, ...params: SQLInputValue[]) {
  queries.push({ sql, params });
  return db.prepare(sql).all(...params);
}

function latestReads() { return queries.filter((query) => query.sql.includes('SELECT DISTINCT "reportDate"')).length; }

function insertRow(record: FixtureRow) {
  db.prepare("INSERT INTO CuocCdDailyResult VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(record.id, record.reportDate, record.ctvUser, record.employeeCodeRaw, record.managerCodeRaw, record.dauKy, record.luyKe, 777, 888);
}

function addLatest() {
  const record = { ...fixture[0], id: 100, reportDate: "2026-10-30", dauKy: 7, luyKe: 3 };
  extraRows.push(record); insertRow(record);
}

function expected(role: string, date = "2026-10-29", targetRatePercent = 99.5, secondary = true, allowedCodes = ["CTV_A", "NV-A"]) {
  const known = new Set(users.flatMap((user) => secondary ? [user.username, user.secondaryCode] : [user.username]).map((value) => value.toLowerCase()));
  const allowed = new Set([...allowedCodes.map((value) => value.toLowerCase()), "manager_a"]);
  const rows = [...fixture, ...extraRows].filter((record) => {
    if (record.reportDate !== date) return false;
    if (!known.has(record.ctvUser.trim().toLowerCase()) && !known.has(record.employeeCodeRaw.trim().toLowerCase())) return false;
    if (role === "MANAGER") return allowed.has(record.ctvUser.toLowerCase()) || allowed.has(record.employeeCodeRaw.toLowerCase()) || record.managerCodeRaw.toLowerCase() === "manager_a";
    if (role === "CTV") return record.ctvUser.toLowerCase() === "ctv_a" || record.employeeCodeRaw.toLowerCase() === "ctv_a";
    return true;
  }).sort((left, right) => left.id - right.id).map((record) => {
    const rounded = Math.ceil(record.dauKy * targetRatePercent / 100 - record.luyKe);
    return { ctvUser: record.ctvUser, employeeCodeRaw: record.employeeCodeRaw, managerCodeRaw: record.managerCodeRaw, dauKy: record.dauKy, luyKe: record.luyKe, thuaThieu: Object.is(rounded, -0) ? 0 : rounded, tonChuaThu: Number((record.dauKy - record.luyKe).toFixed(2)) };
  });
  const summaryRow = rows.length ? { employeeCodeRaw: "Tổng", dauKy: Math.round(rows.reduce((sum, row) => sum + row.dauKy, 0)), luyKe: Math.round(rows.reduce((sum, row) => sum + row.luyKe, 0)), thuaThieu: Math.round(rows.reduce((sum, row) => sum + row.thuaThieu, 0)), tonChuaThu: Math.round(rows.reduce((sum, row) => sum + row.tonChuaThu, 0)), isSummary: true } : null;
  return { reportDate: date, targetRatePercent, rows, summaryRow };
}

beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(origin);
  db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE CuocCdDailyResult (id INTEGER, reportDate TEXT, ctvUser TEXT, employeeCodeRaw TEXT, managerCodeRaw TEXT, dauKy REAL, luyKe REAL, thuaThieu REAL, tonChuaThu REAL); CREATE TABLE CuocCdConfig (id INTEGER, targetRatePercent REAL); CREATE TABLE User (username TEXT, secondaryCode TEXT); INSERT INTO CuocCdConfig VALUES (1, 99.5);");
  for (const record of fixture) insertRow(record);
  for (const user of users) db.prepare("INSERT INTO User VALUES (?, ?)").run(user.username, user.secondaryCode);
  queries = []; extraRows = []; setSessionRole("ADMIN");
  mocks.auth.mockImplementation(async () => session);
  mocks.ensure.mockResolvedValue(undefined);
  mocks.scope.mockResolvedValue(["CTV_A", "NV-A"]);
  mocks.raw.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => readSql(sql, ...params));
  cache = await import("@/lib/kpi-cache"); route = await import("@/app/api/cuoc-cd/report/route");
});

afterEach(() => { db.close(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Cuoc CD latest report date metadata", () => {
  it.each(["ADMIN", "MANAGER", "CTV"])("keeps the full payload and removes warm-hit latest SQL for %s", async (role) => {
    setSessionRole(role);
    expect(await (await route.GET(request())).json()).toEqual(expected(role));
    const cold = queries.length;
    expect(await (await route.GET(request())).json()).toEqual(expected(role));
    expect(cold).toBe(4); expect(queries.length - cold).toBe(0);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("bypasses metadata for explicit dates and preserves three report reads", async () => {
    expect(await (await route.GET(request(" 2026-10-27 "))).json()).toEqual(expected("ADMIN", "2026-10-27"));
    expect(queries).toHaveLength(3); expect(latestReads()).toBe(0); expect(cache.getCache(metadataKey)).toBeNull();
  });

  it("shares only the global latest date, not row payloads, across roles", async () => {
    for (const role of ["ADMIN", "MANAGER", "CTV"]) {
      setSessionRole(role);
      expect(await (await route.GET(request())).json()).toEqual(expected(role));
    }
    expect(latestReads()).toBe(1); expect(queries).toHaveLength(10);
  });

  it("negative-caches an empty latest result without adding a target-rate field", async () => {
    db.exec("DELETE FROM CuocCdDailyResult");
    for (let index = 0; index < 2; index += 1) expect(await (await route.GET(request())).json()).toEqual({ reportDate: null, rows: [], summaryRow: null });
    expect(queries).toHaveLength(1); expect(cache.getCache(metadataKey)).toBe("");
  });

  it("expires metadata exactly at thirty seconds even while the response remains cached", async () => {
    await route.GET(request());
    const before = queries.length;
    vi.setSystemTime(origin + 29999); await route.GET(request());
    expect(queries.length).toBe(before);
    vi.setSystemTime(origin + 30000); await route.GET(request());
    expect(queries.length - before).toBe(1);
  });

  it("bounds positive metadata staleness to thirty seconds for writes without invalidation", async () => {
    await route.GET(request()); addLatest();
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN"));
    vi.setSystemTime(origin + 30000);
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-30"));
    expect(latestReads()).toBe(2);
  });

  it("expires a negative result and discovers the first newly added report", async () => {
    db.exec("DELETE FROM CuocCdDailyResult"); await route.GET(request()); addLatest();
    expect(await (await route.GET(request())).json()).toEqual({ reportDate: null, rows: [], summaryRow: null });
    vi.setSystemTime(origin + 30000);
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-30"));
  });

  it("uses the existing import/config invalidation prefix to discover a new date immediately", async () => {
    await route.GET(request()); addLatest(); cache.clearCacheByPrefix(prefix);
    expect(cache.getCache(metadataKey)).toBeNull();
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-30"));
    expect(cache.getCache(metadataKey)).toBe("2026-10-30");
  });

  it("keeps configuration updates including zero and reloads after the existing invalidation", async () => {
    await route.GET(request()); db.exec("UPDATE CuocCdConfig SET targetRatePercent = 0"); cache.clearCacheByPrefix(prefix);
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-29", 0));
    const before = queries.length; await route.GET(request()); expect(queries.length).toBe(before);
  });

  it("does not cache a failed metadata read and allows a later retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.raw.mockImplementationOnce(async (sql: string) => { queries.push({ sql, params: [] }); throw new Error("synthetic latest failure"); });
    expect((await route.GET(request())).status).toBe(500); expect(cache.getCache(metadataKey)).toBeNull();
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN"));
    const before = queries.length; await route.GET(request()); expect(queries.length).toBe(before);
  });

  it("retains successful metadata but never caches a failed report payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let fail = true;
    mocks.raw.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => {
      if (fail && sql.includes('WHERE "reportDate" = ?')) { fail = false; queries.push({ sql, params }); throw new Error("synthetic rows failure"); }
      return readSql(sql, ...params);
    });
    expect((await route.GET(request())).status).toBe(500);
    const before = queries.length;
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN"));
    expect(queries.length - before).toBe(3);
  });

  it("does not let an invalidated delayed latest read overwrite newer metadata", async () => {
    const reached = deferred<void>(); const gate = deferred<void>();
    let hold = true;
    mocks.raw.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => {
      const rows = readSql(sql, ...params);
      if (hold && sql.includes('SELECT DISTINCT "reportDate"')) { hold = false; reached.resolve(); await gate.promise; }
      return rows;
    });
    const old = route.GET(request()); await reached.promise;
    addLatest(); cache.clearCacheByPrefix(prefix);
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-30"));
    gate.resolve(); expect(await (await old).json()).toEqual(expected("ADMIN"));
    expect(cache.getCache(metadataKey)).toBe("2026-10-30");
    const before = queries.length;
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-30")); expect(queries.length).toBe(before);
  });

  it("captures generation before authentication and cannot publish after invalidation during auth", async () => {
    const authGate = deferred<Session | null>(); mocks.auth.mockReturnValueOnce(authGate.promise);
    const old = route.GET(request()); cache.clearCacheByPrefix(prefix); authGate.resolve(session);
    expect(await (await old).json()).toEqual(expected("ADMIN")); expect(cache.getCache(metadataKey)).toBeNull();
    await route.GET(request()); const before = queries.length; await route.GET(request()); expect(queries.length).toBe(before);
  });

  it.each([null, "UNSUPPORTED"])("does not expose cached metadata before auth/role checks: %s", async (role) => {
    cache.setCache(metadataKey, "2026-10-29", 30000, cache.getCacheGeneration());
    if (role) setSessionRole(role); else session = null;
    expect((await route.GET(request())).status).toBe(role ? 403 : 401);
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.scope).not.toHaveBeenCalled(); expect(queries).toHaveLength(0);
  });

  it("preserves the allowed-list response key when manager scope changes", async () => {
    setSessionRole("MANAGER"); await route.GET(request()); mocks.scope.mockResolvedValue(["CTV_C"]);
    const before = queries.length;
    expect(await (await route.GET(request())).json()).toEqual(expected("MANAGER", "2026-10-29", 99.5, true, ["CTV_C"]));
    expect(queries.length - before).toBe(3);
  });

  it("normalizes whitespace-only date input into the same latest response", async () => {
    await route.GET(request("   ")); const before = queries.length;
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN")); expect(queries.length).toBe(before);
  });

  it("keeps the legacy missing-secondaryCode fallback and summary output", async () => {
    db.exec("ALTER TABLE User DROP COLUMN secondaryCode");
    expect(await (await route.GET(request())).json()).toEqual(expected("ADMIN", "2026-10-29", 99.5, false));
    expect(queries).toHaveLength(5);
    const before = queries.length; await route.GET(request()); expect(queries.length).toBe(before);
  });

  it("starts metadata TTL when the delayed metadata query completes", async () => {
    const reached = deferred<void>(); const gate = deferred<void>(); let hold = true;
    mocks.raw.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => {
      const rows = readSql(sql, ...params);
      if (hold && sql.includes('SELECT DISTINCT "reportDate"')) { hold = false; reached.resolve(); await gate.promise; }
      return rows;
    });
    const response = route.GET(request()); await reached.promise; vi.setSystemTime(origin + 10000); gate.resolve(); await response;
    const before = queries.length; vi.setSystemTime(origin + 39999); await route.GET(request()); expect(queries.length).toBe(before);
    vi.setSystemTime(origin + 40000); await route.GET(request()); expect(queries.length - before).toBe(1);
  });
});
