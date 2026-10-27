CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_date" ON "KpiDailyResult" ("reportDate");
CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_code" ON "KpiDailyResult" ("reportDate", "kpiCode");
CREATE INDEX IF NOT EXISTS "idx_kpi_config_enabled_sort_code" ON "KpiMetricConfig" ("isEnabled", "sortOrder", "kpiCode");
CREATE INDEX IF NOT EXISTS "idx_official_doc_category" ON "OfficialDocument" ("category");
CREATE INDEX IF NOT EXISTS "idx_official_doc_temp_asset_created" ON "OfficialDocumentTempAsset" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_official_doc_revision_doc_changed" ON "OfficialDocumentRevision" ("documentId", "changedAt");

INSERT INTO "CuocConfig" ("id", "targetRatePercent") VALUES (1, 97) ON CONFLICT("id") DO NOTHING;
INSERT INTO "CuocCdConfig" ("id", "targetRatePercent") VALUES (1, 99.5) ON CONFLICT("id") DO NOTHING;
INSERT INTO "KpiMetricConfig"
("kpiCode", "kpiName", "displayName", "baseScore", "maxPercent", "sortOrder", "isEnabled", "isNegative", "updatedAt")
VALUES ('CUOC_N1_N3_RATE', 'Tỷ lệ cước N1-N3', 'Tỷ lệ cước N1-N3', 10, 120, 999, 1, 0, CURRENT_TIMESTAMP)
ON CONFLICT("kpiCode") DO NOTHING;
