export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const authResult = await requireAuth({ roles: ["ADMIN", "MANAGER", "CTV"] });
    if (authResult.errorResponse) return authResult.errorResponse;

    await ensureRuntimeSchema("cuocFtth");
    const rows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocFtthConfig" WHERE "id" = 1 LIMIT 1`
    );
    return NextResponse.json({ targetRatePercent: rows[0]?.targetRatePercent ?? 99.5 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi lấy cấu hình tỉ lệ Cước FTTH" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth({ roles: ["ADMIN"] });
    if (authResult.errorResponse) return authResult.errorResponse;

    await ensureRuntimeSchema("cuocFtth");
    const body = await request.json();
    const targetRatePercent: unknown = body?.targetRatePercent;
    if (typeof targetRatePercent !== "number" || !Number.isFinite(targetRatePercent) || targetRatePercent < 0 || targetRatePercent > 200) {
      return NextResponse.json(
        { error: "Tỉ lệ giao không hợp lệ (từ 0% đến 200%)" },
        { status: 400 }
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "CuocFtthConfig" ("id", "targetRatePercent", "updatedAt")
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT("id") DO UPDATE SET
         "targetRatePercent" = excluded."targetRatePercent",
         "updatedAt" = CURRENT_TIMESTAMP`,
      targetRatePercent
    );
    clearCacheByPrefix("cuoc-ftth:report");
    await recordAuditLog({
      userId: authResult.user.id,
      username: authResult.user.username,
      action: "CUOC_FTTH_CONFIG_UPDATE",
      resource: "CuocFtthConfig",
      details: { targetRatePercent },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    });
    return NextResponse.json({ message: "Cập nhật tỉ lệ Cước FTTH thành công", targetRatePercent });
  } catch (error) {
    console.error("CUOC_FTTH_CONFIG_SAVE_ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi lưu tỉ lệ Cước FTTH" },
      { status: 500 }
    );
  }
}
