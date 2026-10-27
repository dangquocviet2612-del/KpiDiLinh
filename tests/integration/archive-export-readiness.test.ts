import { beforeEach, describe, expect, it, vi } from "vitest";
import * as xlsx from "xlsx";

const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), ensure: vi.fn(), auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: mocks.query, $executeRawUnsafe: mocks.execute } }));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensure }));
vi.mock("@/lib/kpi-cache", () => ({ clearCacheByPrefix: vi.fn() }));

import {
  countRecords, exportMonthToExcel, getArchiveExportReadiness,
  getArchiveExportStatus, getArchiveStatus, getLatestMonthDataTimestamp,
  recordArchiveExport,
} from "@/lib/archive";
import { POST as exportArchive } from "@/app/api/archive/export/route";
import { POST as confirmArchive } from "@/app/api/archive/confirm/route";

const month = "2026-08";
let exportLog: Record<string, unknown> | null;
let latestDataAt: string | null;
let recordCount: number;

beforeEach(() => {
  vi.resetAllMocks();
  exportLog = null;
  latestDataAt = "2026-08-31 12:00:00";
  recordCount = 1;
  mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM "ArchiveExportLog"')) return exportLog ? [exportLog] : [];
    if (sql.includes('FROM "ArchiveLog"')) return [];
    if (sql.includes("COUNT(1)")) return [{ total: recordCount }];
    if (sql.includes("MAX(")) return [{ createdAt: latestDataAt }];
    return [{ reportDate: "2026-08-31", ctvUser: "fixture-ctv", createdAt: latestDataAt }];
  });
  mocks.execute.mockImplementation(async (sql: string, archiveMonth: string, exportedBy: string, fileName: string) => {
    if (sql.includes('INSERT INTO "ArchiveExportLog"')) {
      exportLog = { id: 1, archiveMonth, exportedBy, exportedAt: "2026-09-01 00:00:00", fileName };
    }
    return 1;
  });
});

function archiveRequest(action: string) {
  return new Request(`http://localhost/api/archive/${action}?month=${month}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  });
}

describe("archive library read-only status and export freshness", () => {
  it("all status helpers read without runtime DDL, seed, or business writes", async () => {
    await Promise.all([
      getArchiveStatus(month), getArchiveExportStatus(month), countRecords(month),
      getLatestMonthDataTimestamp(month), getArchiveExportReadiness(month),
    ]);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });

  it("nonempty data without an export is blocked", async () => {
    expect(await getArchiveExportReadiness(month)).toMatchObject({ ok: false, reason: "no_export" });
  });

  it("no data remains blocked even if an export log exists", async () => {
    recordCount = 0;
    await recordArchiveExport(month, "fixture-admin", "fixture.xlsx");
    expect(await getArchiveExportReadiness(month)).toMatchObject({ ok: false, reason: "no_data" });
  });

  it("new workbook and its recorded export make confirmation ready without changing XLSX sheets", async () => {
    const exported = await exportMonthToExcel(month);
    const workbook = xlsx.read(exported.buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["KPI", "Cuoc"]);
    expect(exported.fileName).toBe(`archive_kpi_cuoc_${month}.xlsx`);
    await recordArchiveExport(month, "fixture-admin", exported.fileName);
    expect(await getArchiveExportReadiness(month)).toMatchObject({
      ok: true, reason: null, exportLog: { fileName: exported.fileName },
    });
  });

  it("data changed after export requires a new export", async () => {
    await recordArchiveExport(month, "fixture-admin", "fixture.xlsx");
    latestDataAt = "2026-09-01T00:00:01.000Z";
    expect(await getArchiveExportReadiness(month)).toMatchObject({ ok: false, reason: "stale_export" });
  });

  it("invalid export timestamps do not pass the freshness check", async () => {
    await recordArchiveExport(month, "fixture-admin", "fixture.xlsx");
    exportLog!.exportedAt = "invalid-fixture-date";
    expect(await getArchiveExportReadiness(month)).toMatchObject({ ok: false, reason: "stale_export" });
  });

  it("query errors fail closed rather than claiming export readiness", async () => {
    mocks.query.mockRejectedValue(new Error("fixture query failure"));
    await expect(getArchiveExportReadiness(month)).rejects.toThrow("fixture query failure");
  });

  it("successful POST export followed by POST confirmation preserves the readiness safeguard", async () => {
    const exported = await exportArchive(archiveRequest("export"));
    expect(exported.status).toBe(200);
    expect(exportLog).toMatchObject({ fileName: `archive_kpi_cuoc_${month}.xlsx` });
    const confirmation = await confirmArchive(archiveRequest("confirm"));
    expect(confirmation.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "ArchiveLog"'), month, "fixture-admin",
      expect.any(String), 1, 1, `archive_kpi_cuoc_${month}.xlsx`,
    );
  });

  it("a failed POST export leaves no readiness log and confirmation remains blocked", async () => {
    mocks.query.mockRejectedValueOnce(new Error("fixture export failure"));
    expect((await exportArchive(archiveRequest("export"))).status).toBe(500);
    expect(exportLog).toBeNull();
    expect((await confirmArchive(archiveRequest("confirm"))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("an export log write error leaves confirmation blocked", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("fixture log failure"));
    expect((await exportArchive(archiveRequest("export"))).status).toBe(500);
    expect(exportLog).toBeNull();
    expect((await confirmArchive(archiveRequest("confirm"))).status).toBe(400);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("POST confirmation rejects data newer than the last successful POST export", async () => {
    expect((await exportArchive(archiveRequest("export"))).status).toBe(200);
    latestDataAt = "2026-09-01 00:00:01";
    expect((await confirmArchive(archiveRequest("confirm"))).status).toBe(400);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
