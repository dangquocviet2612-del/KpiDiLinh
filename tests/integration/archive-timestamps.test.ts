import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), cacheGeneration: Symbol("cache-generation") }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  return { prisma: new PrismaClient({ adapter: new PrismaLibSql({ url: "file::memory:" }) }) };
});
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: vi.fn() }));
vi.mock("@/lib/kpi-cache", () => ({ getCacheGeneration: () => mocks.cacheGeneration, clearCacheByPrefix: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getArchiveExportReadiness, getArchiveExportStatus, getArchiveStatus } from "@/lib/archive";
import { POST as exportArchive } from "@/app/api/archive/export/route";
import { POST as confirmArchive } from "@/app/api/archive/confirm/route";

const month = "2020-01";
const timezone = process.env.ARCHIVE_TIMESTAMPS_TEST_TZ;

function archiveRequest(action: string) {
  return new Request(`http://localhost/api/archive/${action}?month=${month}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  });
}

async function seedExport(exportedAt: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ArchiveExportLog" ("archiveMonth", "exportedBy", "exportedAt", "fileName") VALUES (?, ?, ?, ?)`,
    month, "fixture-admin", exportedAt, "fixture.xlsx",
  );
}

afterAll(async () => { await prisma.$disconnect(); });

if (!timezone) {
  describe.each(["UTC", "Asia/Ho_Chi_Minh"])("archive timestamps with PrismaLibSql in %s", (childTimezone) => {
    it("passes the real-adapter regressions in a timezone-isolated Node process", () => {
      const result = spawnSync(process.execPath, [
        fileURLToPath(new URL("../../node_modules/vitest/vitest.mjs", import.meta.url)),
        "run", fileURLToPath(import.meta.url), "--maxWorkers=1", "--reporter=verbose",
      ], {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env: {
          ...process.env,
          TZ: childTimezone,
          ARCHIVE_TIMESTAMPS_TEST_TZ: childTimezone,
          DATABASE_URL: "file::memory:",
          TURSO_AUTH_TOKEN: "",
        },
        encoding: "utf8",
        timeout: 45_000,
      });
      expect(result.error, result.stderr).toBeUndefined();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }, 60_000);
  });
} else {
  beforeAll(async () => {
    for (const statement of [
      `CREATE TABLE "ArchiveExportLog" (
        "id" INTEGER PRIMARY KEY, "archiveMonth" TEXT NOT NULL UNIQUE,
        "exportedBy" TEXT NOT NULL, "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "fileName" TEXT NOT NULL
      )`,
      `CREATE TABLE "ArchiveLog" (
        "id" INTEGER PRIMARY KEY, "archiveMonth" TEXT NOT NULL UNIQUE,
        "archivedBy" TEXT NOT NULL, "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "purgeAfter" DATETIME NOT NULL, "purgedAt" DATETIME,
        "kpiRecordCount" INTEGER NOT NULL DEFAULT 0, "cuocRecordCount" INTEGER NOT NULL DEFAULT 0,
        "fileName" TEXT
      )`,
      `CREATE TABLE "KpiDailyResult" (
        "reportDate" TEXT NOT NULL, "ctvUser" TEXT NOT NULL, "kpiCode" TEXT NOT NULL,
        "kpiName" TEXT, "khThang" REAL, "thNgay" REAL, "thLuyKe" REAL,
        "completionPercent" REAL, "growthPercent" REAL, "rawPayload" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE "CuocDailyResult" (
        "reportDate" TEXT NOT NULL, "ctvUser" TEXT NOT NULL,
        "employeeCodeRaw" TEXT, "managerCodeRaw" TEXT,
        "targetAmount" REAL DEFAULT 0, "collectedAmount" REAL DEFAULT 0,
        "completionPercent" REAL DEFAULT 0, "missingAmount" REAL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ]) {
      await prisma.$executeRawUnsafe(statement);
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
    for (const table of ["ArchiveLog", "ArchiveExportLog", "KpiDailyResult", "CuocDailyResult"]) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO "KpiDailyResult" ("reportDate", "ctvUser", "kpiCode", "createdAt")
      VALUES ('2020-01-15', 'fixture-ctv', 'fixture-kpi', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 minutes'))
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CuocDailyResult" ("reportDate", "ctvUser", "createdAt")
      VALUES ('2020-01-15', 'fixture-ctv', datetime('now', '-10 minutes'))
    `);
  });

  describe(`archive DATETIME reads in ${timezone}`, () => {
    it("actually runs in the requested timezone", () => {
      expect(new Date("2026-10-26T09:57:48Z").getTimezoneOffset()).toBe(timezone === "UTC" ? 0 : -420);
    });

    it("keeps missing status records null", async () => {
      expect(await getArchiveExportStatus(month)).toBeNull();
      expect(await getArchiveStatus(month)).toBeNull();
    });

    it.each(["2026-10-26 09:57:48.123456", "2026-10-26T09:57:48.123Z"])(
      "returns export timestamp %s as text without timezone conversion or precision loss",
      async (exportedAt) => {
        await seedExport(exportedAt);
        expect(await getArchiveExportStatus(month)).toEqual({
          id: 1, archiveMonth: month, exportedBy: "fixture-admin", exportedAt, fileName: "fixture.xlsx",
        });
      },
    );

    it.each([null, "2026-10-28 09:57:48.789"])(
      "returns archive timestamp DTOs without timezone conversion when purgedAt is %s",
      async (purgedAt) => {
        const archivedAt = "2026-10-26 09:57:48.123456";
        const purgeAfter = "2026-10-28 09:57:48.123";
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ArchiveLog" ("archiveMonth", "archivedBy", "archivedAt", "purgeAfter", "purgedAt", "kpiRecordCount", "cuocRecordCount", "fileName")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          month, "fixture-admin", archivedAt, purgeAfter, purgedAt, 1, 1, "fixture.xlsx",
        );
        const archive = await getArchiveStatus(month);
        expect(archive).toEqual({
          id: 1, archiveMonth: month, archivedBy: "fixture-admin", archivedAt, purgeAfter, purgedAt,
          kpiRecordCount: 1, cuocRecordCount: 1, fileName: "fixture.xlsx",
        });
        expect(JSON.parse(JSON.stringify(archive))).toEqual(archive);
      },
    );

    it("accepts a fresh CURRENT_TIMESTAMP POST export followed by POST confirmation", async () => {
      expect((await exportArchive(archiveRequest("export"))).status).toBe(200);
      const rows = await prisma.$queryRawUnsafe<Array<{ exportedAt: string }>>(
        `SELECT CAST("exportedAt" AS TEXT) AS "exportedAt" FROM "ArchiveExportLog"`,
      );
      const readiness = await getArchiveExportReadiness(month);
      const confirmation = await confirmArchive(archiveRequest("confirm"));
      expect(confirmation.status).toBe(200);
      expect(readiness).toMatchObject({
        ok: true, reason: null, exportLog: { exportedAt: rows[0].exportedAt },
      });
      expect(await confirmation.json()).toMatchObject({
        month, archive: {
          archivedAt: expect.any(String), purgeAfter: expect.any(String), purgedAt: null,
          kpiRecordCount: 1, cuocRecordCount: 1, fileName: `archive_kpi_cuoc_${month}.xlsx`,
        },
      });
    });

    it.each(["KpiDailyResult", "CuocDailyResult"])(
      "rejects confirmation when %s changes after the export",
      async (table) => {
        expect((await exportArchive(archiveRequest("export"))).status).toBe(200);
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 second')`,
        );
        expect(await getArchiveExportReadiness(month)).toMatchObject({ ok: false, reason: "stale_export" });
        expect((await confirmArchive(archiveRequest("confirm"))).status).toBe(400);
        expect(await getArchiveStatus(month)).toBeNull();
      },
    );

    it.each([
      ["2026-10-26T09:57:48.122Z", true],
      ["2026-10-26T09:57:48.123Z", true],
      ["2026-10-26T09:57:48.124Z", false],
    ])("compares data timestamp %s at millisecond precision", async (createdAt, ok) => {
      await seedExport("2026-10-26 09:57:48.123");
      await prisma.$executeRawUnsafe(`UPDATE "KpiDailyResult" SET "createdAt" = ?`, createdAt);
      await prisma.$executeRawUnsafe(`UPDATE "CuocDailyResult" SET "createdAt" = '2000-01-01 00:00:00'`);
      expect(await getArchiveExportReadiness(month)).toMatchObject({ ok, reason: ok ? null : "stale_export" });
    });
  });
}
