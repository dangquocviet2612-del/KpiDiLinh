type RestoreTransaction = { $executeRawUnsafe: (query: string) => Promise<unknown> };

export async function applyRestoreSystemDefaults(transaction: RestoreTransaction): Promise<void> {
  await transaction.$executeRawUnsafe(`INSERT INTO "CuocConfig" ("id", "targetRatePercent") VALUES (1, 97) ON CONFLICT("id") DO NOTHING`);
  await transaction.$executeRawUnsafe(`INSERT INTO "CuocCdConfig" ("id", "targetRatePercent") VALUES (1, 99.5) ON CONFLICT("id") DO NOTHING`);
  await transaction.$executeRawUnsafe(`
    INSERT INTO "KpiMetricConfig"
    ("kpiCode", "kpiName", "displayName", "baseScore", "maxPercent", "sortOrder", "isEnabled", "isNegative", "updatedAt")
    VALUES ('CUOC_N1_N3_RATE', 'Tỷ lệ cước N1-N3', 'Tỷ lệ cước N1-N3', 10, 120, 999, 1, 0, CURRENT_TIMESTAMP)
    ON CONFLICT("kpiCode") DO NOTHING
  `);
}
