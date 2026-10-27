import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  findNodes: vi.fn(),
  findUsers: vi.fn(),
  ensureRuntimeSchema: vi.fn(),
  ensureKpiTables: vi.fn(),
  getAccessibleCtvCodes: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCacheByPrefix: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readWorkbook: vi.fn(),
  sheetToJson: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.query,
    $executeRawUnsafe: mocks.execute,
    $transaction: mocks.transaction,
    node: { findMany: mocks.findNodes },
    user: { findMany: mocks.findUsers },
  },
}));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.ensureRuntimeSchema }));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensureKpiTables }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.getAccessibleCtvCodes }));
vi.mock("@/lib/kpi-cache", () => ({
  getCache: mocks.getCache,
  setCache: mocks.setCache,
  clearCacheByPrefix: mocks.clearCacheByPrefix,
}));
vi.mock("fs", () => ({
  default: { existsSync: mocks.existsSync, readFileSync: mocks.readFileSync },
}));
vi.mock("xlsx", () => ({
  read: mocks.readWorkbook,
  utils: { sheet_to_json: mocks.sheetToJson },
}));

import { ensureNode0TbTable, getNode0TbList, parseFlexibleDate, upsertNode0TbBatch } from "@/lib/node-0tb-db";
import { parseCuocCdWorkbook } from "@/lib/cuoc-cd";
import { GET as getNodes } from "@/app/api/node-0tb/route";
import { GET as getReport } from "@/app/api/cuoc-cd/report/route";
import { POST as uploadNodes } from "@/app/api/node-0tb/upload/route";
import { POST as importReport } from "@/app/api/cuoc-cd/import/route";

const reportDate = "2026-10-26";
const webUsers = [
  { username: "fixture-ctv", secondaryCode: "fixture-secondary" },
  { username: "fixture-other", secondaryCode: null },
  { username: "fixture-outsider", secondaryCode: null },
];

function workbookRows(): unknown[][] {
  const reportRow = Array<unknown>(15).fill("");
  reportRow[3] = "fixture-manager";
  reportRow[4] = "fixture-secondary";
  reportRow[10] = "100";
  reportRow[14] = "99.2";
  return [
    ["NODE", "Date", "PORT", "Category"],
    ["fixture-node", "26/10/2026", 16, "fixture-category"],
    [], [], [], [], reportRow,
  ];
}

function emptyQuery(sql: string) {
  if (/COUNT\(\*\)/i.test(sql)) return [{ count: 0, cnt: 0 }];
  if (sql.includes('FROM "CuocCdConfig"')) return [{ targetRatePercent: 99.5 }];
  if (sql.includes('FROM "User"')) return webUsers;
  if (sql.includes('FROM "Node0Tb"') || sql.includes('FROM "CuocCdDailyResult"')) return [];
  throw new Error(`Unexpected fixture SQL: ${sql}`);
}

function expectNoDefaultFileAccess() {
  expect.soft(mocks.existsSync).not.toHaveBeenCalled();
  expect.soft(mocks.readFileSync).not.toHaveBeenCalled();
  expect.soft(mocks.readWorkbook).not.toHaveBeenCalled();
  expect.soft(mocks.sheetToJson).not.toHaveBeenCalled();
}

function expectReadOnlyQueries() {
  expect.soft(mocks.query.mock.calls.every(([sql]) => /^\s*SELECT\b/i.test(sql))).toBe(true);
  expect.soft(mocks.query.mock.calls.some(([sql]) => /COUNT\(\*\)/i.test(sql))).toBe(false);
  expect.soft(mocks.execute).not.toHaveBeenCalled();
  expect.soft(mocks.transaction).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_0TB_DEFAULT_FILE_PATH", "C:/fixture-only/node-default.xlsx");
  vi.stubEnv("CUOC_CD_DEFAULT_FILE_PATH", "C:/fixture-only/cuoc-default.xlsx");
  mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
  mocks.query.mockImplementation(async (sql: string) => emptyQuery(sql));
  mocks.execute.mockResolvedValue(1);
  mocks.transaction.mockImplementation(async (callback: (transaction: { $executeRawUnsafe: typeof mocks.execute }) => Promise<void>) => {
    return callback({ $executeRawUnsafe: mocks.execute });
  });
  mocks.findNodes.mockResolvedValue([]);
  mocks.findUsers.mockResolvedValue(webUsers);
  mocks.ensureRuntimeSchema.mockResolvedValue(undefined);
  mocks.ensureKpiTables.mockResolvedValue(undefined);
  mocks.getAccessibleCtvCodes.mockResolvedValue(["fixture-ctv"]);
  mocks.getCache.mockReturnValue(null);
  mocks.existsSync.mockReturnValue(true);
  mocks.readFileSync.mockReturnValue(Buffer.from("fixture-workbook"));
  mocks.readWorkbook.mockReturnValue({ SheetNames: ["NODE 0TB"], Sheets: { "NODE 0TB": {} } });
  mocks.sheetToJson.mockReturnValue(workbookRows());
});

afterEach(() => vi.unstubAllEnvs());

describe("default workbook GET safety", () => {
  it("empty Node0Tb GET ignores a configured existing default workbook without counts or writes", async () => {
    const response = await getNodes(new Request("http://localhost/api/node-0tb"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nodes: [],
      stats: { total: 0, withCoords: 0, withoutCoords: 0, categories: [] },
      categories: [],
    });
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
    expect(mocks.query).toHaveBeenCalledExactlyOnceWith('SELECT * FROM "Node0Tb" ORDER BY "nodeCode" ASC');
  });

  it("empty Cuoc CD GET ignores a configured existing default workbook without counts or writes", async () => {
    const response = await getReport(new Request("http://localhost/api/cuoc-cd/report"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reportDate: null, rows: [], summaryRow: null });
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
    expect(mocks.findUsers).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Node0Tb", getNodes, "/api/node-0tb"],
    ["Cuoc CD", getReport, "/api/cuoc-cd/report"],
  ] as const)("unauthenticated %s GET performs no readiness, data, or filesystem work", async (_name, handler, path) => {
    mocks.auth.mockResolvedValue(null);
    expect((await handler(new Request(`http://localhost${path}`))).status).toBe(401);
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
  });

  it("Cuoc CD keeps unsupported roles denied before readiness or data access", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-denied", role: "OTHER" } });
    expect((await getReport(new Request("http://localhost/api/cuoc-cd/report"))).status).toBe(403);
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
  });
});

describe("Node0Tb readiness and retained behavior", () => {
  it("preserves the async readiness export while delegating to the node0tb domain", async () => {
    await expect(ensureNode0TbTable()).resolves.toBeUndefined();
    expect(mocks.ensureRuntimeSchema).toHaveBeenCalledExactlyOnceWith("node0tb");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("propagates readiness rejection without a legacy DDL fallback", async () => {
    const error = new Error("fixture schema is not ready");
    mocks.ensureRuntimeSchema.mockRejectedValue(error);
    await expect(ensureNode0TbTable()).rejects.toBe(error);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("retains exact, base, prefix coordinate matching and full category statistics before filters", async () => {
    const rows = [
      { id: "exact", nodeCode: "FIXTURE-A-SP1", categoryKd: "Group A" },
      { id: "base", nodeCode: "FIXTURE-B-SP2", categoryKd: "Group A" },
      { id: "prefix", nodeCode: "FIXTURE-C", categoryKd: "Group B" },
      { id: "missing", nodeCode: "FIXTURE-D", categoryKd: null },
    ].map((row) => ({
      dateKd: null, dateKdRaw: "fixture-date", dateKdFormatted: null,
      totalPort: 16, usedPort: null, note: null, createdAt: reportDate, updatedAt: reportDate,
      ...row,
    }));
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT * FROM "Node0Tb"') ? rows : emptyQuery(sql));
    mocks.findNodes.mockResolvedValue([
      { name: "FIXTURE-A", latitude: 1, longitude: 2, description: "base candidate" },
      { name: "fixture-a-sp1", latitude: 3, longitude: 4, description: "exact winner" },
      { name: "fixture-b", latitude: 5, longitude: 6, description: "base winner" },
      { name: "FIXTURE-C-EXT", latitude: 7, longitude: 8, description: "prefix winner" },
      { name: "FIXTURE-D", latitude: null, longitude: 9, description: "invalid coordinate" },
    ]);
    const result = await getNode0TbList();
    expect(result.nodes.map((row) => [row.id, row.latitude, row.longitude, row.hasCoordinates])).toEqual([
      ["exact", 3, 4, true], ["base", 5, 6, true], ["prefix", 7, 8, true], ["missing", null, null, false],
    ]);
    expect(result.nodes[0]).toMatchObject({ dateKdFormatted: "fixture-date", usedPort: 0 });
    expect(result.stats).toMatchObject({ total: 4, withCoords: 3, withoutCoords: 1 });
    expect(result.stats.categories.slice(0, 2)).toEqual([
      { category: "Group A", count: 2, withCoords: 2 },
      { category: "Group B", count: 1, withCoords: 1 },
    ]);
    const filtered = await getNode0TbList({ category: "group a", search: "exact winner" });
    expect(filtered.nodes.map((row) => row.id)).toEqual(["exact"]);
    expect(filtered.stats).toEqual(result.stats);
    expect(filtered.categories).toEqual(result.categories);
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
  });

  it("retains date parsing and explicit upsert writes behind readiness", async () => {
    const parsed = parseFlexibleDate("26/10/2026");
    expect(parsed.formatted).toBe("26/10/2026");
    await upsertNode0TbBatch([{
      nodeCode: " fixture-node ", dateKd: parsed.date, dateKdRaw: parsed.raw,
      dateKdFormatted: parsed.formatted, totalPort: 16, usedPort: 2, categoryKd: "fixture-category",
    }]);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0]).toContain('INSERT INTO "Node0Tb"');
    expect(mocks.execute.mock.calls[0][2]).toBe("fixture-node");
    expect(mocks.ensureRuntimeSchema).toHaveBeenCalledWith("node0tb");
    expectNoDefaultFileAccess();
  });
});

describe("Cuoc CD retained report behavior", () => {
  const rawRows = [
    { ctvUser: "fixture-ctv", employeeCodeRaw: "fixture-secondary", managerCodeRaw: "other-manager", dauKy: 100, luyKe: 99.2 },
    { ctvUser: "fixture-other", employeeCodeRaw: "fixture-other", managerCodeRaw: "fixture-manager", dauKy: 10, luyKe: 10.01 },
    { ctvUser: "fixture-outsider", employeeCodeRaw: "fixture-outsider", managerCodeRaw: "other-manager", dauKy: 200, luyKe: 0 },
    { ctvUser: "unregistered", employeeCodeRaw: "unregistered", managerCodeRaw: "fixture-manager", dauKy: 999, luyKe: 0 },
  ];

  it.each([
    ["ADMIN", "fixture-admin", ["fixture-ctv", "fixture-other", "fixture-outsider"], 310, 109, 200, 201],
    ["MANAGER", "fixture-manager", ["fixture-ctv", "fixture-other"], 110, 109, 1, 1],
    ["CTV", "fixture-ctv", ["fixture-ctv"], 100, 99, 1, 1],
  ] as const)("keeps %s role scope, registered-user filtering, rounding, and cache payloads", async (role, username, expectedUsers, dauKy, luyKe, thuaThieu, tonChuaThu) => {
    mocks.auth.mockResolvedValue({ user: { name: username, role } });
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "CuocCdDailyResult"') && !/COUNT\(\*\)/i.test(sql)) return rawRows;
      return emptyQuery(sql);
    });
    const response = await getReport(new Request(`http://localhost/api/cuoc-cd/report?reportDate=${reportDate}`));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.rows.map((row: { ctvUser: string }) => row.ctvUser)).toEqual(expectedUsers);
    expect(payload.rows[0]).toMatchObject({ thuaThieu: 1, tonChuaThu: 0.8 });
    if (role !== "CTV") expect(payload.rows[1]).toMatchObject({ thuaThieu: 0, tonChuaThu: -0.01 });
    expect(payload.summaryRow).toMatchObject({ dauKy, luyKe, thuaThieu, tonChuaThu, isSummary: true });
    expect(payload.targetRatePercent).toBe(99.5);
    expect(mocks.setCache).toHaveBeenCalledWith(expect.stringContaining(`cuoc-cd:report|${role}|${username}|${reportDate}|`), payload, 60_000);
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
  });

  it("serves a cached explicit-date report without seed probes or data queries", async () => {
    const cached = { reportDate, targetRatePercent: 99.5, rows: [], summaryRow: null };
    mocks.getCache.mockReturnValue(cached);
    const response = await getReport(new Request(`http://localhost/api/cuoc-cd/report?reportDate=${reportDate}`));
    expect(await response.json()).toEqual(cached);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.setCache).not.toHaveBeenCalled();
    expectNoDefaultFileAccess();
    expectReadOnlyQueries();
  });
});

describe("manual workbook imports remain available", () => {
  function uploadRequest(path: string) {
    const formData = new FormData();
    formData.set("file", new File(["fixture-workbook"], "fixture.xlsx"));
    return new Request(`http://localhost${path}`, { method: "POST", body: formData });
  }

  it("keeps the explicit Node0Tb upload parsing and upsert endpoint", async () => {
    const response = await uploadNodes(uploadRequest("/api/node-0tb/upload"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, importedCount: 1 });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute.mock.calls[0][0]).toContain('INSERT INTO "Node0Tb"');
    expect(mocks.existsSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });

  it("keeps manual Cuoc CD parsing, transactional import, and post-mutation cache clearing", async () => {
    expect(parseCuocCdWorkbook(Buffer.from("fixture-workbook"), 99)).toEqual([{
      reportDate, employeeCodeRaw: "fixture-secondary", managerCodeRaw: "fixture-manager",
      dauKy: 100, luyKe: 99.2, thuaThieu: 0, tonChuaThu: 0.8,
    }]);
    const response = await importReport(uploadRequest("/api/cuoc-cd/import"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reportDate, inserted: 1 });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 120000, maxWait: 15000 });
    expect(mocks.execute.mock.calls[0]).toEqual(['DELETE FROM "CuocCdDailyResult" WHERE "reportDate" = ?', reportDate]);
    expect(mocks.execute.mock.calls[1][0]).toContain('INSERT INTO "CuocCdDailyResult"');
    expect(mocks.clearCacheByPrefix).toHaveBeenCalledExactlyOnceWith("cuoc-cd:report");
    expect(mocks.existsSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });
});
