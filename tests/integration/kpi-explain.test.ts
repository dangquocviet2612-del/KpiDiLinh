import { createClient, type Client, type InStatement } from "@libsql/client";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  KPI_SUMMARY_METADATA_SQL,
  buildKpiSummaryAggregateQuery,
  buildLatestKpiDateQuery,
  buildPersonalKpiQuery,
} from "../../src/lib/kpi-report-queries";

vi.mock("node:sqlite", () => ({ DatabaseSync: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  stat: vi.fn(),
}));

type PlanRow = { id: number; parent: number; notused: number; detail: string };
type Report = { plans: { name: string; rows: PlanRow[] }[] };
type ExplainModule = { main: (args: string[]) => Promise<Report> };
type Fixture = { client: Client; url: string; filename: string; directory: string; rowCount: number };
type Migration = { version: string; checksum: string; statements: string[] };
type Runner = {
  splitSqlStatements: (sql: string) => string[];
  applyMigrations: (client: Client, migrations: Migration[], url: string) => Promise<unknown>;
};

const root = fileURLToPath(new URL("../../", import.meta.url));
const cliPath = path.join(root, "scripts/performance/explain-reports.mjs");
const fixtureRoot = path.join(root, ".local/performance/batch4-explain-fixtures");
const secret = "BATCH4_PRIVATE_TOKEN_SENTINEL";
const ctv = "BATCH4_CTV_PARAMETER_SENTINEL";
const group = "BATCH4_GROUP_PARAMETER_SENTINEL";
const reportDate = "2001-02-03";
const names = ["personal-kpi", "summary-metadata", "summary-aggregate", "latest-kpi-date"];
const factory = vi.mocked(DatabaseSync);
const probe = vi.mocked(stat);
const fixtures: Fixture[] = [];
let runner: Runner;
let small: Fixture;
let large: Fixture;

const schema = `
  CREATE TABLE "KpiMetricConfig" (
    "id" INTEGER PRIMARY KEY, "kpiCode" TEXT NOT NULL, "kpiName" TEXT,
    "displayName" TEXT, "mergeGroup" TEXT, "baseScore" REAL, "maxPercent" REAL,
    "sortOrder" INTEGER, "isEnabled" INTEGER, "isNegative" INTEGER
  );
  CREATE UNIQUE INDEX "KpiMetricConfig_kpiCode_key" ON "KpiMetricConfig" ("kpiCode");
  CREATE TABLE "KpiDailyResult" (
    "id" INTEGER PRIMARY KEY, "reportDate" TEXT NOT NULL, "ctvUser" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL, "kpiName" TEXT, "khThang" REAL, "thNgay" REAL,
    "thLuyKe" REAL, "completionPercent" REAL, "growthPercent" REAL, "rawPayload" TEXT
  );
  CREATE UNIQUE INDEX "idx_kpi_daily_report_ctv_metric" ON "KpiDailyResult" ("reportDate", "ctvUser", "kpiCode");
  CREATE INDEX "idx_kpi_daily_report_ctv" ON "KpiDailyResult" ("reportDate", "ctvUser");
  CREATE INDEX "idx_kpi_daily_ctv_report" ON "KpiDailyResult" ("ctvUser", "reportDate");
`;

async function fixture(metricCount: number, userCount: number, dayCount: number) {
  mkdirSync(fixtureRoot, { recursive: true });
  const directory = mkdtempSync(path.join(fixtureRoot, "fixture-"));
  const filename = path.join(directory, "fixture.sqlite");
  const url = pathToFileURL(filename).href;
  const client = createClient({ url });
  const created = { client, url, filename, directory, rowCount: metricCount * userCount * dayCount };
  fixtures.push(created);
  await runner.applyMigrations(client, [{
    version: "001_batch4_explain_fixture",
    checksum: createHash("sha256").update(schema).digest("hex"),
    statements: runner.splitSqlStatements(schema),
  }], url);
  const inserts: InStatement[] = [];
  for (let metric = 0; metric < metricCount; metric += 1) {
    const code = `BATCH4_METRIC_${metric}`;
    inserts.push({
      sql: "INSERT INTO KpiMetricConfig VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [metric + 1, code, secret, secret, group, 10, 120, metric, 1, 0],
    });
    for (let user = 0; user < userCount; user += 1) {
      for (let day = 0; day < dayCount; day += 1) {
        inserts.push({
          sql: "INSERT INTO KpiDailyResult (reportDate, ctvUser, kpiCode, kpiName, khThang, thNgay, thLuyKe, completionPercent, growthPercent, rawPayload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [day === 0 ? reportDate : `2001-01-${String(day).padStart(2, "0")}`, user === 0 ? ctv : `BATCH4_USER_${user}`, code, secret, 100, 5, 25, 25, 0, secret],
        });
      }
    }
  }
  await client.batch(inserts, "write");
  return created;
}

function cli(args: string[], directory = small.directory) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `libsql://${secret}.invalid`,
    TURSO_AUTH_TOKEN: secret,
  };
  delete env.NODE_OPTIONS;
  delete env.NODE_DEBUG;
  delete env.NODE_NO_WARNINGS;
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: directory, env, encoding: "utf8", timeout: 15_000,
  });
  expectPrivate(result.stderr);
  for (const value of [...args, directory].filter((value) => value.trim() && !value.startsWith("--"))) {
    expect(result.stderr).not.toContain(value);
  }
  return result;
}

function expectPrivate(output: string, target?: string) {
  for (const value of [secret, ctv, group, reportDate, target, root, root.replaceAll("\\", "/")].filter(Boolean) as string[]) {
    expect(output).not.toContain(value);
  }
  expect(output).not.toMatch(/(?:LibsqlError|SQLITE_ERROR|node:internal|\bat (?:async |file:)|SELECT\s)/);
}

function withoutSqliteWarning(stderr: string) {
  return stderr.replace(/^\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n(?:\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n)?/gm, "");
}

function expectDenied(args: string[], engineLoaded = false) {
  const result = cli(args);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  if (!engineLoaded) expect(result.stderr).not.toContain("SQLite is an experimental feature");
  expect(engineLoaded ? withoutSqliteWarning(result.stderr) : result.stderr).toMatch(/^KPI EXPLAIN failed;[^\r\n]+\r?\n$/);
  expectPrivate(result.stderr, args.find((value) => value.startsWith("file:")));
}

async function snapshot(client: Client) {
  const objects = (await client.execute("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")).rows;
  const tableNames = objects.filter((row) => row.type === "table").map((row) => String(row.name));
  const contents = [];
  for (const table of tableNames) {
    contents.push({ table, rows: (await client.execute(`SELECT * FROM "${table.replaceAll('"', '""')}" ORDER BY rowid`)).rows });
  }
  return { objects, contents, schemaVersion: (await client.execute("PRAGMA schema_version")).rows };
}

async function loadTool() {
  expect(existsSync(cliPath), "EXPLAIN CLI must exist").toBe(true);
  return await import(pathToFileURL(cliPath).href) as ExplainModule;
}

function mockDatabase() {
  probe.mockResolvedValue({ isFile: () => true } as Awaited<ReturnType<typeof stat>>);
  const all = vi.fn<(...parameters: SQLInputValue[]) => (PlanRow & { privateData: string })[]>().mockReturnValue([
    { id: 1, parent: 0, notused: 0, detail: "SEARCH d USING INDEX idx_kpi_daily_ctv_report (ctvUser=?)", privateData: secret },
  ]);
  const prepare = vi.fn<(sql: string) => { all: typeof all }>().mockReturnValue({ all });
  const close = vi.fn();
  factory.mockImplementation(function () {
    return { prepare, close } as unknown as DatabaseSync;
  });
  return { prepare, all, close };
}

beforeAll(async () => {
  runner = await import(pathToFileURL(path.join(root, "scripts/lib/migration-runner.mjs")).href) as Runner;
  small = await fixture(2, 2, 3);
  large = await fixture(4, 16, 31);
}, 30_000);

afterEach(() => {
  vi.resetAllMocks();
});

afterAll(() => {
  for (const created of fixtures) created.client.close();
});

describe("local-only KPI EXPLAIN CLI", () => {
  it.each(["small", "large"])("explains all shared templates on its %s managed fixture without changing schema, ledger or seeded rows", async (size) => {
    const target = size === "small" ? small : large;
    const before = await snapshot(target.client);
    const hash = createHash("sha256").update(readFileSync(target.filename)).digest("hex");
    const result = cli(["--database", target.url, "--ctv", ctv, "--report-date", reportDate, "--group", group]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(withoutSqliteWarning(result.stderr)).toBe("");
    expectPrivate(result.stdout, target.url);
    const report = JSON.parse(result.stdout) as Report;
    expect(Object.keys(report)).toEqual(["plans"]);
    expect(report.plans.map((plan) => plan.name)).toEqual(names);
    for (const plan of report.plans) {
      expect(Object.keys(plan).sort()).toEqual(["name", "rows"]);
      expect(plan.rows.length).toBeGreaterThan(0);
      for (const row of plan.rows) {
        expect(Object.keys(row).sort()).toEqual(["detail", "id", "notused", "parent"]);
        expect([row.id, row.parent, row.notused].every(Number.isInteger)).toBe(true);
        expect(row.detail).toMatch(/SCAN|SEARCH|B-TREE/);
      }
    }
    expect(report.plans[0].rows.some((row) => /SEARCH d USING .*INDEX/.test(row.detail))).toBe(true);
    expect(report.plans[2].rows.some((row) => /SEARCH d USING .*INDEX/.test(row.detail))).toBe(true);
    expect(report.plans[3].rows.some((row) => /idx_kpi_daily_ctv_report/.test(row.detail))).toBe(true);
    expect(await snapshot(target.client)).toEqual(before);
    expect(createHash("sha256").update(readFileSync(target.filename)).digest("hex")).toBe(hash);
    expect((await target.client.execute("SELECT COUNT(*) AS total FROM KpiDailyResult")).rows[0].total).toBe(target.rowCount);
  });

  it("uses fixed synthetic defaults, not env files or DATABASE_URL, from an unrelated working directory", () => {
    writeFileSync(path.join(small.directory, ".env"), `DATABASE_URL=libsql://${secret}.invalid\nTURSO_AUTH_TOKEN=${secret}\n`);
    const result = cli(["--database", small.url]);
    expect(result.status, result.stderr).toBe(0);
    expect(withoutSqliteWarning(result.stderr)).toBe("");
    expect((JSON.parse(result.stdout) as Report).plans.map((plan) => plan.name)).toEqual(names);
    expectPrivate(result.stdout, small.url);
    expectDenied([]);
  });

  it.each([
    ["--database"],
    ["--database", "--ctv", ctv],
    ["--database", ""],
    ["--ctv", ctv],
    ["--unknown", secret],
  ])("rejects incomplete or unknown arguments safely: %j", (...args) => {
    expectDenied(args);
  });

  it.each(["--ctv", "--report-date", "--group"])("rejects missing, blank or flag-like %s values before client creation", async (option) => {
    const tool = await loadTool();
    for (const suffix of [[], [""], [" "], ["--unknown"], [option, secret]]) {
      await expect(tool.main(["--database", small.url, option, ...suffix])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    }
    expect(probe).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects duplicate options, unknown arguments and positional values before probing the target", async () => {
    const tool = await loadTool();
    for (const suffix of [["--database", small.url], ["--ctv", ctv, "--ctv", ctv], ["--allow-remote"], [secret], [`--group=${secret}`]]) {
      await expect(tool.main(["--database", small.url, ...suffix])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    }
    expect(probe).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it("refuses a missing local file without creating it or constructing a client", async () => {
    const missing = path.join(small.directory, `${secret}-absent.sqlite`);
    const url = pathToFileURL(missing).href;
    expectDenied(["--database", url]);
    expect(existsSync(missing)).toBe(false);
    const tool = await loadTool();
    probe.mockRejectedValue(new Error(secret));
    await expect(tool.main(["--database", url])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects a directory before constructing a client", async () => {
    expectDenied(["--database", pathToFileURL(small.directory).href]);
    const tool = await loadTool();
    probe.mockResolvedValue({ isFile: () => false } as Awaited<ReturnType<typeof stat>>);
    await expect(tool.main(["--database", small.url])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    expect(factory).not.toHaveBeenCalled();
  });

  it.each([
    `libsql://user:${secret}@fixture-only.invalid/db?authToken=${secret}`,
    `https://user:${secret}@fixture-only.invalid/db`,
    `http://fixture-only.invalid/${secret}`,
    `wss://fixture-only.invalid/${secret}`,
    `file://fixture-only.invalid/share/${secret}.sqlite`,
    `file:////fixture-only.invalid/share/${secret}.sqlite`,
    `file:%5C%5Cfixture-only.invalid%5Cshare%5C${secret}.sqlite`,
    `file:%2F%2Ffixture-only.invalid/share/${secret}.sqlite`,
    `\\\\fixture-only.invalid\\share\\${secret}.sqlite`,
    `file://user:${secret}@localhost/fixture.sqlite`,
    "file::memory:",
    "file:fixture.sqlite?mode=memory",
    "file:",
    "file://localhost",
    "file:%00fixture.sqlite",
    "file:%not-encoded",
  ])("rejects non-persistent, remote or UNC targets before any filesystem probe: %s", async (target) => {
    const tool = await loadTool();
    await expect(tool.main(["--database", target])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    expect(probe).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    expectDenied(["--database", target]);
  });

  it("binds overrides into the exact shared templates and executes only EXPLAIN QUERY PLAN SELECT statements", async () => {
    const tool = await loadTool();
    const { prepare, all, close } = mockDatabase();
    const result = await tool.main(["--database", small.url, "--ctv", ctv, "--report-date", reportDate, "--group", group]);
    const queries = [
      buildPersonalKpiQuery(ctv, reportDate),
      { sql: KPI_SUMMARY_METADATA_SQL, args: [] },
      buildKpiSummaryAggregateQuery(reportDate, group, [ctv]),
      buildLatestKpiDateQuery(ctv),
    ];
    expect(prepare.mock.calls.map(([sql]) => sql)).toEqual(queries.map((query) => `EXPLAIN QUERY PLAN ${query.sql}`));
    expect(all.mock.calls).toEqual(queries.map((query) => query.args));
    expect(factory).toHaveBeenCalledExactlyOnceWith(small.filename, { readOnly: true });
    expect(probe.mock.invocationCallOrder[0]).toBeLessThan(factory.mock.invocationCallOrder[0]);
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.plans.map((plan) => plan.name)).toEqual(names);
    expectPrivate(JSON.stringify(result), small.url);
    expect(result.plans[0].rows[0]).not.toHaveProperty("privateData");
  });

  it("binds fixed synthetic defaults without querying business data to discover them", async () => {
    const tool = await loadTool();
    const { all, close } = mockDatabase();
    await tool.main(["--database", small.url]);
    expect(all.mock.calls).toEqual([
      ["KPI_EXPLAIN_CTV", "2000-01-01", "KPI_EXPLAIN_CTV"],
      [],
      ["2000-01-01", "KPI_EXPLAIN_GROUP", "KPI_EXPLAIN_CTV"],
      ["KPI_EXPLAIN_CTV"],
    ]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the database when EXPLAIN fails and sanitizes the original error", async () => {
    const tool = await loadTool();
    for (const stage of ["prepare", "all"]) {
      const { prepare, all, close } = mockDatabase();
      const operation = stage === "prepare" ? prepare : all;
      operation.mockImplementationOnce(() => { throw new Error(`${secret} ${small.url}`); });
      const error = await tool.main(["--database", small.url]).catch((failure: Error) => failure);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/^KPI EXPLAIN failed;/);
      expectPrivate((error as Error).message, small.url);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    }
  });

  it("sanitizes database creation and close failures", async () => {
    const tool = await loadTool();
    const { close } = mockDatabase();
    close.mockImplementationOnce(() => { throw new Error(secret); });
    await expect(tool.main(["--database", small.url])).rejects.toThrow(/^KPI EXPLAIN failed;/);
    factory.mockImplementationOnce(function () { throw new Error(`${secret} ${small.url}`); });
    const error = await tool.main(["--database", small.url]).catch((failure: Error) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^KPI EXPLAIN failed;/);
    expectPrivate((error as Error).message, small.url);
  });

  it("prints no partial plan or raw database error for a malformed owned fixture", () => {
    const filename = path.join(small.directory, `${secret}-invalid.sqlite`);
    writeFileSync(filename, secret);
    expectDenied(["--database", pathToFileURL(filename).href], true);
    expect(readFileSync(filename, "utf8")).toBe(secret);
  });

  it("imports the shared templates instead of copying report SQL or loading environment files", () => {
    expect(existsSync(cliPath), "EXPLAIN CLI must exist").toBe(true);
    const source = readFileSync(cliPath, "utf8");
    expect(source).toContain("../../src/lib/kpi-report-queries.ts");
    for (const symbol of ["KPI_SUMMARY_METADATA_SQL", "buildPersonalKpiQuery", "buildKpiSummaryAggregateQuery", "buildLatestKpiDateQuery", "assertPersistentTarget", "resolveLocalDatabasePath"]) {
      expect(source).toContain(symbol);
    }
    expect(source).not.toMatch(/\b(?:FROM|JOIN)\s+["`]?Kpi|dotenv|process\.env|DATABASE_URL|TURSO_AUTH_TOKEN/);
    expect(source).toContain('await import("node:sqlite")');
    expect(source.indexOf('await import("node:sqlite")')).toBeGreaterThan(source.indexOf("splitSqlStatements(query.sql)"));
    expect(source).not.toMatch(/@libsql\/client|PRAGMA|\.batch\(|\.executeMultiple\(|\.transaction\(/i);
  });
});

describe("native read-only hardening", () => {
  async function nativeConnection() {
    probe.mockResolvedValue({ isFile: () => true } as Awaited<ReturnType<typeof stat>>);
    const native = await vi.importActual<typeof import("node:sqlite")>("node:sqlite");
    factory.mockImplementation(function (filename, options) {
      return new native.DatabaseSync(filename, options);
    });
    return native;
  }

  it("opens the validated fixture with a native readOnly constructor option", async () => {
    await nativeConnection();
    const tool = await loadTool();
    await tool.main(["--database", small.url]);
    expect(factory).toHaveBeenCalledExactlyOnceWith(small.filename, { readOnly: true });
  });

  it("rejects an actual write using the exact same native adapter mode", async () => {
    const native = await nativeConnection();
    const tool = await loadTool();
    const before = await snapshot(small.client);
    const hash = createHash("sha256").update(readFileSync(small.filename)).digest("hex");
    await tool.main(["--database", small.url]);
    expect(factory).toHaveBeenCalledExactlyOnceWith(small.filename, { readOnly: true });
    const options = factory.mock.calls[0][1];
    const database = new native.DatabaseSync(small.filename, options);
    try {
      expect(() => database.prepare("UPDATE KpiDailyResult SET thNgay = thNgay + 1 WHERE id = 1").run()).toThrow(/read.?only/i);
    } finally {
      database.close();
    }
    expect(await snapshot(small.client)).toEqual(before);
    expect(createHash("sha256").update(readFileSync(small.filename)).digest("hex")).toBe(hash);
  });

  it("cannot create a missing file when stat succeeds before the real native open", async () => {
    await nativeConnection();
    const tool = await loadTool();
    const missing = path.join(small.directory, `${secret}-stat-open-race.sqlite`);
    const url = pathToFileURL(missing).href;
    expect(existsSync(missing)).toBe(false);
    const error = await tool.main(["--database", url]).catch((failure: Error) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^KPI EXPLAIN failed;/);
    expectPrivate((error as Error).message, url);
    expect(probe).toHaveBeenCalledExactlyOnceWith(missing);
    expect(existsSync(missing)).toBe(false);
    expect(factory).toHaveBeenCalledExactlyOnceWith(missing, { readOnly: true });
  });
});
