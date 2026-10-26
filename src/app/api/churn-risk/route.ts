export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureKpiTables } from "@/lib/kpi-db";
import { prisma } from "@/lib/prisma";
import { getAccessibleCtvCodes } from "@/lib/scope";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    await ensureKpiTables();

    const url = new URL(request.url);
    const reportMonth = url.searchParams.get("reportMonth") || "";
    const search = (url.searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get("pageSize") || "30", 10)));

    // Determine the report month to use
    let effectiveMonth = reportMonth;
    if (!effectiveMonth) {
      // Default to current month
      const now = new Date();
      effectiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    // Get accessible CTV codes based on role
    const accessibleCodes = await getAccessibleCtvCodes(session);

    // Build WHERE conditions
    const conditions: string[] = [`"reportMonth" = ?`];
    const params: any[] = [effectiveMonth];

    if (accessibleCodes !== null) {
      // Not admin - filter by accessible CTVs
      if (accessibleCodes.length === 0) {
        return NextResponse.json({
          rows: [],
          total: 0,
          reportMonth: effectiveMonth,
          page,
          pageSize,
          totalPages: 0,
        });
      }
      const placeholders = accessibleCodes.map(() => "?").join(", ");
      conditions.push(`"ctvCode" IN (${placeholders})`);
      params.push(...accessibleCodes);
    }

    if (search) {
      conditions.push(`(
        "customerName" LIKE ? OR
        "phone" LIKE ? OR
        "packageName" LIKE ? OR
        "address" LIKE ? OR
        "ctvCode" LIKE ?
      )`);
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
      `SELECT COUNT(*) as cnt FROM "ChurnRiskRecord" ${whereClause}`,
      ...params,
    );
    const total = Number(countResult[0]?.cnt || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    // Get rows
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "reportMonth", "ctvCode", "customerName", "phone", "packageName", "address"
       FROM "ChurnRiskRecord"
       ${whereClause}
       ORDER BY "ctvCode" ASC, "customerName" ASC
       LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    );

    // Get available months
    const months = await prisma.$queryRawUnsafe<Array<{ reportMonth: string }>>(
      `SELECT DISTINCT "reportMonth" FROM "ChurnRiskRecord" ORDER BY "reportMonth" DESC`,
    );

    return NextResponse.json({
      rows,
      total,
      reportMonth: effectiveMonth,
      page,
      pageSize,
      totalPages,
      availableMonths: months.map((m) => m.reportMonth),
    });
  } catch (error: any) {
    console.error("CHURN_RISK_GET_ERROR", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ nội bộ" },
      { status: 500 },
    );
  }
}
