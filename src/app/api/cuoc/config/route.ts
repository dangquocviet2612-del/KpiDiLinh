export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { clearCacheByPrefix } from "@/lib/kpi-cache";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "B\u1EA1n ch\u01B0a \u0111\u0103ng nh\u1EADp" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n truy c\u1EADp c\u1EA5u h\u00ECnh c\u01B0\u1EDBc" }, { status: 403 });
    }

    await ensureKpiTables();
    const rows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocConfig" WHERE "id" = 1`
    );
    return NextResponse.json({ targetRatePercent: Number(rows[0]?.targetRatePercent ?? 97.3) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "L\u1ED7i t\u1EA3i c\u1EA5u h\u00ECnh c\u01B0\u1EDBc" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n th\u1EF1c hi\u1EC7n thao t\u00E1c n\u00E0y" }, { status: 401 });
    }

    await ensureKpiTables();
    const body = await request.json();
    const targetRatePercent = Number(body?.targetRatePercent);
    if (!Number.isFinite(targetRatePercent) || targetRatePercent <= 0 || targetRatePercent > 200) {
      return NextResponse.json({ error: "T\u1EF7 l\u1EC7 kh\u00F4ng h\u1EE3p l\u1EC7" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "CuocConfig" ("id","targetRatePercent","updatedAt")
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT("id") DO UPDATE SET
        "targetRatePercent" = excluded."targetRatePercent",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      targetRatePercent
    );
    clearCacheByPrefix("cuoc:report");
    clearCacheByPrefix("kpi:report");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({ ok: true, targetRatePercent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "L\u1ED7i l\u01B0u c\u1EA5u h\u00ECnh c\u01B0\u1EDBc" }, { status: 500 });
  }
}
