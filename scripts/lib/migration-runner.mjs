import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ledger = "_AppMigration";

export function assertPersistentTarget(databaseUrl) {
  let decoded;
  try { decoded = decodeURIComponent(databaseUrl); } catch { throw new Error("Explicit persistent database target required for apply"); }
  if (typeof databaseUrl !== "string" || !/^(?:file:|libsql:\/\/|https:\/\/)/.test(databaseUrl) || /[\u0000-\u001f\u007f]|:memory:|[?&]mode=memory(?:&|$)/i.test(decoded)) {
    throw new Error("Explicit persistent database target required for apply");
  }
  if (databaseUrl.startsWith("file:")) {
    const local = decoded.slice(5).split(/[?#]/, 1)[0];
    const filename = local.startsWith("//") ? local.slice(2).replace(/^[^/]*(?=\/|$)/, "") : local;
    if (!filename.trim()) throw new Error("Explicit persistent database target required for apply");
    resolveLocalDatabasePath(databaseUrl);
  }
}

export function resolveLocalDatabasePath(databaseUrl) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:") || /[?#]/.test(databaseUrl)) throw new Error("Unsupported local database URL");
  let decoded;
  try { decoded = decodeURIComponent(databaseUrl.slice(5)); } catch { throw new Error("Unsupported local database URL"); }
  if (/[\u0000-\u001f\u007f]/.test(decoded)) throw new Error("Unsupported local database URL");
  let filename;
  if (databaseUrl.startsWith("file://")) {
    const address = new URL(databaseUrl);
    if (address.hostname && address.hostname !== "localhost") throw new Error("Network/UNC file targets are unsupported");
    if (/^(?:\\\\|\/\/)/.test(decodeURIComponent(address.pathname))) throw new Error("Network/UNC file targets are unsupported");
    filename = fileURLToPath(address);
  } else filename = decoded;
  if (/^(?:\\\\|\/\/)/.test(filename)) throw new Error("Network/UNC file targets are unsupported");
  const resolved = path.resolve(filename);
  if (/^(?:\\\\|\/\/)/.test(resolved)) throw new Error("Network/UNC file targets are unsupported");
  return resolved;
}

export function splitSqlStatements(sql) {
  const statements = [];
  let buffer = "";
  let quote = "";
  let comment = "";
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (comment === "line") {
      if (character === "\n") { comment = ""; buffer += "\n"; }
    } else if (comment === "block") {
      if (character === "*" && next === "/") { comment = ""; index += 1; }
    } else if (quote) {
      buffer += character;
      if (character === quote) {
        if (quote !== "]" && next === quote) { buffer += next; index += 1; }
        else quote = "";
      }
    } else if (character === "-" && next === "-") { comment = "line"; buffer += " "; index += 1; }
    else if (character === "/" && next === "*") { comment = "block"; buffer += " "; index += 1; }
    else if (["'", '"', "`", "["].includes(character)) { quote = character === "[" ? "]" : character; buffer += character; }
    else if (character === ";") { if (buffer.trim()) statements.push(buffer.trim()); buffer = ""; }
    else buffer += character;
  }
  if (quote || comment === "block") throw new Error("Unterminated SQL quote or comment");
  if (buffer.trim()) statements.push(buffer.trim());
  for (const statement of statements) {
    if (/^(?:BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA|ATTACH|DETACH|VACUUM)\b|^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(statement)) {
      throw new Error("Migration contains unsupported transaction controls, PRAGMA, or trigger SQL");
    }
  }
  return statements;
}

export async function loadMigrations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const versions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const migrations = [];
  for (const version of versions) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(version)) throw new Error("Invalid migration version");
    let sql;
    try { sql = await readFile(path.join(directory, version, "migration.sql"), "utf8"); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const normalized = sql.replace(/\r\n?/g, "\n");
    const statements = splitSqlStatements(normalized);
    if (!statements.length) throw new Error(`Empty migration: ${version}`);
    migrations.push({ version, checksum: createHash("sha256").update(normalized).digest("hex"), statements });
  }
  if (!migrations.length) throw new Error("No migrations found");
  return migrations;
}

export async function getMigrationStatus(client, migrations) {
  const objects = (await client.execute("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT GLOB 'sqlite_*' ORDER BY name")).rows.map((row) => String(row.name));
  if (!objects.includes(ledger)) {
    return { state: objects.length ? "untracked" : "empty", applied: [], pending: migrations.map((migration) => migration.version) };
  }
  const records = (await client.execute(`SELECT "version", "checksum" FROM "${ledger}" ORDER BY "version"`)).rows;
  if (!records.length && objects.some((name) => name !== ledger)) throw new Error("Empty migration ledger cannot adopt an existing schema");
  for (const [index, record] of records.entries()) {
    const migration = migrations[index];
    if (!migration || migration.version !== record.version) throw new Error("Unknown or out-of-order migration ledger version");
    if (migration.checksum !== record.checksum) throw new Error(`Migration checksum mismatch: ${migration.version}`);
  }
  return { state: records.length === migrations.length ? "current" : "pending", applied: records.map((record) => String(record.version)), pending: migrations.slice(records.length).map((migration) => migration.version) };
}

async function compatibleStatements(transaction, migration) {
  if (migration.version !== "20260920000000_consolidated_schema") return migration.statements;
  const duplicate = 'ALTER TABLE "Customer" ADD COLUMN "expirationDate" DATETIME';
  if (!migration.statements.includes(duplicate)) return migration.statements;
  const columns = (await transaction.execute('PRAGMA table_info("Customer")')).rows;
  const existing = columns.find((column) => column.name === "expirationDate");
  if (!existing) return migration.statements;
  if (String(existing.type).toUpperCase() !== "DATETIME" || Number(existing.notnull) !== 0 || existing.dflt_value !== null || Number(existing.pk) !== 0) {
    throw new Error("Historical Customer.expirationDate column does not match expected schema");
  }
  return migration.statements.filter((statement) => statement !== duplicate);
}

async function applyVersion(client, migrations, migration) {
  let transaction;
  try {
    transaction = await client.transaction("write");
    const status = await getMigrationStatus(transaction, migrations);
    if (status.state === "untracked") throw new Error("Untracked existing database: verified baseline/adoption is required before migration");
    if (status.applied.includes(migration.version)) { await transaction.rollback(); return false; }
    if (status.pending[0] !== migration.version) throw new Error("Migration application order changed");
    const statements = await compatibleStatements(transaction, migration);
    await transaction.batch([
      `CREATE TABLE IF NOT EXISTS "${ledger}" ("version" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      ...statements,
      { sql: `INSERT INTO "${ledger}" ("version", "checksum") VALUES (?, ?)`, args: [migration.version, migration.checksum] },
    ]);
    const violations = await transaction.execute("PRAGMA foreign_key_check");
    if (violations.rows.length) throw new Error("Migration failed foreign key validation");
    await transaction.commit();
    return true;
  } catch (error) {
    if (transaction && !transaction.closed) await transaction.rollback();
    throw error;
  } finally {
    transaction?.close();
  }
}

export async function applyMigrations(client, migrations, databaseUrl) {
  assertPersistentTarget(databaseUrl);
  const initial = await getMigrationStatus(client, migrations);
  if (initial.state === "untracked") throw new Error("Untracked existing database: verified baseline/adoption is required before migration");
  const result = { applied: [], skipped: [] };
  for (const migration of migrations) {
    let applied;
    for (let attempt = 0; ; attempt += 1) {
      try { applied = await applyVersion(client, migrations, migration); break; }
      catch (error) {
        if (!/^SQLITE_(?:BUSY|LOCKED)/.test(String(error.code || error.cause?.code || "")) || attempt >= 7) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(25 * 2 ** attempt, 250)));
      }
    }
    result[applied ? "applied" : "skipped"].push(migration.version);
  }
  return result;
}
