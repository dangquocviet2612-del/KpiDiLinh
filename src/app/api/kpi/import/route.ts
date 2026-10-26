export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { parseGbocWorkbook } from "@/lib/kpi";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { assertArchiveMonthWritable } from "@/lib/archive";

async function ensureUserSecondaryCodeColumn() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "secondaryCode" TEXT`);
  } catch {
    // Column already exists or DB does not need migration.
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    await ensureKpiTables();
    await ensureUserSecondaryCodeColumn();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file để tải lên" },
        { status: 400 }
      );
    }

    const rows = parseGbocWorkbook(Buffer.from(await file.arrayBuffer()));
    if (!rows.length) {
      return NextResponse.json(
        { error: "Không đọc được dữ liệu KPI từ file GBOC" },
        { status: 400 }
      );
    }

    let ctvUsers: Array<{ username: string; secondaryCode: string | null }> = [];
    try {
      ctvUsers = await prisma.user.findMany({
        where: { role: "CTV" },
        select: { username: true, secondaryCode: true },
      });
    } catch {
      const fallbackRows = await prisma.$queryRawUnsafe<
        Array<{ username: string; secondaryCode: string | null }>
      >(`SELECT username, secondaryCode FROM "User" WHERE role = 'CTV'`);
      ctvUsers = fallbackRows || [];
    }

    const secondaryToUsername = new Map<string, string>();
    for (const user of ctvUsers) {
      const secondary = String(user.secondaryCode || "").trim();
      if (!secondary) continue;
      if (!secondaryToUsername.has(secondary)) {
        secondaryToUsername.set(secondary, String(user.username || "").trim());
      }
    }

    const filteredRows = rows
      .map((row) => {
        const secondary = String(row.ctvUser || "").trim();
        const matchedUsername = secondaryToUsername.get(secondary);
        if (!matchedUsername) return null;
        return { ...row, ctvUser: matchedUsername };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const skippedRows = rows.length - filteredRows.length;
    if (!filteredRows.length) {
      return NextResponse.json(
        { error: "Không có dòng KPI nào khớp danh sách CTV trong hệ thống" },
        { status: 400 }
      );
    }

    const reportDate = filteredRows[0].reportDate;
    await assertArchiveMonthWritable(String(reportDate).slice(0, 7));

    const uniqueCodes = new Map<string, string>();
    for (const row of filteredRows) {
      if (!uniqueCodes.has(row.kpiCode)) {
        uniqueCodes.set(row.kpiCode, row.kpiName);
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "KpiDailyResult" WHERE "reportDate" = ?`,
          reportDate
        );

        for (const [code, name] of uniqueCodes.entries()) {
          await tx.$executeRawUnsafe(
            `
            INSERT INTO "KpiMetricConfig" ("kpiCode", "kpiName", "displayName")
            VALUES (?, ?, ?)
            ON CONFLICT("kpiCode") DO UPDATE SET
              "kpiName" = excluded."kpiName",
              "displayName" = excluded."displayName",
              "updatedAt" = CURRENT_TIMESTAMP
            `,
            code,
            name,
            name
          );
        }

        const chunkSize = 200;
        for (let i = 0; i < filteredRows.length; i += chunkSize) {
          const chunk = filteredRows.slice(i, i + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            row.reportDate,
            row.ctvUser,
            row.kpiCode,
            row.kpiName,
            row.khThang,
            row.thNgay,
            row.thLuyKe,
            row.completionPercent,
            row.growthPercent,
            row.rawPayload,
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "KpiDailyResult"
            ("reportDate","ctvUser","kpiCode","kpiName","khThang","thNgay","thLuyKe","completionPercent","growthPercent","rawPayload")
            VALUES ${valuesSql}
            `,
            ...params
          );
        }
      },
      { maxWait: 15000, timeout: 180000 }
    );

    clearCacheByPrefix("kpi:report");
    clearCacheByPrefix("kpi:summary");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({
      message: "Import KPI thành công",
      reportDate,
      inserted: filteredRows.length,
      skippedRows,
      kpiCount: uniqueCodes.size,
    });
  } catch (error) {
    console.error("KPI_IMPORT_ERROR", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";
    const status = message.includes("đã được xác nhận lưu trữ") ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? message : "Lỗi máy chủ nội bộ" },
      { status }
    );
  }
}
