export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { parseCuocCdWorkbook } from "@/lib/cuoc-cd";
import { clearCacheByPrefix } from "@/lib/kpi-cache";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    await ensureKpiTables();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file để tải lên" },
        { status: 400 }
      );
    }

    const configRows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocCdConfig" WHERE "id" = 1 LIMIT 1`
    );
    const targetRatePercent = configRows[0]?.targetRatePercent ?? 99.5;

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedRows = parseCuocCdWorkbook(buffer, targetRatePercent);
    if (!parsedRows.length) {
      return NextResponse.json(
        { error: "Không đọc được dữ liệu Cước CD" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      select: { username: true, secondaryCode: true },
    } as any);

    const mapSecondary = new Map<string, string>();
    const mapUsername = new Map<string, string>();
    for (const user of users as any[]) {
      const username = String(user.username || "").trim();
      if (username) mapUsername.set(username.toLowerCase(), username);
      const secondary = String(user.secondaryCode || "").trim();
      if (secondary) mapSecondary.set(secondary.toLowerCase(), username);
    }

    const normalized = parsedRows.map((row) => {
      const code = String(row.employeeCodeRaw || "").trim();
      const codeLower = code.toLowerCase();
      const ctvUser = mapSecondary.get(codeLower) || mapUsername.get(codeLower) || code;
      return { ...row, ctvUser };
    });

    const reportDate = normalized[0].reportDate;

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "CuocCdDailyResult" WHERE "reportDate" = ?`,
          reportDate
        );

        const chunkSize = 300;
        for (let i = 0; i < normalized.length; i += chunkSize) {
          const chunk = normalized.slice(i, i + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            row.reportDate,
            row.ctvUser,
            row.employeeCodeRaw,
            row.managerCodeRaw,
            row.dauKy,
            row.luyKe,
            row.thuaThieu,
            row.tonChuaThu,
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "CuocCdDailyResult"
            ("reportDate","ctvUser","employeeCodeRaw","managerCodeRaw","dauKy","luyKe","thuaThieu","tonChuaThu")
            VALUES ${valuesSql}
            `,
            ...params
          );
        }
      },
      { timeout: 120000, maxWait: 15000 }
    );

    clearCacheByPrefix("cuoc-cd:report");

    return NextResponse.json({
      message: "Import Cước CD thành công",
      reportDate,
      inserted: normalized.length,
    });
  } catch (error) {
    console.error("CUOC_CD_IMPORT_ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
