import { createClient, type Client, type InValue } from "@libsql/client";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: mocks.query, $executeRawUnsafe: mocks.execute } }));
const root = process.cwd();
let database: Client;
let url: string;

async function migrations() {
  return import(pathToFileURL(path.join(root, "scripts/lib/migration-runner.mjs")).href);
}

async function runtime() {
  if (!existsSync(path.join(root, "src/lib/runtime-schema.ts"))) throw new Error("Read-only runtime guard is not implemented");
  return import("@/lib/runtime-schema");
}

function preflight(target: string | undefined = url, args: string[] = []) {
  const environment: NodeJS.ProcessEnv = { ...process.env, TURSO_AUTH_TOKEN: "" };
  if (target) environment.DATABASE_URL = target;
  else delete environment.DATABASE_URL;
  return spawnSync(process.execPath, [path.join(root, "scripts/check-runtime-schema.mjs"), ...args], { cwd: root, env: environment, encoding: "utf8", timeout: 15_000 });
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  const parent = path.join(root, ".local/performance/runtime-schema-fixtures");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "fixture-"));
  url = `file:${path.join(directory, "fixture.sqlite").replaceAll("\\", "/")}`;
  database = createClient({ url });
  const { applyMigrations, loadMigrations } = await migrations();
  await applyMigrations(database, await loadMigrations(path.join(root, "prisma/migrations")), url);
  mocks.query.mockImplementation(async (sql: string, ...args: InValue[]) => (await database.execute({ sql, args })).rows);
  mocks.execute.mockImplementation(async (sql: string, ...args: InValue[]) => (await database.execute({ sql, args })).rowsAffected);
});

afterEach(() => database?.close());

describe("read-only runtime schema contract", () => {
  it("KPI initialization never writes DDL or business defaults", async () => {
    const { ensureKpiTables } = await import("@/lib/kpi-db");
    await ensureKpiTables();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mocks.query).toHaveBeenCalled();
  });

  it("coalesces concurrent cold checks and does not requery on successful warm checks", async () => {
    const { ensureRuntimeSchema } = await runtime();
    await Promise.all(Array.from({ length: 8 }, () => ensureRuntimeSchema("kpi")));
    expect(mocks.query).toHaveBeenCalledTimes(2);
    await ensureRuntimeSchema("kpi");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each(["customer", "users", "node0tb", "mapping", "node", "documents"])("domain %s uses one metadata read, no schema writes", async (domain) => {
    const { ensureRuntimeSchema } = await runtime();
    await ensureRuntimeSchema(domain as Parameters<typeof ensureRuntimeSchema>[0]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("fails clearly on missing schema without silently repairing it", async () => {
    await database.execute('ALTER TABLE "Customer" DROP COLUMN "nodeName"');
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("customer")).rejects.toThrow(/Customer\.nodeName/);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect((await database.execute('PRAGMA table_info("Customer")')).rows.some((row) => row.name === "nodeName")).toBe(false);
  });

  it("requires unique keys used by upserts instead of quietly creating indexes", async () => {
    await database.execute('DROP TABLE "CustomerNodeMapping"');
    await database.execute('CREATE TABLE "CustomerNodeMapping" (id TEXT PRIMARY KEY,account TEXT,accountKey TEXT,nodeName TEXT,accountAddress TEXT,createdAt DATETIME,updatedAt DATETIME)');
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("mapping")).rejects.toThrow(/unique.*CustomerNodeMapping/i);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("accepts reordered equivalent unique keys supported by SQLite upserts", async () => {
    await database.execute('DROP INDEX "idx_kpi_daily_report_ctv_metric"');
    await database.execute('CREATE UNIQUE INDEX fixture_reordered ON KpiDailyResult(kpiCode,ctvUser,reportDate)');
    await database.execute("INSERT INTO KpiDailyResult(reportDate,ctvUser,kpiCode) VALUES ('2026-10-25','fixture','metric') ON CONFLICT(reportDate,ctvUser,kpiCode) DO NOTHING");
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("kpi")).resolves.toBeUndefined();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each(["partial", "expression"])("does not treat a %s unique index as an unconditional column key", async (kind) => {
    await database.execute('DROP TABLE "CustomerNodeMapping"');
    await database.execute('CREATE TABLE "CustomerNodeMapping" (id TEXT PRIMARY KEY,account TEXT,accountKey TEXT,nodeName TEXT,accountAddress TEXT,createdAt DATETIME,updatedAt DATETIME)');
    await database.execute(kind === "partial" ? 'CREATE UNIQUE INDEX fixture_key ON CustomerNodeMapping(accountKey) WHERE accountKey IS NOT NULL' : 'CREATE UNIQUE INDEX fixture_key ON CustomerNodeMapping(LOWER(accountKey))');
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("mapping")).rejects.toThrow(/unique.*CustomerNodeMapping/i);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("missing system metrics fail closed without reseeding them during GET readiness", async () => {
    await database.execute("DELETE FROM KpiMetricConfig WHERE kpiCode='CUOC_N1_N3_RATE'");
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("kpi")).rejects.toThrow(/CUOC_N1_N3_RATE/);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect((await database.execute("SELECT COUNT(*) AS count FROM KpiMetricConfig")).rows[0].count).toBe(0);
  });

  it("structural checks for backup do not bypass full default validation", async () => {
    await database.execute("DELETE FROM KpiMetricConfig WHERE kpiCode='CUOC_N1_N3_RATE'");
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("kpi", { requireDefaults: false })).resolves.toBeUndefined();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    await expect(ensureRuntimeSchema("kpi")).rejects.toThrow(/CUOC_N1_N3_RATE/);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("does not cache a failed check or expose database errors/credentials", async () => {
    mocks.query.mockRejectedValueOnce(new Error("private driver failure token=DO_NOT_EXPOSE"));
    const { ensureRuntimeSchema } = await runtime();
    const failure = await ensureRuntimeSchema("kpi").catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/SCHEMA_NOT_READY/);
    expect((failure as Error).message).not.toContain("DO_NOT_EXPOSE");
    await expect(ensureRuntimeSchema("kpi")).resolves.toBeUndefined();
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("adequate untracked schema can be read but is not adopted for migration", async () => {
    await database.execute('DROP TABLE "_AppMigration"');
    const { ensureRuntimeSchema } = await runtime();
    await ensureRuntimeSchema("kpi");
    expect(mocks.execute).not.toHaveBeenCalled();
    const { applyMigrations, loadMigrations } = await migrations();
    await expect(applyMigrations(database, await loadMigrations(path.join(root, "prisma/migrations")), url)).rejects.toThrow(/untracked/i);
    expect((await database.execute("SELECT name FROM sqlite_master WHERE name='_AppMigration'")).rows).toEqual([]);
  });

  it("release migration preserves manually configured rates and disabled system metrics", async () => {
    const { applyMigrations, loadMigrations } = await migrations();
    const catalog = await loadMigrations(path.join(root, "prisma/migrations"));
    expect(catalog).toHaveLength(5);
    await database.execute("UPDATE CuocConfig SET targetRatePercent=89 WHERE id=1");
    await database.execute("UPDATE CuocCdConfig SET targetRatePercent=94 WHERE id=1");
    await database.execute("UPDATE KpiMetricConfig SET isEnabled=0,baseScore=7 WHERE kpiCode='CUOC_N1_N3_RATE'");
    await database.execute({ sql: "DELETE FROM _AppMigration WHERE version=?", args: [catalog[4].version] });
    await applyMigrations(database, catalog, url);
    expect((await database.execute("SELECT targetRatePercent FROM CuocConfig")).rows[0].targetRatePercent).toBe(89);
    expect((await database.execute("SELECT targetRatePercent FROM CuocCdConfig")).rows[0].targetRatePercent).toBe(94);
    expect((await database.execute("SELECT isEnabled,baseScore FROM KpiMetricConfig WHERE kpiCode='CUOC_N1_N3_RATE'")).rows).toEqual([{ isEnabled: 0, baseScore: 7 }]);
    const { ensureRuntimeSchema } = await runtime();
    await expect(ensureRuntimeSchema("kpi")).resolves.toBeUndefined();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("CLI checks all domains on adequate untracked schema without adoption or writes", async () => {
    await database.execute('DROP TABLE "_AppMigration"');
    const schemaBefore = (await database.execute("SELECT name,sql FROM sqlite_master ORDER BY name")).rows;
    const defaultsBefore = (await database.execute("SELECT * FROM KpiMetricConfig")).rows;
    const result = preflight();
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ ready: true, readOnly: true, reads: 8 });
    expect(report.domains).toHaveLength(7);
    expect((await database.execute("SELECT name,sql FROM sqlite_master ORDER BY name")).rows).toEqual(schemaBefore);
    expect((await database.execute("SELECT * FROM KpiMetricConfig")).rows).toEqual(defaultsBefore);
  });

  it("CLI rejects missing targets/unknown domains and never creates an absent database file", () => {
    const missingFile = path.join(path.dirname(url.slice(5)), "missing.sqlite");
    expect(preflight(`file:${missingFile.replaceAll("\\", "/")}`).status).not.toBe(0);
    expect(existsSync(missingFile)).toBe(false);
    expect(preflight(undefined, ["--domain", "unknown"]).status).not.toBe(0);
    const absent = preflight("");
    expect(absent.status).not.toBe(0);
    expect(absent.stderr).toContain("DATABASE_URL");
    const remote = preflight("libsql://not-contacted.invalid");
    expect(remote.status).not.toBe(0);
    expect(remote.stderr).toContain("--allow-remote");
    expect(remote.stderr).not.toContain("not-contacted.invalid");
  });

  it("CLI reports missing defaults but does not silently reseed them", async () => {
    await database.execute("DELETE FROM KpiMetricConfig WHERE kpiCode='CUOC_N1_N3_RATE'");
    const result = preflight(url, ["--domain", "kpi"]);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ready: false, readOnly: true, domains: [{ domain: "kpi", ready: false, missing: ["CUOC_N1_N3_RATE"] }] });
    expect((await database.execute("SELECT COUNT(*) AS count FROM KpiMetricConfig")).rows[0].count).toBe(0);
  });
});
