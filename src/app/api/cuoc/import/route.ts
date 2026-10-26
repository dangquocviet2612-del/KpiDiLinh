export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { parseCuocWorkbook } from "@/lib/cuoc";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { assertArchiveMonthWritable } from "@/lib/archive";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file để tải lên" },
        { status: 400 }
      );
    }

    const rows = parseCuocWorkbook(Buffer.from(await file.arrayBuffer()));
    if (!rows.length) {
      return NextResponse.json(
        { error: "Không đọc được dữ liệu cước" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: { role: "CTV" },
      select: { username: true, secondaryCode: true },
    } as any);

    const mapSecondary = new Map<string, string>();
    const mapUsername = new Map<string, string>();
    for (const user of users as any[]) {
      const username = String(user.username || "").trim();
      if (username) mapUsername.set(username, username);
      const secondary = String(user.secondaryCode || "").trim();
      if (secondary) mapSecondary.set(secondary, username);
    }

    const normalized = rows
      .map((row) => {
        const code = String(row.employeeCodeRaw || "").trim();
        const ctvUser = mapSecondary.get(code) || mapUsername.get(code) || "";
        if (!ctvUser) return null;
        return { ...row, ctvUser };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (!normalized.length) {
      return NextResponse.json(
        { error: "Không có dòng nào map được CTV trong hệ thống" },
        { status: 400 }
      );
    }

    const reportDate = normalized[0].reportDate;
    await assertArchiveMonthWritable(String(reportDate).slice(0, 7));

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "CuocDailyResult" WHERE "reportDate" = ?`,
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
            row.targetAmount,
            row.collectedAmount,
            row.completionPercent,
            row.missingAmount,
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "CuocDailyResult"
            ("reportDate","ctvUser","employeeCodeRaw","managerCodeRaw","targetAmount","collectedAmount","completionPercent","missingAmount")
            VALUES ${valuesSql}
            `,
            ...params
          );
        }
      },
      { timeout: 120000, maxWait: 15000 }
    );

    clearCacheByPrefix("cuoc:report");
    clearCacheByPrefix("kpi:report");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({
      message: "Import cước thành công",
      reportDate,
      inserted: normalized.length,
      skippedRows: rows.length - normalized.length,
    });
  } catch (error) {
    console.error("CUOC_IMPORT_ERROR", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";
    const status = message.includes("đã được xác nhận lưu trữ") ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? message : "Lỗi máy chủ nội bộ" },
      { status }
    );
  }
}
