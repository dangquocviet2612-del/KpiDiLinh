import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";
import { assertPersistentTarget, resolveLocalDatabasePath } from "./lib/migration-runner.mjs";
import { runtimeSchemaDomains, validateRuntimeSchema } from "../src/lib/runtime-schema-check.mjs";

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length === 1 && argumentsList[0] === "--help") {
    console.log("Read-only schema preflight: --domain <name> (default all), --allow-remote. Set DATABASE_URL explicitly in the process. Does not load env files, migrate, seed, adopt, or print credentials/data.");
    return;
  }
  let domain;
  let allowRemote = false;
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === "--allow-remote" && !allowRemote) allowRemote = true;
    else if (argumentsList[index] === "--domain" && !domain) domain = argumentsList[++index];
    else throw new Error("Invalid preflight arguments; use --help");
  }
  if (argumentsList.includes("--domain") && (!domain || !runtimeSchemaDomains.includes(domain))) throw new Error("Invalid preflight domain");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be explicit; env files are not auto-loaded");
  assertPersistentTarget(url);
  const local = url.startsWith("file:");
  if (!local && !allowRemote) throw new Error("Remote preflight requires --allow-remote and separate approval");
  if (local) {
    if (/[?#]/.test(url)) throw new Error("Local database URL options are unsupported");
    const file = resolveLocalDatabasePath(url);
    if (!existsSync(file)) throw new Error("SCHEMA_NOT_READY: database file does not exist");
  }
  let client;
  try {
    client = createClient({ url, authToken: local ? undefined : process.env.TURSO_AUTH_TOKEN });
    const results = [];
    let reads = 0;
    const query = async (sql, args) => { reads += 1; return (await client.execute({ sql, args })).rows; };
    for (const target of domain ? [domain] : runtimeSchemaDomains) {
      try { await validateRuntimeSchema(query, target); results.push({ domain: target, ready: true }); }
      catch (error) { results.push({ domain: target, ready: false, missing: error.missing || ["metadata_unavailable"] }); }
    }
    const ready = results.every((result) => result.ready);
    console.log(JSON.stringify({ ready, readOnly: true, reads, domains: results }));
    if (!ready) process.exitCode = 1;
  } catch {
    throw new Error("Schema preflight failed; database URL, credentials, SQL and data are not printed");
  } finally {
    client?.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
