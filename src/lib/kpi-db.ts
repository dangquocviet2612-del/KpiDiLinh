import { prisma } from "@/lib/prisma";

let ensurePromise: Promise<void> | null = null;

export async function ensureKpiTables() {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "KpiMetricConfig" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "kpiCode" TEXT NOT NULL UNIQUE,
        "kpiName" TEXT,
        "displayName" TEXT,
        "mergeGroup" TEXT,
        "baseScore" REAL NOT NULL DEFAULT 10,
        "maxPercent" REAL NOT NULL DEFAULT 120,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isEnabled" INTEGER NOT NULL DEFAULT 1,
        "isNegative" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "KpiMetricConfig" ADD COLUMN "mergeGroup" TEXT`);
    } catch {
      // Column already exists.
    }

    await prisma.$executeRawUnsafe(`
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
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportDate", "ctvUser", "kpiCode")
      )
    `);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_kpi_daily_ctv_date" ON "KpiDailyResult" ("ctvUser", "reportDate")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_date" ON "KpiDailyResult" ("reportDate")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_ctv_code" ON "KpiDailyResult" ("reportDate", "ctvUser", "kpiCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_kpi_daily_report_code" ON "KpiDailyResult" ("reportDate", "kpiCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_kpi_config_enabled_sort_code" ON "KpiMetricConfig" ("isEnabled", "sortOrder", "kpiCode")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CuocDailyResult" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "reportDate" TEXT NOT NULL,
        "ctvUser" TEXT NOT NULL,
        "employeeCodeRaw" TEXT,
        "managerCodeRaw" TEXT,
        "targetAmount" REAL NOT NULL DEFAULT 0,
        "collectedAmount" REAL NOT NULL DEFAULT 0,
        "completionPercent" REAL NOT NULL DEFAULT 0,
        "missingAmount" REAL NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportDate", "ctvUser")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_report_ctv" ON "CuocDailyResult" ("reportDate", "ctvUser")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_ctv_report" ON "CuocDailyResult" ("ctvUser", "reportDate")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_daily_report_completion" ON "CuocDailyResult" ("reportDate", "completionPercent")`);

    await prisma.$executeRawUnsafe(`
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
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportDate", "employeeCodeRaw")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_ctv" ON "CuocCdDailyResult" ("reportDate", "ctvUser")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_emp" ON "CuocCdDailyResult" ("reportDate", "employeeCodeRaw")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cuoc_cd_daily_report_manager" ON "CuocCdDailyResult" ("reportDate", "managerCodeRaw")`);

    await prisma.$executeRawUnsafe(`
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
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportDate", "managerUser", "metricCode")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_manager_kpi_report_manager" ON "ManagerKpiDailyResult" ("reportDate", "managerUser")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_manager_kpi_report_metric" ON "ManagerKpiDailyResult" ("reportDate", "metricCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_manager_kpi_manager_metric" ON "ManagerKpiDailyResult" ("managerUser", "metricCode")`);

    await prisma.$executeRawUnsafe(`
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
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("transactionDate", "ctvUser", "account", "amount", "months")
      )
    `);
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CdtTransaction" ADD COLUMN "transactionTime" TEXT`);
    } catch {
      // Column already exists.
    }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CdtTransaction" ADD COLUMN "subscriberType" TEXT`);
    } catch {
      // Column already exists.
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_date_ctv" ON "CdtTransaction" ("transactionDate", "ctvUser")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_ctv_date" ON "CdtTransaction" ("ctvUser", "transactionDate")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_account_date" ON "CdtTransaction" ("account", "transactionDate")`);

    await prisma.$executeRawUnsafe(`
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
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportMonth", "account", "expiryMonth")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_report_ctv" ON "CdtOutstandingRecord" ("reportMonth", "ctvCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_report_expiry" ON "CdtOutstandingRecord" ("reportMonth", "expiryMonth")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_cdt_outstanding_ctv_status" ON "CdtOutstandingRecord" ("ctvCode", "statusCheck")`);

    await prisma.$executeRawUnsafe(`
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
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("reportMonth", "sourceType", "account")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_disconnect_report_ctv" ON "DisconnectRecord" ("reportMonth", "ctvCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_disconnect_report_cancel_month" ON "DisconnectRecord" ("reportMonth", "cancelMonth")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_disconnect_ctv_cancel_date" ON "DisconnectRecord" ("ctvCode", "cancelDateIso")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ArchiveLog" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "archiveMonth" TEXT NOT NULL,
        "archivedBy" TEXT NOT NULL,
        "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "purgeAfter" DATETIME NOT NULL,
        "purgedAt" DATETIME,
        "kpiRecordCount" INTEGER NOT NULL DEFAULT 0,
        "cuocRecordCount" INTEGER NOT NULL DEFAULT 0,
        "fileName" TEXT,
        UNIQUE ("archiveMonth")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_archive_log_purge_due" ON "ArchiveLog" ("purgedAt", "purgeAfter")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ArchiveExportLog" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "archiveMonth" TEXT NOT NULL,
        "exportedBy" TEXT NOT NULL,
        "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "fileName" TEXT NOT NULL,
        UNIQUE ("archiveMonth")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_archive_export_month_time" ON "ArchiveExportLog" ("archiveMonth", "exportedAt")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CuocConfig" (
        "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
        "targetRatePercent" REAL NOT NULL DEFAULT 97,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CuocConfig" ("id","targetRatePercent")
      VALUES (1, 97)
      ON CONFLICT("id") DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CuocCdConfig" (
        "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
        "targetRatePercent" REAL NOT NULL DEFAULT 99.5,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CuocCdConfig" ("id","targetRatePercent")
      VALUES (1, 99.5)
      ON CONFLICT("id") DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`
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
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_churn_risk_report_ctv" ON "ChurnRiskRecord" ("reportMonth", "ctvCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_churn_risk_ctv_month" ON "ChurnRiskRecord" ("ctvCode", "reportMonth")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_churn_risk_report_month" ON "ChurnRiskRecord" ("reportMonth")`);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_user_role_manager_username" ON "User" ("role", "managerCode", "username")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_user_role_secondary" ON "User" ("role", "secondaryCode")`);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "KpiMetricConfig"
      ("kpiCode","kpiName","displayName","baseScore","maxPercent","sortOrder","isEnabled","isNegative","updatedAt")
      VALUES ('CUOC_N1_N3_RATE','Tỷ lệ cước N1-N3','Tỷ lệ cước N1-N3',10,120,999,1,0,CURRENT_TIMESTAMP)
      ON CONFLICT("kpiCode") DO NOTHING
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}
