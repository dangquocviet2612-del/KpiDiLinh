import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyMigrations, assertPersistentTarget, getMigrationStatus, loadMigrations, resolveLocalDatabasePath } from "./lib/migration-runner.mjs";

function localPath(url) {
  if (url === "file::memory:") return null;
  if (/[?#]/.test(url)) throw new Error("Local database URL options are unsupported");
  return resolveLocalDatabasePath(url);
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Migration safety: --check (default), --apply, --allow-remote. DATABASE_URL must be explicit in the process environment; env files are not auto-loaded. Existing databases without a verified ledger are refused. No baseline command is provided.");
    return;
  }
  if (new Set(args).size !== args.length || args.some((argument) => !["--check", "--apply", "--allow-remote"].includes(argument)) || (args.includes("--check") && args.includes("--apply"))) {
    throw new Error("Invalid migration arguments; use --help");
  }
  const url = environment.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be explicit in the process environment; env files are not auto-loaded");
  const local = url.startsWith("file:");
  if (!local && !url.startsWith("libsql://") && !url.startsWith("https://")) throw new Error("Unsupported database URL scheme");
  if (!local && !args.includes("--allow-remote")) throw new Error("Remote database requires --allow-remote and separate release approval");
  const apply = args.includes("--apply");
  if (apply) assertPersistentTarget(url);
  const migrations = await loadMigrations(fileURLToPath(new URL("../prisma/migrations", import.meta.url)));
  const file = local ? localPath(url) : null;
  if (!apply && file && !existsSync(file)) {
    console.log(JSON.stringify({ mode: "check", state: "empty", applied: [], pending: migrations.map((migration) => migration.version) }));
    return;
  }
  let client;
  try {
    client = createClient({ url, authToken: local ? undefined : environment.TURSO_AUTH_TOKEN });
    const status = apply ? await applyMigrations(client, migrations, url) : await getMigrationStatus(client, migrations);
    if (status.state === "untracked") throw new Error("Untracked existing database: verified baseline/adoption is required before migration");
    console.log(JSON.stringify({ mode: apply ? "apply" : "check", ...status }));
  } catch (error) {
    if (/^(?:Untracked|Empty migration ledger|Unknown or out-of-order|Migration checksum|Historical Customer)/.test(String(error.message))) throw error;
    throw new Error("Migration database operation failed; no SQL, credentials or database URL are printed. Inspect only a synthetic fixture before retrying.");
  } finally {
    client?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
