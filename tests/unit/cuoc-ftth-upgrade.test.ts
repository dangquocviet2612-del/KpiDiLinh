import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations, getMigrationStatus, loadMigrations } from "../../scripts/lib/migration-runner.mjs";
import { runtimeSchemaDomains, validateRuntimeSchema } from "@/lib/runtime-schema-check.mjs";

type Statement = string | { sql: string; args?: SQLInputValue[] };
type Migration = Awaited<ReturnType<typeof loadMigrations>>[number];
const version = "20261031000000_add_cuoc_ftth";
let database: DatabaseSync;
let directory: string;
let parent: string;
let url: string;
let catalog: Migration[];
let client: ReturnType<typeof createFixtureClient>;
let validationSql: string[];

function createFixtureClient(connection: DatabaseSync) {
  const execute = async (input: Statement) => {
    const sql = typeof input === "string" ? input : input.sql;
    const args = typeof input === "string" ? [] : input.args || [];
    const prepared = connection.prepare(sql);
    if (prepared.columns().length) return { rows: prepared.all(...args), rowsAffected: 0 };
    return { rows: [], rowsAffected: Number(prepared.run(...args).changes) };
  };
  return {
    execute,
    transaction: async () => {
      connection.exec("BEGIN IMMEDIATE");
      let closed = false;
      return {
        execute,
        batch: async (statements: Statement[]) => {
          const results = [];
          for (const statement of statements) results.push(await execute(statement));
          return results;
        },
        get closed() { return closed; },
        commit: async () => { connection.exec("COMMIT"); closed = true; },
        rollback: async () => { connection.exec("ROLLBACK"); closed = true; },
        close: () => { if (!closed) { connection.exec("ROLLBACK"); closed = true; } },
      };
    },
  };
}

function tables() {
  return database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name")
    .all().map((row) => String(row.name));
}

function rows(table: string) {
  return database.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}" ORDER BY rowid`).all();
}

function schema() {
  return database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name").all();
}

function snapshot(names = tables()) {
  return { schema: schema(), tables: Object.fromEntries(names.map((table) => [table, rows(table)])) };
}

function seedLegacyData() {
  database.exec(`
    INSERT INTO User(id,username,password,role,updatedAt) VALUES('fixture-user','fixture-ctv','fixture-hash','CTV','2026-10-30');
    INSERT INTO Customer(id,name,subscriberType,account,ctvCode,updatedAt) VALUES('fixture-customer','Fixture customer','FTTH','fixture-account','fixture-ctv','2026-10-30');
    INSERT INTO Node(id,name,latitude,longitude) VALUES('fixture-node','FIXTURE-NODE',11.5,108.1);
    INSERT INTO CuocCdDailyResult(reportDate,ctvUser,employeeCodeRaw,dauKy,luyKe) VALUES('2026-10-30','fixture-ctv','NV-FIXTURE',100.5,50.13);
    INSERT INTO KpiDailyResult(reportDate,ctvUser,kpiCode) VALUES('2026-10-30','fixture-ctv','FIXTURE_METRIC');
    UPDATE CuocCdConfig SET targetRatePercent=91 WHERE id=1;
    UPDATE CuocConfig SET targetRatePercent=87 WHERE id=1;
    UPDATE KpiMetricConfig SET isEnabled=0,baseScore=7 WHERE kpiCode='CUOC_N1_N3_RATE';
  `);
}

async function legacyDatabase() {
  await applyMigrations(client, catalog.slice(0, -1), url);
  seedLegacyData();
}

const query = async (sql: string, args: SQLInputValue[]) => {
  validationSql.push(sql);
  return database.prepare(sql).all(...args);
};

function expectReadOnlyMetadata(count: number) {
  expect(validationSql).toHaveLength(count);
  for (const sql of validationSql) expect(sql).toMatch(/^\s*SELECT\b/i);
}

beforeEach(async () => {
  validationSql = [];
  parent = realpathSync(tmpdir());
  directory = mkdtempSync(path.join(parent, "cuoc-ftth-upgrade-"));
  const filename = path.join(directory, "fixture.sqlite");
  url = pathToFileURL(filename).href;
  database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys=ON");
  client = createFixtureClient(database);
  catalog = await loadMigrations(path.join(process.cwd(), "prisma/migrations"));
  expect(catalog).toHaveLength(6);
  expect(catalog.at(-1)?.version).toBe(version);
});

afterEach(() => {
  database?.close();
  if (!directory) return;
  const resolved = realpathSync(directory);
  expect(path.dirname(resolved)).toBe(parent);
  expect(path.basename(resolved)).toMatch(/^cuoc-ftth-upgrade-/);
  rmSync(resolved, { recursive: true, force: true });
});

describe("FTTH release migration on synthetic persistent SQLite", () => {
  it("initializes all six migrations and validates eight domains with read-only metadata", async () => {
    const result = await applyMigrations(client, catalog, url);
    expect(result).toEqual({ applied: catalog.map((migration) => migration.version), skipped: [] });
    expect(await getMigrationStatus(client, catalog)).toMatchObject({ state: "current", pending: [] });
    expect(rows("CuocFtthConfig")[0].targetRatePercent).toBe(99.5);
    const before = snapshot();
    let reads = 0;
    expect(runtimeSchemaDomains).toHaveLength(8);
    for (const domain of runtimeSchemaDomains) {
      await validateRuntimeSchema(async (sql: string, args: SQLInputValue[]) => { reads += 1; return query(sql, args); }, domain);
    }
    expect(reads).toBe(9);
    expectReadOnlyMetadata(9);
    expect(snapshot()).toEqual(before);
  });

  it("upgrades five to six without changing legacy data, custom rates, schema or ledger history", async () => {
    await legacyDatabase();
    const legacyTables = tables().filter((table) => table !== "_AppMigration");
    const before = snapshot(legacyTables);
    const ledger = rows("_AppMigration");
    expect(await getMigrationStatus(client, catalog)).toMatchObject({ state: "pending", pending: [version] });
    expect(await applyMigrations(client, catalog, url)).toEqual({ applied: [version], skipped: catalog.slice(0, -1).map((migration) => migration.version) });
    expect(snapshot(legacyTables).tables).toEqual(before.tables);
    expect(schema().filter((row) => !String(row.name).startsWith("CuocFtth"))).toEqual(before.schema);
    expect(rows("_AppMigration").slice(0, -1)).toEqual(ledger);
    expect(rows("_AppMigration").at(-1)).toMatchObject({ version, checksum: catalog.at(-1)?.checksum });
    expect(rows("CuocFtthDailyResult")).toEqual([]);
    expect(rows("CuocFtthConfig")[0].targetRatePercent).toBe(99.5);
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    await expect(validateRuntimeSchema(query, "cuocFtth")).resolves.toBeUndefined();
    expectReadOnlyMetadata(1);
  });

  it("skips all applied versions without resetting an edited FTTH target or imported rows", async () => {
    await applyMigrations(client, catalog, url);
    database.exec(`UPDATE CuocFtthConfig SET targetRatePercent=84 WHERE id=1;
      INSERT INTO CuocFtthDailyResult(reportDate,ctvUser,employeeCodeRaw,dauKy,luyKe) VALUES('2026-11-01','fixture-ctv','NV-FIXTURE',100,90)`);
    const before = snapshot();
    expect(await applyMigrations(client, catalog, url)).toEqual({ applied: [], skipped: catalog.map((migration) => migration.version) });
    expect(snapshot()).toEqual(before);
  });

  it.each(["missing", "empty", "checksum", "order"] as const)("refuses an invalid %s ledger without adopting, applying or changing business data", async (failure) => {
    await legacyDatabase();
    if (failure === "missing") database.exec('DROP TABLE "_AppMigration"');
    if (failure === "empty") database.exec('DELETE FROM "_AppMigration"');
    if (failure === "checksum") database.prepare('UPDATE "_AppMigration" SET checksum=? WHERE version=?').run("fixture-invalid-checksum", catalog[0].version);
    if (failure === "order") database.prepare('DELETE FROM "_AppMigration" WHERE version=?').run(catalog[1].version);
    const before = snapshot();
    const expected = { missing: /Untracked/, empty: /Empty migration ledger/, checksum: /checksum mismatch/, order: /out-of-order/ }[failure];
    await expect(applyMigrations(client, catalog, url)).rejects.toThrow(expected);
    expect(snapshot()).toEqual(before);
    expect(tables()).not.toContain("CuocFtthConfig");
  });

  it("rolls back partially executed FTTH SQL and leaves its ledger version pending on failure", async () => {
    await legacyDatabase();
    const before = snapshot();
    const injected = catalog.map((migration) => migration.version === version ? {
      ...migration, statements: [...migration.statements, 'INSERT INTO "FixtureMissingTable" (id) VALUES (1)'],
    } : migration);
    await expect(applyMigrations(client, injected, url)).rejects.toThrow(/FixtureMissingTable/);
    expect(snapshot()).toEqual(before);
    expect(await getMigrationStatus(client, catalog)).toMatchObject({ state: "pending", pending: [version] });
  });

  it("rejects FTTH readiness before upgrade without making existing KPI readiness depend on FTTH", async () => {
    await legacyDatabase();
    const before = snapshot();
    await expect(validateRuntimeSchema(query, "cuocFtth")).rejects.toThrow(/SCHEMA_NOT_READY.*cuocFtth/);
    await expect(validateRuntimeSchema(query, "kpi")).resolves.toBeUndefined();
    expectReadOnlyMetadata(3);
    expect(snapshot()).toEqual(before);
  });

  it.each(["column", "unique"])("fails closed on a missing FTTH %s without repairing it", async (failure) => {
    await applyMigrations(client, catalog, url);
    database.exec(failure === "column" ? 'ALTER TABLE "CuocFtthDailyResult" DROP COLUMN "luyKe"' : 'DROP INDEX "CuocFtthDailyResult_reportDate_employeeCodeRaw_key"');
    const before = snapshot();
    await expect(validateRuntimeSchema(query, "cuocFtth")).rejects.toThrow(failure === "column" ? /CuocFtthDailyResult\.luyKe/ : /unique:CuocFtthDailyResult/);
    expectReadOnlyMetadata(1);
    expect(snapshot()).toEqual(before);
  });
});
