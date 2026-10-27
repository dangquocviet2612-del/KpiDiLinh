type BoundKpiQuery = { sql: string; args: string[] };

export type KpiSummaryMetadataRow = {
  name: string;
  sortOrder: number;
  kpiCode: string | null;
  displayName: string | null;
  kpiName: string | null;
  mergeGroup: string | null;
  maxPercent: number | null;
  isNegative: number | null;
};

export const KPI_SUMMARY_METADATA_SQL = `
  SELECT
    COALESCE("mergeGroup", "displayName", "kpiName", "kpiCode") AS "name",
    COALESCE("sortOrder", 0) AS "sortOrder",
    "kpiCode", "displayName", "kpiName", "mergeGroup", "maxPercent", "isNegative"
  FROM "KpiMetricConfig"
  WHERE COALESCE("isEnabled", 1) = 1
  ORDER BY "sortOrder" ASC, "name" ASC
`;

export function buildPersonalKpiQuery(ctvUser: string, reportDate: string): BoundKpiQuery {
  return {
    sql: `
      SELECT
        COALESCE(d."ctvUser", ?) AS "ctvUser",
        c."kpiCode",
        COALESCE(d."kpiName", c."kpiName", c."kpiCode") AS "kpiName",
        d."khThang",
        d."thNgay",
        d."thLuyKe",
        d."completionPercent",
        d."growthPercent",
        COALESCE(c."displayName", c."kpiName", c."kpiCode") AS "displayName",
        c."mergeGroup" AS "mergeGroup",
        COALESCE(c."baseScore", 10) AS "baseScore",
        COALESCE(c."maxPercent", 120) AS "maxPercent",
        COALESCE(c."sortOrder", 0) AS "sortOrder",
        COALESCE(c."isEnabled", 1) AS "isEnabled",
        COALESCE(c."isNegative", 0) AS "isNegative"
      FROM "KpiMetricConfig" c
      LEFT JOIN "KpiDailyResult" d
        ON d."kpiCode" = c."kpiCode"
       AND d."reportDate" = ?
       ${ctvUser ? `AND d."ctvUser" = ?` : ""}
      ORDER BY "sortOrder" ASC, c."kpiCode" ASC
    `,
    args: ctvUser ? [ctvUser, reportDate, ctvUser] : ["", reportDate],
  };
}

export function buildKpiSummaryAggregateQuery(reportDate: string, group: string, ctvUsers: string[]): BoundKpiQuery {
  if (!ctvUsers.length) throw new Error("Summary aggregation requires a non-empty scope");
  return {
    sql: `
      SELECT
        d."ctvUser" AS "ctvUser",
        SUM(COALESCE(d."khThang", 0)) AS "kh",
        SUM(COALESCE(d."thLuyKe", d."thNgay", 0)) AS "th"
      FROM "KpiDailyResult" d
      INNER JOIN "KpiMetricConfig" c ON c."kpiCode" = d."kpiCode"
      WHERE d."reportDate" = ?
        AND COALESCE(c."isEnabled", 1) = 1
        AND COALESCE(c."mergeGroup", c."displayName", c."kpiName", c."kpiCode") = ?
        AND d."ctvUser" IN (${ctvUsers.map(() => "?").join(",")})
      GROUP BY d."ctvUser"
    `,
    args: [reportDate, group, ...ctvUsers],
  };
}

export function buildLatestKpiDateQuery(ctvUser: string): BoundKpiQuery {
  return {
    sql: `SELECT "reportDate" FROM "KpiDailyResult" WHERE "ctvUser" = ? ORDER BY "reportDate" DESC LIMIT 1`,
    args: [ctvUser],
  };
}
