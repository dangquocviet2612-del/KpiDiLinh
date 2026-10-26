export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, setCache } from "@/lib/kpi-cache";
import {
  getCuocTargetRatePercent,
  getLatestCuocReportDate,
  getLatestKpiReportDate,
  getScopedPrepaidCtvUsers,
} from "@/lib/prepaid-query";
import {
  computeCuocN1N3CompletionPercent,
  computeKpiCompletionPercent,
  DEFAULT_KPI_MAX_PERCENT,
  isCuocN1N3MetricKey,
  isNegativeMetricKey,
  normalizeMetricKey,
} from "@/lib/kpi-scoring";
import { computeKpiAdverseGap } from "@/lib/kpi-summary";

type BaseRow = {
  name: string;
  sortOrder: number;
};

type SummaryAggRow = {
  ctvUser: string;
  kh: number | null;
  th: number | null;
};

const CUOC_RATE_KPI_CODE = "CUOC_N1_N3_RATE";

function isCuocRateGroup(group: string) {
  return isCuocN1N3MetricKey(group) || normalizeMetricKey(group) === CUOC_RATE_KPI_CODE;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Bạn không có quyền truy cập tổng hợp KPI" }, { status: 403 });
    }

    await ensureKpiTables();

    const url = new URL(request.url);
    const group = (url.searchParams.get("group") || "").trim();
    const managerCode = (url.searchParams.get("managerCode") || "").trim();
    let reportDate = (url.searchParams.get("reportDate") || "").trim();

    const allowed = await getAccessibleCtvCodes(session);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && (!allowed || allowed.length === 0)) {
      return NextResponse.json({ reportDate: null, indicators: [], rows: [] });
    }

    if (!reportDate) {
      reportDate = await getLatestKpiReportDate({
        role: String(session.user.role || ""),
        sessionName: String(session.user.name || ""),
        managerCode: isAdmin ? managerCode : "",
      });
    }

    if (!reportDate) {
      return NextResponse.json({ reportDate: null, indicators: [], rows: [] });
    }

    const cacheKey = [
      "kpi:summary",
      session.user.role || "",
      session.user.name || "",
      reportDate,
      group,
      managerCode,
      isAdmin ? "admin" : (allowed || []).join(","),
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const scopedUsers = await getScopedPrepaidCtvUsers({
      role: String(session.user.role || ""),
      sessionName: String(session.user.name || ""),
      managerCode: isAdmin ? managerCode : "",
    });

    if (!scopedUsers.length) {
      const responsePayload = {
        reportDate,
        indicators: [],
        rows: [],
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
      };
      setCache(cacheKey, responsePayload, 60_000);
      return NextResponse.json(responsePayload);
    }

    const indicatorRows = await prisma.$queryRawUnsafe<BaseRow[]>(
      `
      SELECT
        COALESCE("mergeGroup", "displayName", "kpiName", "kpiCode") AS "name",
        MIN(COALESCE("sortOrder", 0)) AS "sortOrder"
      FROM "KpiMetricConfig"
      WHERE COALESCE("isEnabled", 1) = 1
      GROUP BY COALESCE("mergeGroup", "displayName", "kpiName", "kpiCode")
      ORDER BY "sortOrder" ASC, "name" ASC
      `
    );
    const indicators = indicatorRows.map((row) => String(row.name || "").trim()).filter(Boolean);

    const effectiveGroup = group || indicators[0] || "";

    if (!effectiveGroup) {
      const responsePayload = {
        reportDate,
        indicators,
        rows: [],
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
        selectedGroup: "",
      };
      setCache(cacheKey, responsePayload, 60_000);
      return NextResponse.json(responsePayload);
    }

    if (isCuocRateGroup(effectiveGroup)) {
      const detailMap = new Map<string, { ctvUser: string; kh: number; th: number }>();
      const scopeSql = ` AND "ctvUser" IN (${scopedUsers.map(() => "?").join(",")})`;

      const targetRatePercent = await getCuocTargetRatePercent();

      let finalReportDate = reportDate;
      let cuocRows = await prisma.$queryRawUnsafe<Array<{ ctvUser: string; completionPercent: number | null }>>(
        `
        SELECT "ctvUser", "completionPercent"
        FROM "CuocDailyResult"
        WHERE "reportDate" = ? ${scopeSql}
        ORDER BY "ctvUser" ASC
        `,
        finalReportDate,
        ...scopedUsers
      );

      if (cuocRows.length === 0) {
        const fallbackDate = await getLatestCuocReportDate({
          role: String(session.user.role || ""),
          sessionName: String(session.user.name || ""),
          managerCode: isAdmin ? managerCode : "",
        });
        if (fallbackDate && fallbackDate !== finalReportDate) {
          finalReportDate = fallbackDate;
          cuocRows = await prisma.$queryRawUnsafe<Array<{ ctvUser: string; completionPercent: number | null }>>(
            `
            SELECT "ctvUser", "completionPercent"
            FROM "CuocDailyResult"
            WHERE "reportDate" = ? ${scopeSql}
            ORDER BY "ctvUser" ASC
            `,
            finalReportDate,
            ...scopedUsers
          );
        }
      }

      for (const username of scopedUsers) {
        detailMap.set(username, { ctvUser: username, kh: targetRatePercent, th: 0 });
      }

      for (const row of cuocRows) {
        const ctv = String(row.ctvUser || "").trim();
        if (!ctv) continue;
        detailMap.set(ctv, {
          ctvUser: ctv,
          kh: targetRatePercent,
          th: Number(row.completionPercent || 0),
        });
      }

      const rows = Array.from(detailMap.values())
        .map((r) => {
          const percent = computeCuocN1N3CompletionPercent(r.th, {
            maxPercent: DEFAULT_KPI_MAX_PERCENT,
          });
          const thieu = computeKpiAdverseGap(r.kh, r.th, false);
          return {
            ctvUser: r.ctvUser,
            kh: Number(r.kh.toFixed(2)),
            th: Number(r.th.toFixed(2)),
            percent: Number(percent.toFixed(2)),
            thieu,
          };
        })
        .sort((a, b) => a.ctvUser.localeCompare(b.ctvUser));

      const responsePayload = {
        reportDate: finalReportDate,
        indicators,
        rows,
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
        selectedGroup: effectiveGroup,
      };
      setCache(cacheKey, responsePayload, 60_000);
      return NextResponse.json(responsePayload);
    }

    const groupMetaRows = await prisma.$queryRawUnsafe<Array<{
      kpiCode: string | null;
      displayName: string | null;
      kpiName: string | null;
      mergeGroup: string | null;
      maxPercent: number | null;
      isNegative: number | null;
    }>>(
      `
      SELECT
        "kpiCode",
        "displayName",
        "kpiName",
        "mergeGroup",
        "maxPercent",
        "isNegative"
      FROM "KpiMetricConfig"
      WHERE COALESCE("isEnabled", 1) = 1
        AND COALESCE("mergeGroup", "displayName", "kpiName", "kpiCode") = ?
      `,
      effectiveGroup
    );

    const isNegativeGroup =
      groupMetaRows.some((row) =>
        Number(row.isNegative || 0) === 1 ||
        isNegativeMetricKey(row.kpiCode) ||
        isNegativeMetricKey(row.displayName) ||
        isNegativeMetricKey(row.kpiName) ||
        isNegativeMetricKey(row.mergeGroup)
      ) || isNegativeMetricKey(group);
    const effectiveNegativeGroup = isNegativeGroup || isNegativeMetricKey(effectiveGroup);
    const maxPercent = groupMetaRows.reduce(
      (acc, row) => Math.max(acc, Number(row.maxPercent ?? DEFAULT_KPI_MAX_PERCENT)),
      DEFAULT_KPI_MAX_PERCENT
    );

    const detailMap = new Map<string, { ctvUser: string; kh: number; th: number }>();
    for (const username of scopedUsers) {
      detailMap.set(username, { ctvUser: username, kh: 0, th: 0 });
    }

    const scopeSql = ` AND d."ctvUser" IN (${scopedUsers.map(() => "?").join(",")})`;
    const aggRows = await prisma.$queryRawUnsafe<SummaryAggRow[]>(
      `
      SELECT
        d."ctvUser" AS "ctvUser",
        SUM(COALESCE(d."khThang", 0)) AS "kh",
        SUM(COALESCE(d."thLuyKe", d."thNgay", 0)) AS "th"
      FROM "KpiDailyResult" d
      INNER JOIN "KpiMetricConfig" c ON c."kpiCode" = d."kpiCode"
      WHERE d."reportDate" = ?
        AND COALESCE(c."isEnabled", 1) = 1
        AND COALESCE(c."mergeGroup", c."displayName", c."kpiName", c."kpiCode") = ?
        ${scopeSql}
      GROUP BY d."ctvUser"
      `,
      reportDate,
      effectiveGroup,
      ...scopedUsers
    );

    for (const row of aggRows) {
      const ctv = String(row.ctvUser || "").trim();
      if (!ctv) continue;
      detailMap.set(ctv, {
        ctvUser: ctv,
        kh: Number(row.kh || 0),
        th: Number(row.th || 0),
      });
    }

    const rows = Array.from(detailMap.values())
      .map((r) => {
        const percent = computeKpiCompletionPercent(r.kh, r.th, { isNegative: effectiveNegativeGroup, maxPercent });
        const thieu = computeKpiAdverseGap(r.kh, r.th, effectiveNegativeGroup);
        return {
          ctvUser: r.ctvUser,
          kh: Number(r.kh.toFixed(2)),
          th: Number(r.th.toFixed(2)),
          percent: Number(percent.toFixed(2)),
          thieu,
        };
      })
      .sort((a, b) => a.ctvUser.localeCompare(b.ctvUser));

    const responsePayload = { reportDate, indicators, rows, isNegativeGroup: effectiveNegativeGroup, maxPercent, selectedGroup: effectiveGroup };
    setCache(cacheKey, responsePayload, 60_000);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Load summary failed" }, { status: 500 });
  }
}
