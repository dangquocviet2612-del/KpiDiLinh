export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.errorResponse) return authResult.errorResponse;

    await ensureKpiTables();
    const rows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocCdConfig" WHERE "id" = 1 LIMIT 1`
    );
    const targetRatePercent = rows[0]?.targetRatePercent ?? 99.5;
    return NextResponse.json({ targetRatePercent });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi lấy cấu hình tỉ lệ Cước CD" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth({ roles: ["ADMIN"] });
    if (authResult.errorResponse) return authResult.errorResponse;

    await ensureKpiTables();

    const body = await request.json();
    const targetRatePercent = Number(body?.targetRatePercent);

    if (!Number.isFinite(targetRatePercent) || targetRatePercent < 0 || targetRatePercent > 200) {
      return NextResponse.json(
        { error: "Tỉ lệ giao không hợp lệ (từ 0% đến 200%)" },
        { status: 400 }
      );
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "CuocCdConfig" ("id", "targetRatePercent", "updatedAt")
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT("id") DO UPDATE SET
        "targetRatePercent" = excluded."targetRatePercent",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      targetRatePercent
    );

    clearCacheByPrefix("cuoc-cd:report");

    await recordAuditLog({
      userId: authResult.user.id,
      username: authResult.user.username,
      action: "CUOC_CD_CONFIG_UPDATE",
      resource: "CuocCdConfig",
      details: { targetRatePercent },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    });

    return NextResponse.json({
      message: "Cập nhật tỉ lệ Cước CD thành công",
      targetRatePercent,
    });
  } catch (error: any) {
    console.error("CUOC_CD_CONFIG_SAVE_ERROR", error);
    return NextResponse.json(
      { error: error.message || "Lỗi lưu tỉ lệ Cước CD" },
      { status: 500 }
    );
  }
}
