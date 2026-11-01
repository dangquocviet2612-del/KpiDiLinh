export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { parseCuocCdWorkbook } from "@/lib/cuoc-cd";
import { clearCacheByPrefix } from "@/lib/kpi-cache";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }

    await ensureRuntimeSchema("cuocFtth");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Vui lòng chọn file để tải lên" }, { status: 400 });
    }

    const configRows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocFtthConfig" WHERE "id" = 1 LIMIT 1`
    );
    const targetRatePercent = configRows[0]?.targetRatePercent ?? 99.5;
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedRows = parseCuocCdWorkbook(buffer, targetRatePercent);
    if (!parsedRows.length) {
      return NextResponse.json({ error: "Không đọc được dữ liệu Cước FTTH" }, { status: 400 });
    }

    const users = await prisma.user.findMany({ select: { username: true, secondaryCode: true } });
    const mapSecondary = new Map<string, string>();
    const mapUsername = new Map<string, string>();
    for (const user of users) {
      const username = String(user.username || "").trim();
      if (username) mapUsername.set(username.toLowerCase(), username);
      const secondary = String(user.secondaryCode || "").trim();
      if (secondary) mapSecondary.set(secondary.toLowerCase(), username);
    }
    const normalized = parsedRows.map((row) => {
      const code = String(row.employeeCodeRaw || "").trim();
      const codeLower = code.toLowerCase();
      return { ...row, ctvUser: mapSecondary.get(codeLower) || mapUsername.get(codeLower) || code };
    });
    const reportDate = normalized[0].reportDate;

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`DELETE FROM "CuocFtthDailyResult" WHERE "reportDate" = ?`, reportDate);
      const chunkSize = 100;
      for (let index = 0; index < normalized.length; index += chunkSize) {
        const chunk = normalized.slice(index, index + chunkSize);
        const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
        const params = chunk.flatMap((row) => [
          row.reportDate, row.ctvUser, row.employeeCodeRaw, row.managerCodeRaw,
          row.dauKy, row.luyKe, row.thuaThieu, row.tonChuaThu,
        ]);
        await transaction.$executeRawUnsafe(
          `INSERT INTO "CuocFtthDailyResult"
           ("reportDate","ctvUser","employeeCodeRaw","managerCodeRaw","dauKy","luyKe","thuaThieu","tonChuaThu")
           VALUES ${valuesSql}`,
          ...params
        );
      }
    }, { timeout: 120000, maxWait: 15000 });

    clearCacheByPrefix("cuoc-ftth:report");
    return NextResponse.json({ message: "Import Cước FTTH thành công", reportDate, inserted: normalized.length });
  } catch (error) {
    console.error("CUOC_FTTH_IMPORT_ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
