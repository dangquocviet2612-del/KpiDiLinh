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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureKpiTables();
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        id, kpiCode, kpiName, displayName, mergeGroup, baseScore, maxPercent, sortOrder, isEnabled, isNegative
      FROM "KpiMetricConfig"
      ORDER BY sortOrder ASC, kpiCode ASC
    `);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Load config failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureKpiTables();
    const body = await request.json();
    const {
      kpiCode,
      displayName,
      baseScore,
      maxPercent,
      sortOrder,
      isEnabled,
      isNegative,
      mergeGroup,
      kpiName,
    } = body || {};

    if (!kpiCode) return NextResponse.json({ error: "kpiCode is required" }, { status: 400 });

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "KpiMetricConfig"
      ("kpiCode","kpiName","displayName","mergeGroup","baseScore","maxPercent","sortOrder","isEnabled","isNegative","updatedAt")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT("kpiCode") DO UPDATE SET
        "kpiName" = excluded."kpiName",
        "displayName" = excluded."displayName",
        "mergeGroup" = excluded."mergeGroup",
        "baseScore" = excluded."baseScore",
        "maxPercent" = excluded."maxPercent",
        "sortOrder" = excluded."sortOrder",
        "isEnabled" = excluded."isEnabled",
        "isNegative" = excluded."isNegative",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      String(kpiCode),
      kpiName ? String(kpiName) : null,
      displayName ? String(displayName) : null,
      mergeGroup ? String(mergeGroup) : null,
      Number(baseScore ?? 10),
      Number(maxPercent ?? 120),
      Number(sortOrder ?? 0),
      isEnabled ? 1 : 0,
      isNegative ? 1 : 0
    );

    clearCacheByPrefix("kpi:report");
    clearCacheByPrefix("kpi:summary");
    clearCacheByPrefix("kpi:manager-summary");

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Save config failed" }, { status: 500 });
  }
}
