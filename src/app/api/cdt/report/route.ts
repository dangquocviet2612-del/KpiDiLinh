export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, setCache } from "@/lib/kpi-cache";
import { buildCdtAccountSearchPattern, normalizeCdtAccountSearch } from "@/lib/cdt-account-search";
import {
  getLatestCdtTransactionDate,
  getLatestCdtTransactionDateForCtv,
  getScopedPrepaidCtvUsers,
} from "@/lib/prepaid-query";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    await ensureKpiTables();

    const role = String(session.user.role || "");
    const isAdmin = role === "ADMIN";
    const isManager = role === "MANAGER";
    const isCtv = role === "CTV";
    if (!isAdmin && !isManager && !isCtv) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập dữ liệu CDT" }, { status: 403 });
    }

    const url = new URL(request.url);
    const date = (url.searchParams.get("date") || "").trim();
    let from = (url.searchParams.get("from") || "").trim();
    let to = (url.searchParams.get("to") || "").trim();
    const ctvUserQuery = (url.searchParams.get("ctvUser") || "").trim();
    const accountQuery = normalizeCdtAccountSearch(url.searchParams.get("account"));
    const managerCode = (url.searchParams.get("managerCode") || "").trim();
    const pageNum = Number(url.searchParams.get("page") || "1");
    const pageSizeNum = Number(url.searchParams.get("pageSize") || "60");
    const pageSize = Number.isFinite(pageSizeNum) ? Math.min(200, Math.max(20, Math.floor(pageSizeNum))) : 60;
    const requestedPage = Number.isFinite(pageNum) ? Math.max(1, Math.floor(pageNum)) : 1;

    const allowed = await getAccessibleCtvCodes(session);
    if ((isManager || isCtv) && (!allowed || allowed.length === 0)) {
      return NextResponse.json({
        date: null,
        rows: [],
        totals: { count: 0, totalAmount: 0, totalMonths: 0, ftth: 0, ths: 0, camera: 0 },
      });
    }

    const cacheKey = [
      "cdt:report",
      role,
      session.user.name || "",
      date,
      from,
      to,
      ctvUserQuery,
      accountQuery,
      managerCode,
      requestedPage,
      pageSize,
      isAdmin ? "admin" : (allowed || []).join(","),
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const where: string[] = [];
    const params: any[] = [];

    if (isCtv) {
      where.push(`c."ctvUser" = ?`);
      params.push(String(session.user.name || ""));
    } else if (isManager) {
      where.push(`c."ctvUser" IN (${(allowed || []).map(() => "?").join(",")})`);
      params.push(...(allowed || []));
      if (ctvUserQuery) {
        where.push(`c."ctvUser" = ?`);
        params.push(ctvUserQuery);
      }
    } else {
      if (ctvUserQuery) {
        where.push(`c."ctvUser" = ?`);
        params.push(ctvUserQuery);
      }
      if (managerCode) {
        const users = await getScopedPrepaidCtvUsers({
          role: "ADMIN",
          sessionName: String(session.user.name || ""),
          managerCode,
        });
        if (!users.length) {
          return NextResponse.json({
            date: null,
            rows: [],
            totals: { count: 0, totalAmount: 0, totalMonths: 0, ftth: 0, ths: 0, camera: 0 },
          });
        }
        where.push(`c."ctvUser" IN (${users.map(() => "?").join(",")})`);
        params.push(...users);
      }
    }
    const accountLikePattern = buildCdtAccountSearchPattern(accountQuery);
    if (accountLikePattern) {
      where.push(`LOWER(TRIM(c."account")) LIKE ?`);
      params.push(accountLikePattern);
    }

    if (!date && !from && !to) {
      from = ctvUserQuery
        ? await getLatestCdtTransactionDateForCtv(ctvUserQuery)
        : await getLatestCdtTransactionDate({
            role,
            sessionName: String(session.user.name || ""),
            managerCode: isAdmin ? managerCode : "",
          });
      to = from;
    }

    if (date) {
      where.push(`c."transactionDate" = ?`);
      params.push(date);
    } else {
      if (from) {
        where.push(`c."transactionDate" >= ?`);
        params.push(from);
      }
      if (to) {
        where.push(`c."transactionDate" <= ?`);
        params.push(to);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const aggregate = await prisma.$queryRawUnsafe<Array<{
      totalCount: number;
      totalAmount: number;
      totalMonths: number;
      ftth: number;
      ths: number;
      camera: number;
    }>>(
      `
        SELECT
          COUNT(1) as totalCount,
          COALESCE(SUM(c."amount"), 0) as totalAmount,
          COALESCE(SUM(c."months"), 0) as totalMonths,
          COALESCE(SUM(CASE WHEN c."subscriberType" = 'FTTH' THEN 1 ELSE 0 END), 0) as ftth,
          COALESCE(SUM(CASE WHEN c."subscriberType" = 'THS' THEN 1 ELSE 0 END), 0) as ths,
          COALESCE(SUM(CASE WHEN c."subscriberType" = 'CAMERA' THEN 1 ELSE 0 END), 0) as camera
        FROM "CdtTransaction" c
        ${whereSql}
      `,
      ...params
    );

    const totalCount = Number(aggregate[0]?.totalCount || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const rows = totalCount
      ? await prisma.$queryRawUnsafe<Array<any>>(
          `
            SELECT
              c."transactionDate",
              c."transactionTime",
              c."ctvUser",
              c."subscriberType",
              c."account",
              c."amount",
              c."months"
            FROM "CdtTransaction" c
            ${whereSql}
            ORDER BY c."transactionDate" DESC, c."ctvUser" ASC, c."account" ASC
            LIMIT ? OFFSET ?
          `,
          ...params,
          pageSize,
          offset
        )
      : [];

    const totals = {
      count: totalCount,
      totalAmount: Number(aggregate[0]?.totalAmount || 0),
      totalMonths: Number(aggregate[0]?.totalMonths || 0),
      ftth: Number(aggregate[0]?.ftth || 0),
      ths: Number(aggregate[0]?.ths || 0),
      camera: Number(aggregate[0]?.camera || 0),
    };

    const payload = {
      date,
      from,
      to,
      rows,
      totals,
      pagination: { page, pageSize, totalCount, totalPages },
    };
    setCache(cacheKey, payload, 60_000);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("CDT_REPORT_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
