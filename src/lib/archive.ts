import * as xlsx from "xlsx";
import { prisma } from "@/lib/prisma";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { ensureKpiTables } from "@/lib/kpi-db";

export type ArchiveLogRecord = {
  id: number;
  archiveMonth: string;
  archivedBy: string;
  archivedAt: string;
  purgeAfter: string;
  purgedAt: string | null;
  kpiRecordCount: number;
  cuocRecordCount: number;
  fileName: string | null;
};

export type ArchiveExportLogRecord = {
  id: number;
  archiveMonth: string;
  exportedBy: string;
  exportedAt: string;
  fileName: string;
};

export type ArchiveExportReadiness = {
  ok: boolean;
  reason: "no_data" | "no_export" | "stale_export" | null;
  exportLog: ArchiveExportLogRecord | null;
  latestDataAt: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function toMonthText(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function toSqliteDatetime(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function currentMonthText() {
  return toMonthText(new Date());
}

function parseArchiveDatetime(value?: string | null) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes("T") ? text : `${text.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getMonthRange(month: string) {
  if (!isValidMonth(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM");
  }

  const [year, monthPart] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthPart - 1, 1));
  const end = new Date(Date.UTC(year, monthPart, 1));
  return {
    startDate: `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-01`,
    endDate: `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-01`,
  };
}

export async function getArchiveStatus(month: string) {
  const rows = await prisma.$queryRawUnsafe<ArchiveLogRecord[]>(
    `SELECT "id", "archiveMonth", "archivedBy",
      CAST("archivedAt" AS TEXT) AS "archivedAt",
      CAST("purgeAfter" AS TEXT) AS "purgeAfter",
      CAST("purgedAt" AS TEXT) AS "purgedAt",
      "kpiRecordCount", "cuocRecordCount", "fileName"
     FROM "ArchiveLog" WHERE "archiveMonth" = ? LIMIT 1`,
    month
  );
  return rows[0] || null;
}

export async function getArchiveExportStatus(month: string) {
  const rows = await prisma.$queryRawUnsafe<ArchiveExportLogRecord[]>(
    `SELECT "id", "archiveMonth", "exportedBy",
      CAST("exportedAt" AS TEXT) AS "exportedAt", "fileName"
     FROM "ArchiveExportLog" WHERE "archiveMonth" = ? LIMIT 1`,
    month
  );
  return rows[0] || null;
}

export async function countRecords(month: string) {
  const { startDate, endDate } = getMonthRange(month);
  const [kpiRows, cuocRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(1) AS total
      FROM "KpiDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      `,
      startDate,
      endDate
    ),
    prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(1) AS total
      FROM "CuocDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      `,
      startDate,
      endDate
    ),
  ]);

  return {
    kpiCount: Number(kpiRows[0]?.total || 0),
    cuocCount: Number(cuocRows[0]?.total || 0),
  };
}

export async function getLatestMonthDataTimestamp(month: string) {
  const { startDate, endDate } = getMonthRange(month);
  const [kpiRows, cuocRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ createdAt: string | null }>>(
      `
      SELECT MAX("createdAt") AS "createdAt"
      FROM "KpiDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      `,
      startDate,
      endDate
    ),
    prisma.$queryRawUnsafe<Array<{ createdAt: string | null }>>(
      `
      SELECT MAX("createdAt") AS "createdAt"
      FROM "CuocDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      `,
      startDate,
      endDate
    ),
  ]);

  const candidates = [kpiRows[0]?.createdAt || null, cuocRows[0]?.createdAt || null]
    .map((value) => ({ value, ts: parseArchiveDatetime(value) }))
    .filter((item): item is { value: string; ts: number } => !!item.value && item.ts !== null)
    .sort((a, b) => b.ts - a.ts);

  return candidates[0]?.value || null;
}

export async function getArchiveExportReadiness(month: string): Promise<ArchiveExportReadiness> {
  const [counts, exportLog, latestDataAt] = await Promise.all([
    countRecords(month),
    getArchiveExportStatus(month),
    getLatestMonthDataTimestamp(month),
  ]);

  if ((counts.kpiCount || 0) + (counts.cuocCount || 0) <= 0) {
    return { ok: false, reason: "no_data", exportLog, latestDataAt };
  }

  if (!exportLog) {
    return { ok: false, reason: "no_export", exportLog: null, latestDataAt };
  }

  const exportTs = parseArchiveDatetime(exportLog.exportedAt);
  const latestDataTs = parseArchiveDatetime(latestDataAt);
  if (latestDataTs !== null && (exportTs === null || exportTs < latestDataTs)) {
    return { ok: false, reason: "stale_export", exportLog, latestDataAt };
  }

  return { ok: true, reason: null, exportLog, latestDataAt };
}

export async function exportMonthToExcel(month: string) {
  await ensureKpiTables();
  const { startDate, endDate } = getMonthRange(month);
  const [kpiRows, cuocRows] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "reportDate","ctvUser","kpiCode","kpiName","khThang","thNgay","thLuyKe","completionPercent","growthPercent","rawPayload","createdAt"
      FROM "KpiDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      ORDER BY "reportDate" ASC, "ctvUser" ASC, "kpiCode" ASC
      `,
      startDate,
      endDate
    ),
    prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "reportDate","ctvUser","employeeCodeRaw","managerCodeRaw","targetAmount","collectedAmount","completionPercent","missingAmount","createdAt"
      FROM "CuocDailyResult"
      WHERE "reportDate" >= ? AND "reportDate" < ?
      ORDER BY "reportDate" ASC, "ctvUser" ASC
      `,
      startDate,
      endDate
    ),
  ]);

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(kpiRows), "KPI");
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(cuocRows), "Cuoc");
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  return {
    buffer,
    fileName: `archive_kpi_cuoc_${month}.xlsx`,
    kpiCount: kpiRows.length,
    cuocCount: cuocRows.length,
  };
}

export async function recordArchiveExport(month: string, exportedBy: string, fileName: string) {
  await ensureKpiTables();
  if (!isValidMonth(month)) throw new Error("Invalid month format");
  if (!fileName.trim()) throw new Error("Missing archive export filename");

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "ArchiveExportLog" ("archiveMonth","exportedBy","exportedAt","fileName")
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT("archiveMonth") DO UPDATE SET
      "exportedBy" = excluded."exportedBy",
      "exportedAt" = CURRENT_TIMESTAMP,
      "fileName" = excluded."fileName"
    `,
    month,
    exportedBy,
    fileName.trim()
  );

  return getArchiveExportStatus(month);
}

export async function purgeMonthData(month: string, options: { requireExpired?: boolean } = {}) {
  const { startDate, endDate } = getMonthRange(month);
  const purged = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.$executeRawUnsafe(
      `UPDATE "ArchiveLog" SET "purgedAt" = CURRENT_TIMESTAMP
       WHERE "archiveMonth" = ? AND "purgedAt" IS NULL
         AND (? = 0 OR datetime("purgeAfter") <= datetime('now'))`,
      month,
      options.requireExpired === false ? 0 : 1
    );
    if (claimed !== 1) return false;

    await transaction.$executeRawUnsafe(
      `DELETE FROM "KpiDailyResult" WHERE "reportDate" >= ? AND "reportDate" < ?`,
      startDate,
      endDate
    );
    await transaction.$executeRawUnsafe(
      `DELETE FROM "CuocDailyResult" WHERE "reportDate" >= ? AND "reportDate" < ?`,
      startDate,
      endDate
    );
    return true;
  });

  if (!purged) return false;

  clearCacheByPrefix("kpi:");
  clearCacheByPrefix("cuoc:");
  clearCacheByPrefix("prepaid:");
  return true;
}

export async function upsertArchiveConfirmation(month: string, archivedBy: string, fileName?: string) {
  if (!isValidMonth(month)) throw new Error("Invalid month format");
  if (month >= currentMonthText()) {
    throw new Error("Only past months can be archived");
  }

  await ensureKpiTables();
  const counts = await countRecords(month);
  if ((counts.kpiCount || 0) + (counts.cuocCount || 0) <= 0) {
    throw new Error("No KPI/Cước data found for the selected month");
  }
  const purgeAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const purgeAfterSql = toSqliteDatetime(purgeAfter);

  const confirmed = await prisma.$executeRawUnsafe(
    `
    INSERT INTO "ArchiveLog" ("archiveMonth","archivedBy","purgeAfter","kpiRecordCount","cuocRecordCount","fileName","purgedAt")
    VALUES (?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT("archiveMonth") DO UPDATE SET
      "archivedBy" = excluded."archivedBy",
      "archivedAt" = CURRENT_TIMESTAMP,
      "purgeAfter" = excluded."purgeAfter",
      "kpiRecordCount" = excluded."kpiRecordCount",
      "cuocRecordCount" = excluded."cuocRecordCount",
      "fileName" = excluded."fileName"
    WHERE "ArchiveLog"."purgedAt" IS NULL
    `,
    month,
    archivedBy,
    purgeAfterSql,
    counts.kpiCount,
    counts.cuocCount,
    fileName || null
  );

  if (confirmed !== 1) throw new Error("Cannot confirm a purged archive");

  return getArchiveStatus(month);
}

export async function cancelArchiveConfirmation(month: string) {
  const existing = await getArchiveStatus(month);
  if (!existing) return null;
  if (existing.purgedAt) throw new Error("Cannot cancel a purged archive");

  const cancelled = await prisma.$executeRawUnsafe(`DELETE FROM "ArchiveLog" WHERE "archiveMonth" = ? AND "purgedAt" IS NULL`, month);
  return cancelled === 1;
}

export async function assertArchiveMonthWritable(month: string) {
  const archive = await getArchiveStatus(month);
  if (archive && !archive.purgedAt) {
    throw new Error(`Tháng ${month} đã được xác nhận lưu trữ. Hãy hủy xác nhận trước khi import lại dữ liệu.`);
  }
}

export async function checkAndPurgeExpired() {
  await ensureKpiTables();
  const due = await prisma.$queryRawUnsafe<Array<{ archiveMonth: string }>>(
    `
    SELECT "archiveMonth"
    FROM "ArchiveLog"
    WHERE "purgedAt" IS NULL AND datetime("purgeAfter") <= datetime('now')
    ORDER BY "archiveMonth" ASC
    `
  );

  let purgedCount = 0;
  for (const row of due) {
    if (await purgeMonthData(row.archiveMonth)) {
      purgedCount += 1;
    }
  }

  return purgedCount;
}

export function canArchiveMonth(month: string, archive: ArchiveLogRecord | null) {
  return isValidMonth(month) && month < currentMonthText() && !archive;
}
