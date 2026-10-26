export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  OUTSTANDING_STATUS_COLLECTED,
  OUTSTANDING_STATUS_PENDING,
  OUTSTANDING_STATUS_UNKNOWN,
  normalizeOutstandingExpiryMonth,
  normalizeOutstandingReportMonth,
  normalizeOutstandingStatus,
} from "@/lib/cdt-outstanding";
import { buildCdtAccountSearchPattern, normalizeCdtAccountSearch } from "@/lib/cdt-account-search";
import { getCache, setCache } from "@/lib/kpi-cache";
import { ensureKpiTables } from "@/lib/kpi-db";
import { computeWindowedPageMeta } from "@/lib/prepaid-pagination";
import { getScopedPrepaidCtvUsers } from "@/lib/prepaid-query";
import { prisma } from "@/lib/prisma";

type OutstandingTotalsRow = {
  total: number;
  chuaThu: number;
  daThu: number;
  ftth: number;
  ths: number;
  camera: number;
  khac: number;
  chuaThuFtth: number;
  chuaThuThs: number;
  chuaThuCamera: number;
  chuaThuKhac: number;
  daThuFtth: number;
  daThuThs: number;
  daThuCamera: number;
  daThuKhac: number;
};

type OutstandingRow = {
  id: number;
  reportMonth: string;
  account: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  ctvCode: string;
  serviceName: string | null;
  expiryDateText: string | null;
  expiryMonth: string;
  statusCheck: string;
  subscriberType: string;
};

function emptyResponse(pageSize: number, reportMonth = "", availableReportMonths: string[] = []) {
  return {
    reportMonth,
    availableReportMonths,
    availableExpiryMonths: [],
    rows: [],
    totals: {
      total: 0,
      chuaThu: 0,
      daThu: 0,
      ftth: 0,
      ths: 0,
      camera: 0,
      khac: 0,
      chuaThuFtth: 0,
      chuaThuThs: 0,
      chuaThuCamera: 0,
      chuaThuKhac: 0,
      daThuFtth: 0,
      daThuThs: 0,
      daThuCamera: 0,
      daThuKhac: 0,
    },
    pagination: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
  };
}

function normalizeStatusFilter(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const normalized = normalizeOutstandingStatus(trimmed);
  return normalized === OUTSTANDING_STATUS_UNKNOWN ? "" : normalized;
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
    const requestedReportMonth = normalizeOutstandingReportMonth(url.searchParams.get("reportMonth"));
    const expiryMonth = normalizeOutstandingExpiryMonth(url.searchParams.get("expiryMonth"));
    const statusFilter = normalizeStatusFilter(String(url.searchParams.get("status") || OUTSTANDING_STATUS_PENDING));
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

    if (!isAdmin || managerCode) {
      if (scopedUsers.length === 0) {
        return NextResponse.json(emptyResponse(pageSize));
      }
      scopeWhere.push(`r."ctvCode" IN (${scopedUsers.map(() => "?").join(",")})`);
      scopeParams.push(...scopedUsers);
    }

    if (canSelectCtv && selectedCtv) {
      scopeWhere.push(`r."ctvCode" = ?`);
      scopeParams.push(selectedCtv);
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
      FROM "CdtOutstandingRecord" r
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
    const availableExpiryMonthRows = await prisma.$queryRawUnsafe<Array<{ expiryMonth: string }>>(
      `
      SELECT r."expiryMonth"
      FROM "CdtOutstandingRecord" r
      WHERE ${baseWhere.join(" AND ")}
      GROUP BY r."expiryMonth"
      ORDER BY r."expiryMonth" ASC
      `,
      ...baseParams,
    );

    const availableExpiryMonths = availableExpiryMonthRows
      .map((row) => String(row.expiryMonth || "").trim())
      .filter(Boolean);

    const scopedWhere = [...baseWhere];
    const scopedParams = [...baseParams];
    if (expiryMonth) {
      scopedWhere.push(`r."expiryMonth" = ?`);
      scopedParams.push(expiryMonth);
    }

    const dynamicStatusSql =
      statusFilter === OUTSTANDING_STATUS_PENDING || statusFilter === OUTSTANDING_STATUS_COLLECTED
        ? `WHERE "statusCheck" = ?`
        : "";
    const statusParams =
      statusFilter === OUTSTANDING_STATUS_PENDING || statusFilter === OUTSTANDING_STATUS_COLLECTED ? [statusFilter] : [];

    const cacheKey = [
      "cdt:outstanding",
      session.user.role || "",
      session.user.name || "",
      managerCode,
      selectedCtv,
      accountFilter,
      reportMonth,
      expiryMonth || "",
      statusFilter || "",
      requestedPage,
      pageSize,
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const scopedCteSql = `
      WITH collected_accounts AS (
        SELECT DISTINCT LOWER(TRIM("account")) AS "accountKey"
        FROM "CdtTransaction"
        WHERE substr("transactionDate", 1, 7) = ?
      ),
      scoped AS (
        SELECT
          r."id",
          r."reportMonth",
          r."account",
          r."customerName",
          r."phone",
          r."address",
          r."ctvCode",
          r."serviceName",
          r."expiryDateText",
          r."expiryMonth",
          CASE
            WHEN c."accountKey" IS NOT NULL THEN '${OUTSTANDING_STATUS_COLLECTED}'
            ELSE '${OUTSTANDING_STATUS_PENDING}'
          END AS "statusCheck",
          r."subscriberType"
        FROM "CdtOutstandingRecord" r
        LEFT JOIN collected_accounts c
          ON c."accountKey" = LOWER(TRIM(r."account"))
        WHERE ${scopedWhere.join(" AND ")}
      )
    `;

    const totalsRows = await prisma.$queryRawUnsafe<OutstandingTotalsRow[]>(
      `
      ${scopedCteSql}
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? THEN 1 ELSE 0 END), 0) as chuaThu,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? THEN 1 ELSE 0 END), 0) as daThu,
        COALESCE(SUM(CASE WHEN "subscriberType" = 'FTTH' THEN 1 ELSE 0 END), 0) as ftth,
        COALESCE(SUM(CASE WHEN "subscriberType" = 'THS' THEN 1 ELSE 0 END), 0) as ths,
        COALESCE(SUM(CASE WHEN "subscriberType" = 'Camera' THEN 1 ELSE 0 END), 0) as camera,
        COALESCE(SUM(CASE WHEN "subscriberType" NOT IN ('FTTH', 'THS', 'Camera') THEN 1 ELSE 0 END), 0) as khac,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'FTTH' THEN 1 ELSE 0 END), 0) as chuaThuFtth,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'THS' THEN 1 ELSE 0 END), 0) as chuaThuThs,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'Camera' THEN 1 ELSE 0 END), 0) as chuaThuCamera,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" NOT IN ('FTTH', 'THS', 'Camera') THEN 1 ELSE 0 END), 0) as chuaThuKhac,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'FTTH' THEN 1 ELSE 0 END), 0) as daThuFtth,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'THS' THEN 1 ELSE 0 END), 0) as daThuThs,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" = 'Camera' THEN 1 ELSE 0 END), 0) as daThuCamera,
        COALESCE(SUM(CASE WHEN "statusCheck" = ? AND "subscriberType" NOT IN ('FTTH', 'THS', 'Camera') THEN 1 ELSE 0 END), 0) as daThuKhac
      FROM scoped
      `,
      reportMonth,
      ...scopedParams,
      OUTSTANDING_STATUS_PENDING,
      OUTSTANDING_STATUS_COLLECTED,
      OUTSTANDING_STATUS_PENDING,
      OUTSTANDING_STATUS_PENDING,
      OUTSTANDING_STATUS_PENDING,
      OUTSTANDING_STATUS_PENDING,
      OUTSTANDING_STATUS_COLLECTED,
      OUTSTANDING_STATUS_COLLECTED,
      OUTSTANDING_STATUS_COLLECTED,
      OUTSTANDING_STATUS_COLLECTED,
    );

    const totalCountRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
      ${scopedCteSql}
      SELECT COUNT(*) as count
      FROM scoped
      ${dynamicStatusSql}
      `,
      reportMonth,
      ...scopedParams,
      ...statusParams,
    );

    const { totalCount, totalPages, page } = computeWindowedPageMeta(
      Number(totalCountRows[0]?.count || 0),
      requestedPage,
      pageSize,
    );
    const offset = Math.max(0, (page - 1) * pageSize);

    const rows =
      totalCount > 0
        ? await prisma.$queryRawUnsafe<OutstandingRow[]>(
            `
            ${scopedCteSql}
            SELECT
              "id",
              "reportMonth",
              "account",
              "customerName",
              "phone",
              "address",
              "ctvCode",
              "serviceName",
              "expiryDateText",
              "expiryMonth",
              "statusCheck",
              "subscriberType"
            FROM scoped
            ${dynamicStatusSql}
            ORDER BY
              CASE WHEN "statusCheck" = ? THEN 0 ELSE 1 END ASC,
              "expiryMonth" ASC,
              "ctvCode" ASC,
              "account" ASC
            LIMIT ? OFFSET ?
            `,
            reportMonth,
            ...scopedParams,
            ...statusParams,
            OUTSTANDING_STATUS_PENDING,
            pageSize,
            offset,
          )
        : [];

    const payload = {
      reportMonth,
      availableReportMonths,
      availableExpiryMonths,
      rows,
      totals: {
        total: Number(totalsRows[0]?.total || 0),
        chuaThu: Number(totalsRows[0]?.chuaThu || 0),
        daThu: Number(totalsRows[0]?.daThu || 0),
        ftth: Number(totalsRows[0]?.ftth || 0),
        ths: Number(totalsRows[0]?.ths || 0),
        camera: Number(totalsRows[0]?.camera || 0),
        khac: Number(totalsRows[0]?.khac || 0),
        chuaThuFtth: Number(totalsRows[0]?.chuaThuFtth || 0),
        chuaThuThs: Number(totalsRows[0]?.chuaThuThs || 0),
        chuaThuCamera: Number(totalsRows[0]?.chuaThuCamera || 0),
        chuaThuKhac: Number(totalsRows[0]?.chuaThuKhac || 0),
        daThuFtth: Number(totalsRows[0]?.daThuFtth || 0),
        daThuThs: Number(totalsRows[0]?.daThuThs || 0),
        daThuCamera: Number(totalsRows[0]?.daThuCamera || 0),
        daThuKhac: Number(totalsRows[0]?.daThuKhac || 0),
      },
      pagination: { page, pageSize, totalCount, totalPages },
    };

    setCache(cacheKey, payload, 30_000);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("CDT_OUTSTANDING_REPORT_ERROR", error);
    return NextResponse.json({ error: error?.message || "Loi may chu noi bo" }, { status: 500 });
  }
}
