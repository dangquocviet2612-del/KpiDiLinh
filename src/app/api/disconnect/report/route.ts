export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  DISCONNECT_SOURCE_TYPES,
  normalizeDisconnectReportMonth,
  normalizeDisconnectSourceType,
} from "@/lib/disconnect";
import { buildCdtAccountSearchPattern, normalizeCdtAccountSearch } from "@/lib/cdt-account-search";
import { getCache, setCache } from "@/lib/kpi-cache";
import { ensureKpiTables } from "@/lib/kpi-db";
import { computeWindowedPageMeta } from "@/lib/prepaid-pagination";
import { getScopedPrepaidCtvUsers } from "@/lib/prepaid-query";
import { prisma } from "@/lib/prisma";

type DisconnectRow = {
  id: number;
  reportMonth: string;
  sourceType: string;
  account: string;
  serviceName: string | null;
  ctvCode: string;
  suspendedDateIso: string | null;
  suspendedDateText: string | null;
  cancelDateIso: string | null;
  cancelDateText: string | null;
  cancelMonth: string;
};

type DisconnectTotalsRow = {
  total: number;
  upcoming: number;
  overdue: number;
};

function emptyResponse(pageSize: number, reportMonth = "", availableReportMonths: string[] = []) {
  return {
    reportMonth,
    availableReportMonths,
    availableCancelMonths: [],
    rows: [],
    totals: {
      total: 0,
      upcoming: 0,
      overdue: 0,
    },
    pagination: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
  };
}

function normalizeScopeCode(value: string) {
  return String(value || "").trim().toUpperCase();
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureKpiTables();

    const isAdmin = session.user.role === "ADMIN";
    const canSelectCtv = isAdmin || session.user.role === "MANAGER";
    const url = new URL(request.url);
    const managerCode = String(url.searchParams.get("managerCode") || "").trim();
    const selectedCtv = String(url.searchParams.get("ctvUser") || "").trim();
    const accountFilter = normalizeCdtAccountSearch(url.searchParams.get("account"));
    const requestedReportMonth = normalizeDisconnectReportMonth(url.searchParams.get("reportMonth"));
    const cancelMonth = normalizeDisconnectReportMonth(url.searchParams.get("cancelMonth"));
    const sourceType = normalizeDisconnectSourceType(url.searchParams.get("sourceType"));
    const pageNum = Number(url.searchParams.get("page") || "1");
    const pageSizeNum = Number(url.searchParams.get("pageSize") || "40");
    const pageSize = Number.isFinite(pageSizeNum) ? Math.min(200, Math.max(20, Math.floor(pageSizeNum))) : 40;
    const requestedPage = Number.isFinite(pageNum) ? Math.max(1, Math.floor(pageNum)) : 1;

    const scopedUsers = await getScopedPrepaidCtvUsers({
      role: String(session.user.role || ""),
      sessionName: String(session.user.name || ""),
      managerCode: isAdmin ? managerCode : "",
    });

    if (!isAdmin && scopedUsers.length === 0) {
      return NextResponse.json(emptyResponse(pageSize));
    }

    const scopeWhere: string[] = [];
    const scopeParams: string[] = [];

    if (sourceType) {
      scopeWhere.push(`r."sourceType" = ?`);
      scopeParams.push(sourceType);
    } else {
      scopeWhere.push(`r."sourceType" IN (${DISCONNECT_SOURCE_TYPES.map(() => "?").join(",")})`);
      scopeParams.push(...DISCONNECT_SOURCE_TYPES);
    }

    if (!isAdmin || managerCode) {
      if (scopedUsers.length === 0) {
        return NextResponse.json(emptyResponse(pageSize));
      }
      scopeWhere.push(`UPPER(TRIM(r."ctvCode")) IN (${scopedUsers.map(() => "?").join(",")})`);
      scopeParams.push(...scopedUsers.map(normalizeScopeCode));
    }

    if (canSelectCtv && selectedCtv) {
      scopeWhere.push(`UPPER(TRIM(r."ctvCode")) = ?`);
      scopeParams.push(normalizeScopeCode(selectedCtv));
    }

    const accountLikePattern = buildCdtAccountSearchPattern(accountFilter);
    if (accountLikePattern) {
      scopeWhere.push(`LOWER(TRIM(r."account")) LIKE ?`);
      scopeParams.push(accountLikePattern);
    }

    const scopeWhereSql = scopeWhere.length ? `WHERE ${scopeWhere.join(" AND ")}` : "";
    const availableReportMonthsRows = await prisma.$queryRawUnsafe<Array<{ reportMonth: string }>>(
      `
      SELECT r."reportMonth"
      FROM "DisconnectRecord" r
      ${scopeWhereSql}
      GROUP BY r."reportMonth"
      ORDER BY r."reportMonth" DESC
      `,
      ...scopeParams,
    );

    const availableReportMonths = availableReportMonthsRows
      .map((row) => String(row.reportMonth || "").trim())
      .filter(Boolean);

    const reportMonth = requestedReportMonth || availableReportMonths[0] || "";
    if (!reportMonth) {
      return NextResponse.json(emptyResponse(pageSize));
    }

    const baseWhere = [...scopeWhere, `r."reportMonth" = ?`];
    const baseParams = [...scopeParams, reportMonth];
    const availableCancelMonthRows = await prisma.$queryRawUnsafe<Array<{ cancelMonth: string }>>(
      `
      SELECT r."cancelMonth"
      FROM "DisconnectRecord" r
      WHERE ${baseWhere.join(" AND ")}
      GROUP BY r."cancelMonth"
      ORDER BY r."cancelMonth" ASC
      `,
      ...baseParams,
    );

    const availableCancelMonths = availableCancelMonthRows
      .map((row) => String(row.cancelMonth || "").trim())
      .filter(Boolean);

    const scopedWhere = [...baseWhere];
    const scopedParams = [...baseParams];
    if (cancelMonth) {
      scopedWhere.push(`r."cancelMonth" = ?`);
      scopedParams.push(cancelMonth);
    }

    const cacheKey = [
      "disconnect:report",
      session.user.role || "",
      session.user.name || "",
      managerCode,
      selectedCtv,
      accountFilter,
      reportMonth,
      cancelMonth || "",
      sourceType || "ALL",
      requestedPage,
      pageSize,
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const todayIso = new Date().toISOString().slice(0, 10);
    const totalsRows = await prisma.$queryRawUnsafe<DisconnectTotalsRow[]>(
      `
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN COALESCE(r."cancelDateIso", '') >= ? THEN 1 ELSE 0 END), 0) as upcoming,
        COALESCE(SUM(CASE WHEN COALESCE(r."cancelDateIso", '') <> '' AND r."cancelDateIso" < ? THEN 1 ELSE 0 END), 0) as overdue
      FROM "DisconnectRecord" r
      WHERE ${scopedWhere.join(" AND ")}
      `,
      todayIso,
      todayIso,
      ...scopedParams,
    );

    const totalCountRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
      SELECT COUNT(*) as count
      FROM "DisconnectRecord" r
      WHERE ${scopedWhere.join(" AND ")}
      `,
      ...scopedParams,
    );

    const { totalCount, totalPages, page } = computeWindowedPageMeta(
      Number(totalCountRows[0]?.count || 0),
      requestedPage,
      pageSize,
    );
    const offset = Math.max(0, (page - 1) * pageSize);

    const rows =
      totalCount > 0
        ? await prisma.$queryRawUnsafe<DisconnectRow[]>(
            `
            SELECT
              r."id",
              r."reportMonth",
              r."sourceType",
              r."account",
              r."serviceName",
              r."ctvCode",
              r."suspendedDateIso",
              r."suspendedDateText",
              r."cancelDateIso",
              r."cancelDateText",
              r."cancelMonth"
            FROM "DisconnectRecord" r
            WHERE ${scopedWhere.join(" AND ")}
            ORDER BY
              COALESCE(r."cancelDateIso", '') ASC,
              r."sourceType" ASC,
              r."ctvCode" ASC,
              r."account" ASC
            LIMIT ? OFFSET ?
            `,
            ...scopedParams,
            pageSize,
            offset,
          )
        : [];

    const payload = {
      reportMonth,
      availableReportMonths,
      availableCancelMonths,
      rows,
      totals: {
        total: Number(totalsRows[0]?.total || 0),
        upcoming: Number(totalsRows[0]?.upcoming || 0),
        overdue: Number(totalsRows[0]?.overdue || 0),
      },
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    };

    setCache(cacheKey, payload, 30_000);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("DISCONNECT_REPORT_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
