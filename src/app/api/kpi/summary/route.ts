export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
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
import { ServerTiming } from "@/lib/server-timing";
import { buildKpiSummaryAggregateQuery, KPI_SUMMARY_METADATA_SQL, type KpiSummaryMetadataRow } from "@/lib/kpi-report-queries";

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
  const cacheGeneration = getCacheGeneration();
  const timing = new ServerTiming();
  const json = (body: Parameters<typeof NextResponse.json>[0], init?: Parameters<typeof NextResponse.json>[1]) =>
    timing.applyTo(timing.measureSync("serialize", () => NextResponse.json(body, init)));

  try {
    const session = await timing.measure("auth", () => auth());
    if (!session) return json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return json({ error: "Bạn không có quyền truy cập tổng hợp KPI" }, { status: 403 });
    }

    await timing.measure("schema", () => ensureKpiTables());

    const url = new URL(request.url);
    const group = (url.searchParams.get("group") || "").trim();
    const managerCode = (url.searchParams.get("managerCode") || "").trim();
    let reportDate = (url.searchParams.get("reportDate") || "").trim();

    const allowed = await timing.measure("scope", () => getAccessibleCtvCodes(session));
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && (!allowed || allowed.length === 0)) {
      return json({ reportDate: null, indicators: [], rows: [] });
    }

    if (!reportDate) {
      reportDate = await timing.measure("date", () => getLatestKpiReportDate({
        role: String(session.user.role || ""),
        sessionName: String(session.user.name || ""),
        managerCode: isAdmin ? managerCode : "",
      }));
    }

    if (!reportDate) {
      return json({ reportDate: null, indicators: [], rows: [] });
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
    const cached = timing.measureSync("cache", () => getCache<any>(cacheKey));
    timing.setCacheStatus(cached ? "hit" : "miss");
    if (cached) return json(cached);

    const scopedUsers = await timing.measure("scope", () => getScopedPrepaidCtvUsers({
      role: String(session.user.role || ""),
      sessionName: String(session.user.name || ""),
      managerCode: isAdmin ? managerCode : "",
    }));

    if (!scopedUsers.length) {
      const responsePayload = {
        reportDate,
        indicators: [],
        rows: [],
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
      };
      timing.measureSync("cache", () => setCache(cacheKey, responsePayload, 60_000, cacheGeneration));
      return json(responsePayload);
    }

    const indicatorRows = await timing.measure("query", () => prisma.$queryRawUnsafe<KpiSummaryMetadataRow[]>(KPI_SUMMARY_METADATA_SQL));
    const indicators = timing.measureSync("compute", () =>
      Array.from(new Set(indicatorRows.map((row) => row.name))).map((name) => String(name || "").trim()).filter(Boolean));

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
      timing.measureSync("cache", () => setCache(cacheKey, responsePayload, 60_000, cacheGeneration));
      return json(responsePayload);
    }

    if (isCuocRateGroup(effectiveGroup)) {
      const detailMap = new Map<string, { ctvUser: string; kh: number; th: number }>();
      const scopeSql = ` AND "ctvUser" IN (${scopedUsers.map(() => "?").join(",")})`;

      let finalReportDate = reportDate;
      const [targetRatePercent, initialCuocRows] = await timing.measure("query", () => Promise.all([
        getCuocTargetRatePercent(),
        prisma.$queryRawUnsafe<Array<{ ctvUser: string; completionPercent: number | null }>>(
        `
        SELECT "ctvUser", "completionPercent"
        FROM "CuocDailyResult"
        WHERE "reportDate" = ? ${scopeSql}
        ORDER BY "ctvUser" ASC
        `,
        finalReportDate,
        ...scopedUsers
        ),
      ]));
      let cuocRows = initialCuocRows;

      if (cuocRows.length === 0) {
        const fallbackDate = await timing.measure("date", () => getLatestCuocReportDate({
          role: String(session.user.role || ""),
          sessionName: String(session.user.name || ""),
          managerCode: isAdmin ? managerCode : "",
        }));
        if (fallbackDate && fallbackDate !== finalReportDate) {
          finalReportDate = fallbackDate;
          cuocRows = await timing.measure("query", () => prisma.$queryRawUnsafe<Array<{ ctvUser: string; completionPercent: number | null }>>(
            `
            SELECT "ctvUser", "completionPercent"
            FROM "CuocDailyResult"
            WHERE "reportDate" = ? ${scopeSql}
            ORDER BY "ctvUser" ASC
            `,
            finalReportDate,
            ...scopedUsers
          ));
        }
      }

      const responsePayload = timing.measureSync("compute", () => {
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

        return {
          reportDate: finalReportDate,
          indicators,
          rows,
          isNegativeGroup: false,
          maxPercent: DEFAULT_KPI_MAX_PERCENT,
          selectedGroup: effectiveGroup,
        };
      });
      timing.measureSync("cache", () => setCache(cacheKey, responsePayload, 60_000, cacheGeneration));
      return json(responsePayload);
    }

    const groupMetaRows = timing.measureSync("compute", () => indicatorRows.filter((row) => row.name === effectiveGroup));

    const { effectiveNegativeGroup, maxPercent } = timing.measureSync("compute", () => {
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
      return { effectiveNegativeGroup, maxPercent };
    });

    const detailMap = new Map<string, { ctvUser: string; kh: number; th: number }>();
    for (const username of scopedUsers) {
      detailMap.set(username, { ctvUser: username, kh: 0, th: 0 });
    }

    const aggregateQuery = buildKpiSummaryAggregateQuery(reportDate, effectiveGroup, scopedUsers);
    const aggRows = await timing.measure("query", () => prisma.$queryRawUnsafe<SummaryAggRow[]>(
      aggregateQuery.sql,
      ...aggregateQuery.args
    ));

    const responsePayload = timing.measureSync("compute", () => {
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

      return { reportDate, indicators, rows, isNegativeGroup: effectiveNegativeGroup, maxPercent, selectedGroup: effectiveGroup };
    });
    timing.measureSync("cache", () => setCache(cacheKey, responsePayload, 60_000, cacheGeneration));
    return json(responsePayload);
  } catch (error: any) {
    return json({ error: error.message || "Load summary failed" }, { status: 500 });
  }
}
