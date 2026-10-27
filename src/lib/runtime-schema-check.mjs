import contracts from "./runtime-schema-contract.json" with { type: "json" };

export const runtimeSchemaDomains = Object.freeze(Object.keys(contracts));

export class RuntimeSchemaReadinessError extends Error {
  constructor(domain, missing) {
    const details = missing.slice(0, 4).join(", ") + (missing.length > 4 ? ` (+${missing.length - 4})` : "");
    super(`SCHEMA_NOT_READY (${domain}): ${details}. Xác minh schema và quy trình nâng cấp; không chạy lại migration trên dữ liệu hiện có.`);
    this.name = "RuntimeSchemaReadinessError";
    this.code = "SCHEMA_NOT_READY";
    this.domain = domain;
    this.missing = missing;
  }
}

function validateMetadata(contract, rows) {
  const missing = [];
  for (const [tableName, expected] of Object.entries(contract)) {
    const columns = rows.filter((row) => row.kind === "column" && row.tableName === tableName);
    if (!columns.length) { missing.push(`table:${tableName}`); continue; }
    const names = new Set(columns.map((column) => column.fieldName));
    for (const column of expected.columns) if (!names.has(column)) missing.push(`${tableName}.${column}`);
    const primaryKey = columns.filter((column) => Number(column.ordinal) > 0).sort((left, right) => Number(left.ordinal) - Number(right.ordinal)).map((column) => column.fieldName);
    if (JSON.stringify(primaryKey) !== JSON.stringify(expected.primaryKey)) missing.push(`primary:${tableName}`);
    const indexes = new Map();
    for (const row of rows.filter((entry) => entry.kind === "unique" && entry.tableName === tableName)) {
      if (!indexes.has(row.indexName)) indexes.set(row.indexName, []);
      indexes.get(row.indexName).push(row);
    }
    const uniqueKeys = [...indexes.values()].filter((entries) => entries.every((entry) => Number(entry.partial) === 0 && typeof entry.fieldName === "string"))
      .map((entries) => entries.sort((left, right) => Number(left.ordinal) - Number(right.ordinal)).map((entry) => entry.fieldName));
    for (const fields of expected.unique) {
      if (![primaryKey, ...uniqueKeys].some((key) => JSON.stringify([...key].sort()) === JSON.stringify([...fields].sort()))) missing.push(`unique:${tableName}(${fields.join(",")})`);
    }
  }
  return missing;
}

export async function validateRuntimeSchema(query, domain, options = {}) {
  if (!Object.hasOwn(contracts, domain)) throw new RuntimeSchemaReadinessError("unknown", ["invalid_domain"]);
  try {
    const contract = contracts[domain];
    const tables = Object.keys(contract);
    const placeholders = tables.map(() => "?").join(",");
    const rows = await query(`
      SELECT 'column' AS "kind", m."name" AS "tableName", p."name" AS "fieldName",
             p."pk" AS "ordinal", NULL AS "indexName", 0 AS "partial"
      FROM sqlite_master m JOIN pragma_table_info(m."name") p
      WHERE m."type" = 'table' AND m."name" IN (${placeholders})
      UNION ALL
      SELECT 'unique' AS "kind", m."name" AS "tableName", fields."name" AS "fieldName",
             fields."seqno" AS "ordinal", indices."name" AS "indexName", indices."partial" AS "partial"
      FROM sqlite_master m JOIN pragma_index_list(m."name") indices JOIN pragma_index_info(indices."name") fields
      WHERE m."type" = 'table' AND indices."unique" = 1 AND m."name" IN (${placeholders})
    `, [...tables, ...tables]);
    const missing = validateMetadata(contract, rows);
    if (missing.length) throw new RuntimeSchemaReadinessError(domain, missing);
    if (domain === "kpi" && options.requireDefaults !== false) {
      const defaults = await query(`
        SELECT 'CuocConfig:1' AS "requirement" FROM "CuocConfig" WHERE "id" = ?
        UNION ALL SELECT 'CuocCdConfig:1' AS "requirement" FROM "CuocCdConfig" WHERE "id" = ?
        UNION ALL SELECT 'CUOC_N1_N3_RATE' AS "requirement" FROM "KpiMetricConfig" WHERE "kpiCode" = ?
      `, [1, 1, "CUOC_N1_N3_RATE"]);
      const present = new Set(defaults.map((row) => row.requirement));
      const absent = ["CuocConfig:1", "CuocCdConfig:1", "CUOC_N1_N3_RATE"].filter((requirement) => !present.has(requirement));
      if (absent.length) throw new RuntimeSchemaReadinessError(domain, absent);
    }
  } catch (error) {
    if (error instanceof RuntimeSchemaReadinessError) throw error;
    throw new RuntimeSchemaReadinessError(domain, ["metadata_unavailable"]);
  }
}

export function createRuntimeSchemaGuard(query) {
  const checks = new Map();
  return (domain, options = {}) => {
    const key = `${domain}:${options.requireDefaults === false ? "storage" : "full"}`;
    if (!checks.has(key)) {
      const pending = validateRuntimeSchema(query, domain, options).catch((error) => { checks.delete(key); throw error; });
      checks.set(key, pending);
    }
    return checks.get(key);
  };
}
