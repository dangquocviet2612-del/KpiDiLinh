import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertPersistentTarget, resolveLocalDatabasePath, splitSqlStatements } from "../lib/migration-runner.mjs";

const require = createRequire(import.meta.url);
const failureMessage = "KPI EXPLAIN failed; use --database <existing local file URL> with optional --ctv, --report-date and --group values. Target and query values are never printed.";

function parseArguments(args) {
  const allowed = new Set(["--database", "--ctv", "--report-date", "--group"]);
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!allowed.has(option) || values.has(option) || typeof value !== "string" || !value.trim() || value.startsWith("--")) {
      throw new Error(failureMessage);
    }
    values.set(option, value);
  }
  if (!values.has("--database")) throw new Error(failureMessage);
  return {
    database: values.get("--database"),
    ctv: values.get("--ctv") ?? "KPI_EXPLAIN_CTV",
    reportDate: values.get("--report-date") ?? "2000-01-01",
    group: values.get("--group") ?? "KPI_EXPLAIN_GROUP",
  };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = parseArguments(args);
    assertPersistentTarget(options.database);
    const filename = resolveLocalDatabasePath(options.database);
    if (!(await stat(filename)).isFile()) throw new Error(failureMessage);
    const {
      KPI_SUMMARY_METADATA_SQL,
      buildPersonalKpiQuery,
      buildKpiSummaryAggregateQuery,
      buildLatestKpiDateQuery,
    } = require("../../src/lib/kpi-report-queries.ts");
    const queries = [
      { name: "personal-kpi", query: buildPersonalKpiQuery(options.ctv, options.reportDate) },
      { name: "summary-metadata", query: { sql: KPI_SUMMARY_METADATA_SQL, args: [] } },
      { name: "summary-aggregate", query: buildKpiSummaryAggregateQuery(options.reportDate, options.group, [options.ctv]) },
      { name: "latest-kpi-date", query: buildLatestKpiDateQuery(options.ctv) },
    ];
    for (const { query } of queries) {
      if (!/^\s*SELECT\b/i.test(query.sql) || splitSqlStatements(query.sql).length !== 1) throw new Error(failureMessage);
    }
    const { DatabaseSync } = await import("node:sqlite");
    const database = new DatabaseSync(filename, { readOnly: true });
    try {
      const plans = [];
      for (const { name, query } of queries) {
        const rows = database.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.args);
        plans.push({
          name,
          rows: rows.map((row) => ({
            id: Number(row.id),
            parent: Number(row.parent),
            notused: Number(row.notused),
            detail: String(row.detail),
          })),
        });
      }
      return { plans };
    } finally {
      database.close();
    }
  } catch {
    throw new Error(failureMessage);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (report) => { console.log(JSON.stringify(report)); },
    () => { console.error(failureMessage); process.exitCode = 1; },
  );
}
