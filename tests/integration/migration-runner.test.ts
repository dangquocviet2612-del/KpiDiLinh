import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type Migration = { version: string; checksum: string; statements: string[] };
type Runner = {
  loadMigrations: (directory: string) => Promise<Migration[]>;
  splitSqlStatements: (sql: string) => string[];
  getMigrationStatus: (client: Client, migrations: Migration[]) => Promise<{ state: string; pending: string[]; applied: string[] }>;
  applyMigrations: (client: Client, migrations: Migration[]) => Promise<{ applied: string[]; skipped: string[] }>;
};
const root = process.cwd();
const fixtureRoot = path.join(root, ".local/performance/migration-fixtures");
const temporary: string[] = [];
const clients: Client[] = [];
const targets = new WeakMap<Client, string>();
let runner: Runner;
let applyWithTarget: (client: Client, migrations: Migration[], databaseUrl: string) => Promise<unknown>;
let assertTarget: (databaseUrl: string) => void;

function database() {
  mkdirSync(fixtureRoot, { recursive: true });
  const directory = mkdtempSync(path.join(fixtureRoot, "fixture-"));
  temporary.push(directory);
  const url = `file:${path.join(directory, "fixture.sqlite").replaceAll("\\", "/")}`;
  const client = createClient({ url });
  clients.push(client);
  targets.set(client, url);
  return { client, url, directory };
}

function cli(url: string | undefined, args: string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env, TURSO_AUTH_TOKEN: "" };
  if (url) Object.assign(env, { DATABASE_URL: url });
  else delete env.DATABASE_URL;
  return spawnSync(process.execPath, [path.join(root, "scripts/migrate.mjs"), ...args], { cwd: root, env, encoding: "utf8", timeout: 20_000 });
}

async function tables(client: Client) {
  return (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name")).rows.map((row) => String(row.name));
}

beforeAll(async () => {
  const modulePath = path.join(root, "scripts/lib/migration-runner.mjs");
  if (existsSync(modulePath)) {
    const loaded = await import(pathToFileURL(modulePath).href);
    applyWithTarget = loaded.applyMigrations;
    assertTarget = loaded.assertPersistentTarget;
    runner = { ...loaded, applyMigrations: (client, migrations) => loaded.applyMigrations(client, migrations, targets.get(client)) };
  }
});

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  for (const directory of temporary.splice(0)) {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(fixtureRoot) + path.sep)) throw new Error("Fixture cleanup path escaped");
    if (process.platform !== "win32") rmSync(resolved, { recursive: true, force: true });
  }
});

describe("release migration safety", () => {
  it("check is read-only on an empty database", async () => {
    const { client, url } = database();
    const result = cli(url, ["--check"]);
    expect(result.status, result.stderr).toBe(0);
    expect(await tables(client)).toEqual([]);
  });

  it("refuses an untracked existing database before any DDL or data changes", async () => {
    const { client, url } = database();
    await client.execute('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "username" TEXT)');
    await client.execute("INSERT INTO User VALUES ('fixture-id', 'fixture-user')");
    const result = cli(url, ["--apply"]);
    expect(result.status).not.toBe(0);
    expect(await tables(client)).toEqual(["User"]);
    expect((await client.execute("SELECT * FROM User")).rows).toEqual([{ id: "fixture-id", username: "fixture-user" }]);
  });

  it("does not auto-load env files or default to a database when no target is explicit", () => {
    const result = cli(undefined, ["--check"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATABASE_URL");
    expect(result.stdout).not.toContain("Connecting to database");
  });

  it("never contacts a remote database without an explicit opt-in", () => {
    const result = cli("libsql://example.invalid", ["--apply"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--allow-remote");
    expect(result.stderr).not.toContain("example.invalid");
  });

  it.each(["table", "view"])("refuses sqlite-prefix-lookalike %s objects instead of adopting them", async (kind) => {
    const { client, url } = database();
    await client.execute(kind === "table" ? "CREATE TABLE sqliteXbusiness (id TEXT)" : "CREATE VIEW sqliteXbusiness AS SELECT 'fixture' AS id");
    const before = (await client.execute("SELECT name,sql FROM sqlite_master ORDER BY name")).rows;
    const result = cli(url, ["--apply"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/untracked/i);
    expect((await client.execute("SELECT name,sql FROM sqlite_master ORDER BY name")).rows).toEqual(before);
  });

  it("rejects private in-memory apply before opening or changing a database", () => {
    const result = cli("file::memory:", ["--apply"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/persistent/i);
  });

  it.each(["file:%5C%5Cfixture-only.invalid%5Cshare%5Cfixture.sqlite", "file://fixture-only.invalid/share/fixture.sqlite", "file:////fixture-only.invalid/share/fixture.sqlite"])("rejects network/UNC target %s without touching a filesystem or client", (target) => {
    expect(() => assertTarget(target)).toThrow(/UNC/);
    try { assertTarget(target); } catch (error) { expect((error as Error).message).not.toContain("fixture-only.invalid"); }
  });

  it.each(["file:", "file://localhost", "file:?cache=shared", "file:%00", "file:%00fixture"])("rejects empty or invalid parsed filename %s before CLI connection or core queries", async (url) => {
    const result = cli(url, ["--apply"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/persistent/i);
    const execute = vi.fn(async () => ({ rows: [] }));
    await expect(applyWithTarget({ execute } as unknown as Client, [], url)).rejects.toThrow(/persistent/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it("checks a missing local file without creating it and rejects unknown flags", () => {
    const { directory } = database();
    const missing = path.join(directory, "absent.sqlite");
    expect(cli(`file:${missing.replaceAll("\\", "/")}`, ["--check"]).status).toBe(0);
    expect(existsSync(missing)).toBe(false);
    expect(cli(`file:${missing.replaceAll("\\", "/")}`, ["--baseline"]).status).not.toBe(0);
    expect(existsSync(missing)).toBe(false);
  });

  it("CLI defaults to check and explicit apply can be safely repeated", async () => {
    const { client, url } = database();
    expect(cli(url).status).toBe(0);
    expect(await tables(client)).toEqual([]);
    const applied = cli(url, ["--apply"]);
    expect(applied.status, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout).applied).toHaveLength((await runner.loadMigrations(path.join(root, "prisma/migrations"))).length);
    await client.execute("INSERT INTO Node0Tb (id,nodeCode) VALUES ('CLI_FIXTURE_ID','CLI_FIXTURE')");
    const second = cli(url, ["--apply"]);
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).applied).toEqual([]);
    expect((await client.execute("SELECT id FROM Node0Tb")).rows).toEqual([{ id: "CLI_FIXTURE_ID" }]);
  });

  it("applies real migrations once, records checksums, and never replays the Node0TB rebuild", async () => {
    const { client } = database();
    const migrations = await runner.loadMigrations(path.join(root, "prisma/migrations"));
    expect((await runner.getMigrationStatus(client, migrations)).state).toBe("empty");
    expect((await runner.applyMigrations(client, migrations)).applied).toHaveLength(migrations.length);
    await client.execute("INSERT INTO Node0Tb (id,nodeCode) VALUES ('fixture-text-id','FIXTURE_NODE')");
    const before = await client.execute('SELECT * FROM "Node0Tb"');
    const ledger = await client.execute('SELECT * FROM "_AppMigration" ORDER BY version');
    const second = await runner.applyMigrations(client, migrations);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toHaveLength(migrations.length);
    expect((await client.execute('SELECT * FROM "Node0Tb"')).rows).toEqual(before.rows);
    expect((await client.execute('SELECT * FROM "_AppMigration" ORDER BY version')).rows).toEqual(ledger.rows);
    expect((await runner.getMigrationStatus(client, migrations)).state).toBe("current");
  });

  it("rejects checksum drift and unknown or non-prefix ledger versions without changing the ledger", async () => {
    const { client } = database();
    const migrations = await runner.loadMigrations(path.join(root, "prisma/migrations"));
    await runner.applyMigrations(client, migrations);
    const altered = migrations.map((migration, index) => index ? migration : { ...migration, checksum: "0".repeat(64) });
    await expect(runner.applyMigrations(client, altered)).rejects.toThrow(/checksum/i);
    await client.execute({ sql: "UPDATE _AppMigration SET version='unknown-version' WHERE version=?", args: [migrations[0].version] });
    await expect(runner.getMigrationStatus(client, migrations)).rejects.toThrow(/unknown|order/i);
  });

  it.each(["drop", "rename"])("rolls back rebuild after %s and its ledger record, then retries safely", async (stage) => {
    const { client } = database();
    const migrations = await runner.loadMigrations(path.join(root, "prisma/migrations"));
    await runner.applyMigrations(client, migrations.slice(0, 3));
    await client.execute("INSERT INTO Node0Tb (id,nodeCode) VALUES ('42','ROLLBACK_FIXTURE')");
    const before = (await client.execute("SELECT * FROM Node0Tb")).rows;
    const broken = { ...migrations[3], statements: [...migrations[3].statements] };
    const failureIndex = broken.statements.findIndex((statement) => stage === "drop" ? /DROP TABLE IF EXISTS "Node0Tb"/.test(statement) : /RENAME TO "Node0Tb"/.test(statement));
    expect(failureIndex).toBeGreaterThanOrEqual(0);
    broken.statements.splice(failureIndex + 1, 0, "SELECT * FROM fixture_missing_table");
    await expect(runner.applyMigrations(client, [...migrations.slice(0, 3), broken])).rejects.toThrow();
    expect((await client.execute("SELECT * FROM Node0Tb")).rows).toEqual(before);
    expect(await tables(client)).not.toContain("Node0Tb_new");
    expect((await client.execute("SELECT COUNT(*) AS total FROM _AppMigration")).rows[0].total).toBe(3);
    await runner.applyMigrations(client, migrations);
    expect((await client.execute("SELECT id,nodeCode FROM Node0Tb")).rows).toEqual([{ id: String(before[0].id), nodeCode: "ROLLBACK_FIXTURE" }]);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  });

  it("rolls back a failing first migration including ledger creation", async () => {
    const { client } = database();
    await expect(runner.applyMigrations(client, [{ version: "001_fixture", checksum: "a".repeat(64), statements: ["CREATE TABLE fixture (id TEXT)", "SELECT * FROM fixture_missing_table"] }])).rejects.toThrow();
    expect(await tables(client)).toEqual([]);
  });

  it("refuses a forged empty ledger and a historical column with the wrong definition", async () => {
    const { client } = database();
    const migrations = await runner.loadMigrations(path.join(root, "prisma/migrations"));
    await client.execute('CREATE TABLE "_AppMigration" (version TEXT,checksum TEXT)');
    await client.execute('CREATE TABLE "Customer" (expirationDate TEXT)');
    await expect(runner.applyMigrations(client, migrations)).rejects.toThrow(/empty migration ledger/i);
    await client.execute('DROP TABLE "_AppMigration"');
    await client.execute('DROP TABLE "Customer"');
    const setup = { version: "001_fixture", checksum: "a".repeat(64), statements: ['CREATE TABLE "Customer" (expirationDate TEXT)'] };
    await runner.applyMigrations(client, [setup]);
    await expect(runner.applyMigrations(client, [setup, migrations[1]])).rejects.toThrow(/does not match expected schema/i);
    expect((await client.execute("PRAGMA table_info(Customer)")).rows).toHaveLength(1);
    expect((await client.execute("SELECT COUNT(*) AS total FROM _AppMigration")).rows[0].total).toBe(1);
  });

  it("two independent clients apply each version once under a write transaction", async () => {
    const { client, url } = database();
    const other = createClient({ url });
    clients.push(other);
    targets.set(other, url);
    const migrations = await runner.loadMigrations(path.join(root, "prisma/migrations"));
    const results = await Promise.all([runner.applyMigrations(client, migrations), runner.applyMigrations(other, migrations)]);
    expect(results.reduce((count, result) => count + result.applied.length, 0)).toBe(migrations.length);
    expect((await client.execute("SELECT COUNT(*) AS total FROM _AppMigration")).rows[0].total).toBe(migrations.length);
  });

  it("normalizes line endings for checksums without editing historical SQL", async () => {
    const { directory } = database();
    const fs = await import("node:fs");
    const migrationDirectory = path.join(directory, "001_fixture");
    fs.mkdirSync(migrationDirectory);
    const file = path.join(migrationDirectory, "migration.sql");
    writeFileSync(file, "CREATE TABLE fixture (id TEXT);\r\n");
    const first = await runner.loadMigrations(directory);
    writeFileSync(file, "CREATE TABLE fixture (id TEXT);\n");
    expect((await runner.loadMigrations(directory))[0].checksum).toBe(first[0].checksum);
    expect(first[0].checksum).toBe(createHash("sha256").update(readFileSync(file)).digest("hex"));
  });

  it("splits comments and quoted semicolons, rejecting transaction controls before any execution", () => {
    expect(runner.splitSqlStatements("-- comment;\nCREATE TABLE t ([semi;name] TEXT); INSERT INTO t VALUES ('a;''b'); /* x;y */")).toEqual(["CREATE TABLE t ([semi;name] TEXT)", "INSERT INTO t VALUES ('a;''b')"]);
    for (const sql of ["COMMIT;", "PRAGMA foreign_keys=OFF;", "ATTACH 'x' AS y;", "CREATE TRIGGER tr AFTER INSERT ON t BEGIN SELECT 1; END;", "SELECT 'unterminated", "/* unfinished"]) {
      expect(() => runner.splitSqlStatements(sql)).toThrow();
    }
  });
});
