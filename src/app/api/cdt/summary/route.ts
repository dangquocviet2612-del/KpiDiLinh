export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { computeWindowedPageMeta } from "@/lib/prepaid-pagination";
import { getLatestCdtTransactionDate, getScopedPrepaidCtvUsers } from "@/lib/prepaid-query";

type SummaryRow = {
  ctvUser: string;
  nvThucHien: string;
  ftth: number;
  ths: number;
  camera: number;
  total: number;
  totalAmount: number;
};

export async function GET(request: Request) {
  const cacheGeneration = getCacheGeneration();
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Bạn không có quyền truy cập báo cáo CDT" }, { status: 403 });
    }

    await ensureKpiTables();

    const isAdmin = session.user.role === "ADMIN";
    const allowed = await getAccessibleCtvCodes(session);
    if (!isAdmin && (!allowed || allowed.length === 0)) {
      return NextResponse.json({ from: null, to: null, rows: [], totals: { ftth: 0, ths: 0, camera: 0, total: 0, totalAmount: 0 } });
    }

    const url = new URL(request.url);
    let from = (url.searchParams.get("from") || "").trim();
    let to = (url.searchParams.get("to") || "").trim();
    const managerCode = (url.searchParams.get("managerCode") || "").trim();
    const pageNum = Number(url.searchParams.get("page") || "1");
    const pageSizeNum = Number(url.searchParams.get("pageSize") || "40");
    const pageSize = Number.isFinite(pageSizeNum) ? Math.min(200, Math.max(20, Math.floor(pageSizeNum))) : 40;
    const requestedPage = Number.isFinite(pageNum) ? Math.max(1, Math.floor(pageNum)) : 1;

    const cacheKey = [
      "cdt:summary",
      session.user.role || "",
      session.user.name || "",
      from,
      to,
      managerCode,
      requestedPage,
      pageSize,
      isAdmin ? "admin" : (allowed || []).join(","),
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const where: string[] = [];
    const params: any[] = [];

    if (!isAdmin) {
      where.push(`c."ctvUser" IN (${(allowed || []).map(() => "?").join(",")})`);
      params.push(...(allowed || []));
    } else if (managerCode) {
      const list = await getScopedPrepaidCtvUsers({
        role: "ADMIN",
        sessionName: String(session.user.name || ""),
        managerCode,
      });
      if (!list.length) {
        return NextResponse.json({ from: null, to: null, rows: [], totals: { ftth: 0, ths: 0, camera: 0, total: 0, totalAmount: 0 } });
      }
      where.push(`c."ctvUser" IN (${list.map(() => "?").join(",")})`);
      params.push(...list);
    }

    if (!from && !to) {
      from = await getLatestCdtTransactionDate({
        role: String(session.user.role || ""),
        sessionName: String(session.user.name || ""),
        managerCode: isAdmin ? managerCode : "",
      });
      to = from;
    }
    if (from) {
      where.push(`c."transactionDate" >= ?`);
      params.push(from);
    }
    if (to) {
      where.push(`c."transactionDate" <= ?`);
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const overallTotals = await prisma.$queryRawUnsafe<Array<{ ftth: number; ths: number; camera: number; total: number; totalAmount: number; groupedUserCount: number }>>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN c."subscriberType" = 'FTTH' THEN 1 ELSE 0 END), 0) as ftth,
        COALESCE(SUM(CASE WHEN c."subscriberType" = 'THS' THEN 1 ELSE 0 END), 0) as ths,
        COALESCE(SUM(CASE WHEN c."subscriberType" = 'Camera' THEN 1 ELSE 0 END), 0) as camera,
        COUNT(*) as total,
        COALESCE(SUM(c."amount"), 0) as totalAmount,
        COUNT(DISTINCT c."ctvUser") as groupedUserCount
      FROM "CdtTransaction" c
      ${whereSql}
      `,
      ...params
    );

    const { totalCount, totalPages, page } = computeWindowedPageMeta(
      Number(overallTotals[0]?.groupedUserCount || 0),
      requestedPage,
      pageSize
    );
    const offset = Math.max(0, (page - 1) * pageSize);

    const raw = overallTotals[0] && Number(overallTotals[0]?.total || 0) > 0
      ? await prisma.$queryRawUnsafe<Array<any>>(
          `
          WITH grouped AS (
            SELECT
              c."ctvUser",
              SUM(CASE WHEN c."subscriberType" = 'FTTH' THEN 1 ELSE 0 END) as ftth,
              SUM(CASE WHEN c."subscriberType" = 'THS' THEN 1 ELSE 0 END) as ths,
              SUM(CASE WHEN c."subscriberType" = 'Camera' THEN 1 ELSE 0 END) as camera,
              COUNT(*) as total,
              SUM(c."amount") as totalAmount
            FROM "CdtTransaction" c
            ${whereSql}
            GROUP BY c."ctvUser"
          )
          SELECT
            grouped.*
          FROM grouped
          ORDER BY grouped."ctvUser" ASC
          LIMIT ? OFFSET ?
          `,
          ...params,
          pageSize,
          offset
        )
      : [];

    const rows: SummaryRow[] = raw.map((r) => {
      const ctvUser = String(r.ctvUser || "");
      return {
        ctvUser,
        nvThucHien: ctvUser,
        ftth: Number(r.ftth || 0),
        ths: Number(r.ths || 0),
        camera: Number(r.camera || 0),
        total: Number(r.total || 0),
        totalAmount: Number(r.totalAmount || 0),
      };
    });

    const totals = {
      ftth: Number(overallTotals[0]?.ftth || 0),
      ths: Number(overallTotals[0]?.ths || 0),
      camera: Number(overallTotals[0]?.camera || 0),
      total: Number(overallTotals[0]?.total || 0),
      totalAmount: Number(overallTotals[0]?.totalAmount || 0),
    };

    const payload = {
      from,
      to,
      rows,
      totals,
      pagination: { page, pageSize, totalCount, totalPages },
    };
    setCache(cacheKey, payload, 60_000, cacheGeneration);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("CDT_SUMMARY_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
