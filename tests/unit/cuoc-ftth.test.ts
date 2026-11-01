import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as xlsx from "xlsx";
import { buildCuocCdSummaryRow, parseCuocCdWorkbook } from "@/lib/cuoc-cd";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), ensure: vi.fn(), scope: vi.fn(), query: vi.fn(), execute: vi.fn(),
  transaction: vi.fn(), users: vi.fn(), audit: vi.fn(), coreWrite: vi.fn(), coreRead: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.ensure }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.scope }));
vi.mock("@/lib/audit", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/lib/node-efficiency-db", () => ({ ensureNodeEfficiencyColumns: vi.fn() }));
vi.mock("@/lib/official-docs-db", () => ({ ensureOfficialDocTables: vi.fn() }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: vi.fn() }));
vi.mock("@/lib/node-0tb-db", () => ({ ensureNode0TbTable: vi.fn() }));
vi.mock("@/lib/nodeUtils", () => ({ invalidateNearestNodeCache: vi.fn() }));
vi.mock("@/lib/official-doc-assets", () => ({ getOfficialDocumentAssetRowsForBackup: vi.fn(async () => []) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $queryRawUnsafe: mocks.query, $executeRawUnsafe: mocks.execute, $transaction: mocks.transaction,
  user: { findMany: mocks.users, deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
  customer: { findMany: mocks.coreRead, deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
  node: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
  editHistory: { findMany: mocks.coreRead, deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
  customerNote: { findMany: mocks.coreRead, deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
} }));

const migrationUrl = new URL("../../prisma/migrations/20261031000000_add_cuoc_ftth/migration.sql", import.meta.url);
const knownUsers = [
  { username: "CTV_A", secondaryCode: "NV-A" },
  { username: "CTV_B", secondaryCode: "NV-B" },
  { username: "CTV_C", secondaryCode: "NV-C" },
  { username: "MANAGER_A", secondaryCode: "MGR-A" },
];
let database: DatabaseSync;
let cache: typeof import("@/lib/kpi-cache");
let report: typeof import("@/app/api/cuoc-ftth/report/route");
let config: typeof import("@/app/api/cuoc-ftth/config/route");
let importer: typeof import("@/app/api/cuoc-ftth/import/route");

function session(role: string | null, name = role === "CTV" ? "CTV_A" : "MANAGER_A") {
  mocks.auth.mockResolvedValue(role ? { user: { id: "fixture-admin", role, name } } : null);
}

function reportRequest(date = "") {
  return new Request(`http://localhost/api/cuoc-ftth/report?reportDate=${encodeURIComponent(date)}`);
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/cuoc-ftth/config", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function workbook(codes = ["NV-A"], date = "31/10/2026") {
  const rows: unknown[][] = [[`Ngày: ${date}`], [], [], [], [], []];
  for (const code of codes) {
    const row: unknown[] = Array(21).fill("");
    row[3] = "MANAGER_A"; row[4] = code; row[10] = 100.5; row[14] = 50.13;
    row[19] = 99999; row[20] = 99999;
    rows.push(row);
  }
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(rows), "Report");
  return xlsx.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function importRequest(buffer = workbook()) {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(buffer)]), "fixture.xlsx");
  return new Request("http://localhost/api/cuoc-ftth/import", { method: "POST", body: form });
}

function insertRow(code: string, ctvUser = code, managerCode = "OTHER", date = "2026-10-31") {
  database.prepare(`INSERT INTO CuocFtthDailyResult
    (reportDate,ctvUser,employeeCodeRaw,managerCodeRaw,dauKy,luyKe,thuaThieu,tonChuaThu)
    VALUES (?,?,?,?,100.5,50.13,777,888)`).run(date, ctvUser, code, managerCode);
}

function ftthRows() { return database.prepare("SELECT * FROM CuocFtthDailyResult ORDER BY id").all(); }
function rate(table = "CuocFtthConfig") {
  return database.prepare(`SELECT targetRatePercent FROM "${table}" WHERE id=1`).get()?.targetRatePercent;
}
function legacyData() {
  return { users: [{ id: "fixture-admin", username: "fixture-admin", password: "fixture-hash", role: "ADMIN" }] };
}

beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks();
  database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE User(username TEXT,secondaryCode TEXT);
    CREATE TABLE CuocCdConfig(id INTEGER PRIMARY KEY,targetRatePercent REAL,updatedAt DATETIME);
    INSERT INTO CuocCdConfig VALUES(1,91,CURRENT_TIMESTAMP);
    CREATE TABLE CuocCdDailyResult(id INTEGER PRIMARY KEY,reportDate TEXT,employeeCodeRaw TEXT);
    INSERT INTO CuocCdDailyResult VALUES(1,'2026-10-30','CD-SENTINEL');
    CREATE TABLE CuocConfig(id INTEGER PRIMARY KEY,targetRatePercent REAL);
    CREATE TABLE KpiMetricConfig(id INTEGER PRIMARY KEY,kpiCode TEXT UNIQUE,kpiName TEXT,displayName TEXT,baseScore REAL,maxPercent REAL,sortOrder INTEGER,isEnabled INTEGER,isNegative INTEGER,updatedAt DATETIME);`);
  database.exec(readFileSync(migrationUrl, "utf8"));
  for (const user of knownUsers) database.prepare("INSERT INTO User VALUES(?,?)").run(user.username, user.secondaryCode);
  session("ADMIN");
  mocks.scope.mockResolvedValue(["CTV_A", "NV-A"]);
  mocks.ensure.mockResolvedValue(undefined); mocks.audit.mockResolvedValue(undefined);
  mocks.users.mockResolvedValue(knownUsers); mocks.coreRead.mockResolvedValue([]); mocks.coreWrite.mockResolvedValue({ count: 0 });
  mocks.query.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => {
    if (/CuocFtth|CuocCd|FROM "User"/.test(sql)) return database.prepare(sql).all(...params);
    return [];
  });
  mocks.execute.mockImplementation(async (sql: string, ...params: SQLInputValue[]) => {
    expect(params.length).toBeLessThanOrEqual(900);
    return Number(database.prepare(sql).run(...params).changes);
  });
  mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => Promise<unknown>) => {
    database.exec("BEGIN");
    try {
      const result = await callback({
        $executeRawUnsafe: mocks.execute,
        user: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
        customer: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
        node: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
        editHistory: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
        customerNote: { deleteMany: mocks.coreWrite, createMany: mocks.coreWrite },
      });
      database.exec("COMMIT"); return result;
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cache = await import("@/lib/kpi-cache");
  report = await import("@/app/api/cuoc-ftth/report/route");
  config = await import("@/app/api/cuoc-ftth/config/route");
  importer = await import("@/app/api/cuoc-ftth/import/route");
});

afterEach(() => { database?.close(); vi.restoreAllMocks(); });

describe("FTTH migration and isolated runtime contract", () => {
  it("seeds 99.5 without changing CD records or its custom target", async () => {
    expect(rate()).toBe(99.5); expect(rate("CuocCdConfig")).toBe(91);
    expect(database.prepare("SELECT id,reportDate FROM CuocCdDailyResult").all()).toEqual([{ id: 1, reportDate: "2026-10-30" }]);
    const { validateRuntimeSchema } = await import("@/lib/runtime-schema-check.mjs");
    await expect(validateRuntimeSchema(async (sql: string, params: SQLInputValue[]) => database.prepare(sql).all(...params), "cuocFtth")).resolves.toBeUndefined();
    const { default: contract } = await import("@/lib/runtime-schema-contract.json");
    expect(Object.keys(contract.kpi)).not.toContain("CuocFtthConfig");
    expect(Object.keys(contract.kpi)).not.toContain("CuocFtthDailyResult");
    insertRow("NV-A");
    expect(() => insertRow("NV-A")).toThrow();
  });
});

describe("FTTH report and configuration", () => {
  it("returns persisted target with no report date, including zero and fallback99.5", async () => {
    for (const target of [99.5, 88, 0]) {
      database.prepare("UPDATE CuocFtthConfig SET targetRatePercent=?").run(target);
      expect(await (await report.GET(reportRequest())).json()).toEqual({ reportDate: null, targetRatePercent: target, rows: [], summaryRow: null });
    }
    database.exec("DELETE FROM CuocFtthConfig");
    expect(await (await config.GET()).json()).toEqual({ targetRatePercent: 99.5 });
  });

  it.each([null, "UNSUPPORTED"])("rejects report role %s before schema or SQL", async (role) => {
    session(role);
    expect((await report.GET(reportRequest())).status).toBe(role ? 403 : 401);
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("keeps CD read scope and formulas for %s", async (role) => {
    insertRow("NV-A", "CTV_A"); insertRow("NV-B", "CTV_B", "manager_a");
    insertRow("NV-C", "CTV_C"); insertRow("UNREGISTERED", "UNKNOWN", "MANAGER_A");
    session(role);
    const payload = await (await report.GET(reportRequest())).json();
    const expectedCodes = role === "ADMIN" ? ["NV-A", "NV-B", "NV-C"] : role === "MANAGER" ? ["NV-A", "NV-B"] : ["NV-A"];
    expect(payload.rows.map((row: { employeeCodeRaw: string }) => row.employeeCodeRaw)).toEqual(expectedCodes);
    const parsed = parseCuocCdWorkbook(workbook())[0];
    expect(payload.rows[0]).toMatchObject({ dauKy: parsed.dauKy, luyKe: parsed.luyKe, thuaThieu: parsed.thuaThieu, tonChuaThu: parsed.tonChuaThu });
    expect(payload.summaryRow).toEqual(buildCuocCdSummaryRow(payload.rows));
    expect(mocks.ensure).toHaveBeenCalledWith("cuocFtth");
    const reads = mocks.query.mock.calls.length;
    expect(await (await report.GET(reportRequest())).json()).toEqual(payload);
    expect(mocks.query).toHaveBeenCalledTimes(reads);
  });

  it.each(["MANAGER", "CTV", null])("only admin can save target: %s", async (role) => {
    session(role); const request = jsonRequest({ targetRatePercent: 88 }); const body = vi.spyOn(request, "json");
    expect((await config.POST(request)).status).toBe(role ? 403 : 401);
    expect(body).not.toHaveBeenCalled(); expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each(["99.5", "", null, true, [], {}, -1, 201])("rejects non-number or out-of-range target %j", async (targetRatePercent) => {
    expect((await config.POST(jsonRequest({ targetRatePercent }))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled(); expect(rate()).toBe(99.5);
  });

  it.each([0, 99.5, 200])("saves target %s and invalidates only FTTH cache", async (targetRatePercent) => {
    cache.setCache("cuoc-cd:report:latest-date", "CD-SENTINEL", 60000);
    cache.setCache("cuoc-ftth:report:latest-date", "OLD", 60000);
    expect((await config.POST(jsonRequest({ targetRatePercent }))).status).toBe(200);
    expect(rate()).toBe(targetRatePercent); expect(rate("CuocCdConfig")).toBe(91);
    expect(cache.getCache("cuoc-cd:report:latest-date")).toBe("CD-SENTINEL");
    expect(cache.getCache("cuoc-ftth:report:latest-date")).toBeNull();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CUOC_FTTH_CONFIG_UPDATE" }));
  });

  it("keeps CD latest cache out of FTTH report selection", async () => {
    cache.setCache("cuoc-cd:report:latest-date", "2026-10-30", 60000);
    insertRow("NV-A", "CTV_A");
    expect((await (await report.GET(reportRequest())).json()).reportDate).toBe("2026-10-31");
    expect(cache.getCache("cuoc-cd:report:latest-date")).toBe("2026-10-30");
  });
});

describe("FTTH import", () => {
  it.each([null, "CTV", "UNSUPPORTED"])("rejects import role %s before body/schema", async (role) => {
    session(role); const request = importRequest(); const body = vi.spyOn(request, "formData");
    expect((await importer.POST(request)).status).toBe(401);
    expect(body).not.toHaveBeenCalled(); expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MANAGER"])("reuses CD parser and replaces only imported FTTH date for %s", async (role) => {
    session(role); insertRow("OLD", "OLD"); insertRow("OLDER", "OLDER", "OTHER", "2026-10-29");
    database.exec("UPDATE CuocFtthConfig SET targetRatePercent=80");
    cache.setCache("cuoc-cd:report:latest-date", "CD", 60000);
    cache.setCache("cuoc-ftth:report:latest-date", "OLD", 60000);
    const buffer = workbook(); const parsed = parseCuocCdWorkbook(buffer, 80)[0];
    const response = await importer.POST(importRequest(buffer));
    expect(response.status).toBe(200); expect((await response.json()).inserted).toBe(1);
    expect(ftthRows()).toEqual([
      expect.objectContaining({ employeeCodeRaw: "OLDER", reportDate: "2026-10-29" }),
      expect.objectContaining({ ...parsed, ctvUser: "CTV_A" }),
    ]);
    expect(rate("CuocCdConfig")).toBe(91);
    expect(database.prepare("SELECT COUNT(*) AS count FROM CuocCdDailyResult").get()?.count).toBe(1);
    expect(cache.getCache("cuoc-cd:report:latest-date")).toBe("CD");
    expect(cache.getCache("cuoc-ftth:report:latest-date")).toBeNull();
  });

  it("keeps every import statement under900binds", async () => {
    const response = await importer.POST(importRequest(workbook(Array.from({ length: 225 }, (_, index) => `NV-${index}`))));
    expect(response.status).toBe(200); expect(ftthRows()).toHaveLength(225);
    const inserts = mocks.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "CuocFtthDailyResult"'));
    expect(inserts.length).toBeGreaterThan(1);
    expect(Math.max(...inserts.map((call) => call.length - 1))).toBeLessThanOrEqual(900);
  });

  it("rolls back deletion and earlier chunks if later insert fails without invalidating cache", async () => {
    insertRow("OLD", "OLD"); const before = ftthRows();
    database.exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON CuocFtthDailyResult WHEN NEW.employeeCodeRaw='FAIL' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
    cache.setCache("cuoc-ftth:report:latest-date", "KEPT", 60000);
    const codes = [...Array.from({ length: 110 }, (_, index) => `NV-${index}`), "FAIL"];
    expect((await importer.POST(importRequest(workbook(codes)))).status).toBe(500);
    expect(ftthRows()).toEqual(before); expect(cache.getCache("cuoc-ftth:report:latest-date")).toBe("KEPT");
  });

  it("rejects missing or empty workbook data before transaction", async () => {
    expect((await importer.POST(new Request("http://localhost", { method: "POST", body: new FormData() }))).status).toBe(400);
    expect((await importer.POST(importRequest(workbook([])))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("FTTH backup compatibility", () => {
  it.each(["99.5", null, true, -1, 201])("rejects invalid restored FTTH target %j before database access", async (targetRatePercent) => {
    const backup = await import("@/app/api/admin/backup/route");
    expect((await backup.POST(jsonRequest({ data: {
      ...legacyData(), cuocFtthConfigs: [{ id: 1, targetRatePercent }],
    } }))).status).toBe(400);
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.users).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["cuocFtthDailyResults", "cuocFtthConfigs"])("validates optional collection %s before any schema/query", async (key) => {
    const backup = await import("@/app/api/admin/backup/route");
    for (const malformed of [null, {}, "invalid", [null], [[]]]) {
      expect((await backup.POST(jsonRequest({ data: { ...legacyData(), [key]: malformed } }))).status).toBe(400);
    }
    expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("roundtrips separate data/config and restores empty target to99.5", async () => {
    insertRow("NV-A", "CTV_A"); database.exec("UPDATE CuocFtthConfig SET targetRatePercent=85");
    const backup = await import("@/app/api/admin/backup/route");
    const exported = await (await backup.GET()).json();
    expect(exported.data.cuocFtthDailyResults).toHaveLength(1);
    expect(exported.data.cuocFtthConfigs[0].targetRatePercent).toBe(85);
    expect(mocks.ensure).toHaveBeenCalledWith("cuocFtth", { requireDefaults: false });
    const response = await backup.POST(jsonRequest({ data: {
      ...legacyData(), cuocFtthDailyResults: exported.data.cuocFtthDailyResults, cuocFtthConfigs: exported.data.cuocFtthConfigs,
    } }));
    expect(response.status).toBe(200); expect(rate()).toBe(85); expect(ftthRows()).toHaveLength(1); expect(rate("CuocCdConfig")).toBe(91);
    expect((await backup.POST(jsonRequest({ data: { ...legacyData(), cuocFtthConfigs: [] } }))).status).toBe(200);
    expect(rate()).toBe(99.5); expect(ftthRows()).toHaveLength(1);
  });

  it("legacy restore omits FTTH readiness/default writes and leaves FTTH unchanged", async () => {
    insertRow("NV-A", "CTV_A"); database.exec("UPDATE CuocFtthConfig SET targetRatePercent=84");
    const before = ftthRows(); const backup = await import("@/app/api/admin/backup/route");
    expect((await backup.POST(jsonRequest({ data: legacyData() }))).status).toBe(200);
    expect(mocks.ensure.mock.calls.some(([domain]) => domain === "cuocFtth")).toBe(false);
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes("CuocFtth"))).toBe(false);
    expect(ftthRows()).toEqual(before); expect(rate()).toBe(84);
  });

  it("fails readiness before destructive restore and FTTH reads", async () => {
    mocks.ensure.mockImplementation(async (domain: string) => { if (domain === "cuocFtth") throw new Error("SCHEMA_NOT_READY"); });
    const backup = await import("@/app/api/admin/backup/route");
    expect((await backup.GET()).status).toBe(500);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("CuocFtth"))).toBe(false);
    expect((await backup.POST(jsonRequest({ data: { ...legacyData(), cuocFtthConfigs: [] } }))).status).toBe(500);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
