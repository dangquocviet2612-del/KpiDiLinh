-- AlterTable User
ALTER TABLE "User" ADD COLUMN "managerCode" TEXT;
ALTER TABLE "User" ADD COLUMN "secondaryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "canUseGps" BOOLEAN NOT NULL DEFAULT 0;

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "nodeName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "expirationDate" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Hoạt động';

-- CreateIndexes on User
CREATE INDEX IF NOT EXISTS "User_managerCode_idx" ON "User"("managerCode");
CREATE INDEX IF NOT EXISTS "User_secondaryCode_idx" ON "User"("secondaryCode");
CREATE INDEX IF NOT EXISTS "idx_user_role_manager_username" ON "User"("role", "managerCode", "username");
CREATE INDEX IF NOT EXISTS "idx_user_role_secondary" ON "User"("role", "secondaryCode");

-- CreateIndexes on Customer
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX IF NOT EXISTS "Customer_account_idx" ON "Customer"("account");
CREATE INDEX IF NOT EXISTS "Customer_ctvCode_idx" ON "Customer"("ctvCode");
CREATE INDEX IF NOT EXISTS "Customer_status_idx" ON "Customer"("status");
CREATE INDEX IF NOT EXISTS "Customer_expirationDate_idx" ON "Customer"("expirationDate");
CREATE INDEX IF NOT EXISTS "Customer_ctvCode_status_idx" ON "Customer"("ctvCode", "status");
CREATE INDEX IF NOT EXISTS "Customer_latitude_longitude_idx" ON "Customer"("latitude", "longitude");

-- CreateTable Node
CREATE TABLE IF NOT EXISTS "Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "totalIntPort" INTEGER,
    "usedPort" INTEGER,
    "portEfficiency" REAL,
    "dateKd" DATETIME,
    "efficiencyStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable CustomerNote
CREATE TABLE IF NOT EXISTS "CustomerNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable KpiMetricConfig
CREATE TABLE IF NOT EXISTS "KpiMetricConfig" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "kpiCode" TEXT NOT NULL,
    "kpiName" TEXT,
    "displayName" TEXT,
    "mergeGroup" TEXT,
    "baseScore" REAL,
    "maxPercent" REAL,
    "sortOrder" INTEGER,
    "isEnabled" INTEGER NOT NULL DEFAULT 1,
    "isNegative" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiMetricConfig_kpiCode_key" ON "KpiMetricConfig"("kpiCode");

-- CreateTable KpiDailyResult
CREATE TABLE IF NOT EXISTS "KpiDailyResult" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportDate" TEXT NOT NULL,
    "ctvUser" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "kpiName" TEXT,
    "khThang" REAL,
    "thNgay" REAL,
    "thLuyKe" REAL,
    "completionPercent" REAL,
    "growthPercent" REAL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_kpi_daily_report_ctv_metric" ON "KpiDailyResult"("reportDate", "ctvUser", "kpiCode");
CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_ctv" ON "KpiDailyResult"("reportDate", "ctvUser");
CREATE INDEX IF NOT EXISTS "idx_kpi_daily_ctv_report" ON "KpiDailyResult"("ctvUser", "reportDate");

-- CreateTable CuocDailyResult
CREATE TABLE IF NOT EXISTS "CuocDailyResult" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportDate" TEXT NOT NULL,
    "ctvUser" TEXT NOT NULL,
    "employeeCodeRaw" TEXT,
    "managerCodeRaw" TEXT,
    "targetAmount" REAL,
    "collectedAmount" REAL,
    "completionPercent" REAL,
    "missingAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CuocDailyResult_reportDate_ctvUser_key" ON "CuocDailyResult"("reportDate", "ctvUser");
CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_report_ctv" ON "CuocDailyResult"("reportDate", "ctvUser");
CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_ctv_report" ON "CuocDailyResult"("ctvUser", "reportDate");
CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_report_completion" ON "CuocDailyResult"("reportDate", "completionPercent");

-- CreateTable CuocCdDailyResult
CREATE TABLE IF NOT EXISTS "CuocCdDailyResult" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportDate" TEXT NOT NULL,
    "ctvUser" TEXT NOT NULL,
    "employeeCodeRaw" TEXT NOT NULL,
    "managerCodeRaw" TEXT,
    "dauKy" REAL NOT NULL DEFAULT 0,
    "luyKe" REAL NOT NULL DEFAULT 0,
    "thuaThieu" REAL NOT NULL DEFAULT 0,
    "tonChuaThu" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CuocCdDailyResult_reportDate_employeeCodeRaw_key" ON "CuocCdDailyResult"("reportDate", "employeeCodeRaw");
CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_ctv" ON "CuocCdDailyResult"("reportDate", "ctvUser");
CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_emp" ON "CuocCdDailyResult"("reportDate", "employeeCodeRaw");
CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_manager" ON "CuocCdDailyResult"("reportDate", "managerCodeRaw");

-- CreateTable ManagerKpiDailyResult
CREATE TABLE IF NOT EXISTS "ManagerKpiDailyResult" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportDate" TEXT NOT NULL,
    "managerUser" TEXT NOT NULL,
    "managerName" TEXT,
    "jobTitle" TEXT,
    "metricCode" TEXT NOT NULL,
    "metricName" TEXT,
    "metricLabel" TEXT,
    "khToDate" REAL,
    "khMonth" REAL,
    "thDay" REAL,
    "thLuyKe" REAL,
    "percentToDate" REAL,
    "percentMonth" REAL,
    "samePeriodValue" REAL,
    "growthPercent" REAL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ManagerKpiDailyResult_reportDate_managerUser_metricCode_key" ON "ManagerKpiDailyResult"("reportDate", "managerUser", "metricCode");
CREATE INDEX IF NOT EXISTS "idx_manager_kpi_report_manager" ON "ManagerKpiDailyResult"("reportDate", "managerUser");
CREATE INDEX IF NOT EXISTS "idx_manager_kpi_report_metric" ON "ManagerKpiDailyResult"("reportDate", "metricCode");
CREATE INDEX IF NOT EXISTS "idx_manager_kpi_manager_metric" ON "ManagerKpiDailyResult"("managerUser", "metricCode");

-- CreateTable CdtTransaction
CREATE TABLE IF NOT EXISTS "CdtTransaction" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "transactionDate" TEXT NOT NULL,
    "transactionTime" TEXT,
    "ctvUser" TEXT NOT NULL,
    "subscriberType" TEXT,
    "account" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "months" INTEGER NOT NULL DEFAULT 0,
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CdtTransaction_unique_key" ON "CdtTransaction"("transactionDate", "ctvUser", "account", "amount", "months");
CREATE INDEX IF NOT EXISTS "idx_cdt_date_ctv" ON "CdtTransaction"("transactionDate", "ctvUser");
CREATE INDEX IF NOT EXISTS "idx_cdt_ctv_date" ON "CdtTransaction"("ctvUser", "transactionDate");
CREATE INDEX IF NOT EXISTS "idx_cdt_account_date" ON "CdtTransaction"("account", "transactionDate");

-- CreateTable CdtOutstandingRecord
CREATE TABLE IF NOT EXISTS "CdtOutstandingRecord" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportMonth" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "customerName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "ctvCode" TEXT NOT NULL,
    "serviceName" TEXT,
    "expiryDateText" TEXT,
    "expiryMonth" TEXT NOT NULL,
    "statusCheck" TEXT NOT NULL,
    "subscriberType" TEXT NOT NULL DEFAULT 'Khác',
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CdtOutstandingRecord_unique_key" ON "CdtOutstandingRecord"("reportMonth", "account", "expiryMonth");
CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_report_ctv" ON "CdtOutstandingRecord"("reportMonth", "ctvCode");
CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_report_expiry" ON "CdtOutstandingRecord"("reportMonth", "expiryMonth");
CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_ctv_status" ON "CdtOutstandingRecord"("ctvCode", "statusCheck");

-- CreateTable DisconnectRecord
CREATE TABLE IF NOT EXISTS "DisconnectRecord" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportMonth" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'TH',
    "account" TEXT NOT NULL,
    "serviceName" TEXT,
    "ctvCode" TEXT NOT NULL,
    "suspendedDateIso" TEXT,
    "suspendedDateText" TEXT,
    "cancelDateIso" TEXT,
    "cancelDateText" TEXT,
    "cancelMonth" TEXT NOT NULL,
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DisconnectRecord_unique_key" ON "DisconnectRecord"("reportMonth", "sourceType", "account");
CREATE INDEX IF NOT EXISTS "idx_disconnect_report_ctv" ON "DisconnectRecord"("reportMonth", "ctvCode");
CREATE INDEX IF NOT EXISTS "idx_disconnect_report_cancel_month" ON "DisconnectRecord"("reportMonth", "cancelMonth");
CREATE INDEX IF NOT EXISTS "idx_disconnect_ctv_cancel_date" ON "DisconnectRecord"("ctvCode", "cancelDateIso");

-- CreateTable ArchiveLog
CREATE TABLE IF NOT EXISTS "ArchiveLog" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "archiveMonth" TEXT NOT NULL,
    "archivedBy" TEXT NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAfter" DATETIME NOT NULL,
    "purgedAt" DATETIME,
    "kpiRecordCount" INTEGER NOT NULL DEFAULT 0,
    "cuocRecordCount" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "ArchiveLog_archiveMonth_key" ON "ArchiveLog"("archiveMonth");
CREATE INDEX IF NOT EXISTS "idx_archive_log_purge_due" ON "ArchiveLog"("purgedAt", "purgeAfter");

-- CreateTable ArchiveExportLog
CREATE TABLE IF NOT EXISTS "ArchiveExportLog" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "archiveMonth" TEXT NOT NULL,
    "exportedBy" TEXT NOT NULL,
    "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ArchiveExportLog_archiveMonth_key" ON "ArchiveExportLog"("archiveMonth");
CREATE INDEX IF NOT EXISTS "idx_archive_export_month_time" ON "ArchiveExportLog"("archiveMonth", "exportedAt");

-- CreateTable CuocConfig
CREATE TABLE IF NOT EXISTS "CuocConfig" (
    "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
    "targetRatePercent" REAL NOT NULL DEFAULT 97,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable CuocCdConfig
CREATE TABLE IF NOT EXISTS "CuocCdConfig" (
    "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
    "targetRatePercent" REAL NOT NULL DEFAULT 99.5,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable ChurnRiskRecord
CREATE TABLE IF NOT EXISTS "ChurnRiskRecord" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reportMonth" TEXT NOT NULL,
    "ctvCode" TEXT NOT NULL,
    "customerName" TEXT,
    "phone" TEXT,
    "packageName" TEXT,
    "address" TEXT,
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_churn_risk_report_ctv" ON "ChurnRiskRecord"("reportMonth", "ctvCode");
CREATE INDEX IF NOT EXISTS "idx_churn_risk_ctv_month" ON "ChurnRiskRecord"("ctvCode", "reportMonth");
CREATE INDEX IF NOT EXISTS "idx_churn_risk_report_month" ON "ChurnRiskRecord"("reportMonth");

-- CreateTable CustomerNodeMapping
CREATE TABLE IF NOT EXISTS "CustomerNodeMapping" (
    "id" TEXT PRIMARY KEY,
    "account" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "accountAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_node_mapping_account_key" ON "CustomerNodeMapping"("accountKey");
CREATE INDEX IF NOT EXISTS "idx_customer_node_mapping_node_name" ON "CustomerNodeMapping"("nodeName");

-- CreateTable OfficialDocument
CREATE TABLE IF NOT EXISTS "OfficialDocument" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "expiresAt" DATETIME,
    "isPinned" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_official_doc_status_published" ON "OfficialDocument"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "idx_official_doc_category_status" ON "OfficialDocument"("category", "status");
CREATE INDEX IF NOT EXISTS "idx_official_doc_pinned_published" ON "OfficialDocument"("isPinned", "publishedAt");

-- CreateTable OfficialDocumentAsset
CREATE TABLE IF NOT EXISTS "OfficialDocumentAsset" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "storageKind" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "fileData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficialDocumentAsset_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OfficialDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OfficialDocumentAsset_documentId_idx" ON "OfficialDocumentAsset"("documentId");

-- CreateTable OfficialDocumentTempAsset
CREATE TABLE IF NOT EXISTS "OfficialDocumentTempAsset" (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "fileData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable OfficialDocumentRevision
CREATE TABLE IF NOT EXISTS "OfficialDocumentRevision" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "documentId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isPinned" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OfficialDocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OfficialDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OfficialDocumentRevision_documentId_idx" ON "OfficialDocumentRevision"("documentId");

-- CreateTable Node0Tb
CREATE TABLE IF NOT EXISTS "Node0Tb" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeCode" TEXT NOT NULL,
    "dateKd" DATETIME,
    "dateKdRaw" TEXT,
    "dateKdFormatted" TEXT,
    "totalPort" INTEGER,
    "usedPort" INTEGER NOT NULL DEFAULT 0,
    "categoryKd" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Node0Tb_nodeCode_key" ON "Node0Tb"("nodeCode");
CREATE INDEX IF NOT EXISTS "idx_node_0tb_category_kd" ON "Node0Tb"("categoryKd");

-- Default rows for singleton configs
INSERT OR IGNORE INTO "CuocConfig" ("id", "targetRatePercent") VALUES (1, 97);
INSERT OR IGNORE INTO "CuocCdConfig" ("id", "targetRatePercent") VALUES (1, 99.5);
