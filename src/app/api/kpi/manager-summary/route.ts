export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getCache, setCache } from "@/lib/kpi-cache";
import {
  computeCuocN1N3CompletionPercent,
  computeKpiCompletionPercent,
  DEFAULT_KPI_MAX_PERCENT,
  isCuocN1N3MetricKey,
  isNegativeMetricKey,
  normalizeMetricKey,
} from "@/lib/kpi-scoring";
import { computeKpiAdverseGap } from "@/lib/kpi-summary";
import { normalizeManagerUser } from "@/lib/manager-kpi-utils";
import { getLatestManagerKpiReportDate } from "@/lib/prepaid-query";

type IndicatorRow = {
  name: string;
  sortOrder: number | null;
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Bạn không có quyền truy cập KPI quản lý" }, { status: 403 });
    }

    await ensureKpiTables();

    const url = new URL(request.url);
    const group = (url.searchParams.get("group") || "").trim();
    const managerCode = (url.searchParams.get("managerCode") || "").trim();
    let reportDate = (url.searchParams.get("reportDate") || "").trim();

    if (!reportDate) {
      reportDate = await getLatestManagerKpiReportDate(
        session.user.role === "MANAGER" ? String(session.user.name || "") : managerCode
      );
    }

    if (!reportDate) {
      return NextResponse.json({
        reportDate: null,
        indicators: [],
        rows: [],
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
      });
    }

    const effectiveManagerCode =
      session.user.role === "MANAGER" ? String(session.user.name || "").trim() : managerCode;
    const normalizedManagerCode = normalizeManagerUser(effectiveManagerCode);

    const cacheKey = [
      "kpi:manager-summary",
      session.user.role || "",
      session.user.name || "",
      reportDate,
      normalizedManagerCode,
      group,
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const indicatorRows = await prisma.$queryRawUnsafe<IndicatorRow[]>(
      `
      SELECT
        COALESCE(NULLIF("metricLabel", ''), NULLIF("metricName", ''), "metricCode") AS "name",
        MIN(COALESCE(cfg."sortOrder", 9999)) AS "sortOrder"
      FROM "ManagerKpiDailyResult" m
      LEFT JOIN "KpiMetricConfig" cfg
        ON UPPER(cfg."kpiCode") = UPPER(m."metricCode")
        OR UPPER(COALESCE(cfg."displayName", cfg."kpiName", cfg."kpiCode")) = UPPER(COALESCE(m."metricLabel", m."metricName", m."metricCode"))
      WHERE m."reportDate" = ?
        ${normalizedManagerCode ? `AND UPPER(m."managerUser") = ?` : ""}
      GROUP BY COALESCE(NULLIF("metricLabel", ''), NULLIF("metricName", ''), "metricCode")
      ORDER BY "sortOrder" ASC, "name" ASC
      `,
      ...(normalizedManagerCode ? [reportDate, normalizedManagerCode] : [reportDate])
    );

    const indicators = indicatorRows.map((row) => String(row.name || "").trim()).filter(Boolean);

    const effectiveGroup = group || indicators[0] || "";

    if (!effectiveGroup) {
      const payload = {
        reportDate,
        indicators,
        rows: [],
        isNegativeGroup: false,
        maxPercent: DEFAULT_KPI_MAX_PERCENT,
        selectedGroup: "",
      };
      setCache(cacheKey, payload, 60_000);
      return NextResponse.json(payload);
    }

    if (effectiveGroup === "__all__") {
      const allMetricRows = await prisma.$queryRawUnsafe<Array<{
        managerUser: string;
        managerName: string | null;
        jobTitle: string | null;
        metricCode: string | null;
        metricName: string | null;
        metricLabel: string | null;
        khMonth: number | null;
        thLuyKe: number | null;
      }>>(
        `SELECT "managerUser", "managerName", "jobTitle", "metricCode", "metricName", "metricLabel", "khMonth", "thLuyKe"
         FROM "ManagerKpiDailyResult"
         WHERE "reportDate" = ?
         ${normalizedManagerCode ? `AND UPPER("managerUser") = ?` : ""}`,
        ...(normalizedManagerCode ? [reportDate, normalizedManagerCode] : [reportDate])
      );

      const allCodes = Array.from(new Set(allMetricRows.map((r) => String(r.metricCode || "").trim()).filter(Boolean)));
      const cfgMap = new Map<string, { isNegative: boolean; maxPercent: number }>();
      if (allCodes.length > 0) {
        const ph = allCodes.map(() => "?").join(",");
        const cfgRows = await prisma.$queryRawUnsafe<Array<{ kpiCode: string; isNegative: number | null; maxPercent: number | null }>>(
          `SELECT "kpiCode", "isNegative", "maxPercent" FROM "KpiMetricConfig" WHERE UPPER("kpiCode") IN (${ph})`,
          ...allCodes.map((c) => c.toUpperCase())
        );
        for (const cfg of cfgRows) {
          cfgMap.set(cfg.kpiCode.toUpperCase(), {
            isNegative: Number(cfg.isNegative || 0) === 1,
            maxPercent: Number(cfg.maxPercent ?? DEFAULT_KPI_MAX_PERCENT),
          });
        }
      }

      const indicatorOrder = new Map<string, number>();
      indicators.forEach((name, idx) => indicatorOrder.set(name, idx));

      type MetricEntry = {
        name: string;
        kh: number;
        th: number;
        percent: number;
        thieu: number;
        sortOrder: number;
        metricCode: string;
        isNegative: boolean;
        maxPercent: number;
      };
      type ManagerEntry = { managerUser: string; managerName: string | null; jobTitle: string | null; metrics: MetricEntry[] };
      const managerMap = new Map<string, ManagerEntry>();
      const metricMap = new Map<string, MetricEntry>();

      for (const row of allMetricRows) {
        const mKey = String(row.managerUser || "").trim();
        if (!mKey) continue;
        const displayName = String(row.metricLabel || row.metricName || row.metricCode || "").trim();
        if (!displayName) continue;

        if (!managerMap.has(mKey)) {
          managerMap.set(mKey, { managerUser: mKey, managerName: row.managerName || null, jobTitle: row.jobTitle || null, metrics: [] });
        }

        const compositeKey = `${mKey}|||${displayName}`;
        let metric = metricMap.get(compositeKey);
        if (!metric) {
          metric = {
            name: displayName,
            kh: 0,
            th: 0,
            percent: 0,
            thieu: 0,
            sortOrder: indicatorOrder.get(displayName) ?? 9999,
            metricCode: String(row.metricCode || "").trim(),
            isNegative: false,
            maxPercent: DEFAULT_KPI_MAX_PERCENT,
          };
          metricMap.set(compositeKey, metric);
          managerMap.get(mKey)!.metrics.push(metric);
        }
        metric.kh += Number(row.khMonth || 0);
        metric.th += Number(row.thLuyKe || 0);
      }

      for (const metric of metricMap.values()) {
        const cfg = cfgMap.get(metric.metricCode.toUpperCase());
        const isNeg = cfg?.isNegative || isNegativeMetricKey(metric.metricCode) || isNegativeMetricKey(metric.name);
        const mp = cfg?.maxPercent ?? DEFAULT_KPI_MAX_PERCENT;
        metric.isNegative = isNeg;
        metric.maxPercent = mp;
        if (isCuocN1N3MetricKey(metric.name) || isCuocN1N3MetricKey(metric.metricCode)) {
          metric.percent = Number(computeCuocN1N3CompletionPercent(metric.th, { maxPercent: mp }).toFixed(2));
        } else {
          metric.percent = Number(computeKpiCompletionPercent(metric.kh, metric.th, { isNegative: isNeg, maxPercent: mp }).toFixed(2));
        }
        metric.kh = Number(metric.kh.toFixed(2));
        metric.th = Number(metric.th.toFixed(2));
        metric.thieu = computeKpiAdverseGap(metric.kh, metric.th, isNeg);
      }

      for (const mgr of managerMap.values()) {
        mgr.metrics.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const allRows = Array.from(managerMap.values()).sort((a, b) => a.managerUser.localeCompare(b.managerUser));
      const allPayload = { reportDate, indicators, allRows, rows: [], isAllView: true, isNegativeGroup: false, maxPercent: DEFAULT_KPI_MAX_PERCENT, selectedGroup: "__all__" };
      setCache(cacheKey, allPayload, 60_000);
      return NextResponse.json(allPayload);
    }

    const normalizedGroup = normalizeMetricKey(effectiveGroup);
    const matchedRows = await prisma.$queryRawUnsafe<Array<{
      managerUser: string;
      managerName: string | null;
      jobTitle: string | null;
      metricCode: string | null;
      metricName: string | null;
      metricLabel: string | null;
      khMonth: number | null;
      thLuyKe: number | null;
    }>>(
      `
      SELECT
        "managerUser",
        "managerName",
        "jobTitle",
        "metricCode",
        "metricName",
        "metricLabel",
        "khMonth",
        "thLuyKe"
      FROM "ManagerKpiDailyResult"
      WHERE "reportDate" = ?
        ${normalizedManagerCode ? `AND UPPER("managerUser") = ?` : ""}
        AND (
          UPPER("metricCode") = UPPER(?)
          OR UPPER(COALESCE(NULLIF("metricName", ''), '')) = UPPER(?)
          OR UPPER(COALESCE(NULLIF("metricLabel", ''), '')) = UPPER(?)
        )
      `,
      ...(normalizedManagerCode
        ? [reportDate, normalizedManagerCode, effectiveGroup, effectiveGroup, effectiveGroup]
        : [reportDate, effectiveGroup, effectiveGroup, effectiveGroup])
    );

    const grouped = new Map<string, { managerUser: string; managerName: string | null; jobTitle: string | null; kh: number; th: number }>();

    for (const row of matchedRows) {
      const key = String(row.managerUser || "").trim();
      if (!key) continue;
      const current = grouped.get(key) || {
        managerUser: key,
        managerName: row.managerName || null,
        jobTitle: row.jobTitle || null,
        kh: 0,
        th: 0,
      };
      current.kh += Number(row.khMonth || 0);
      current.th += Number(row.thLuyKe || 0);
      grouped.set(key, current);
    }

    const isCuocRateGroup = isCuocN1N3MetricKey(effectiveGroup);

    let isNegativeGroup =
      matchedRows.some((row) => {
        const aliases = [row.metricCode, row.metricName, row.metricLabel]
          .map((value) => normalizeMetricKey(String(value || "")))
          .filter(Boolean);
        if (!aliases.includes(normalizedGroup)) return false;
        return [row.metricCode, row.metricName, row.metricLabel].some((value) => isNegativeMetricKey(value));
      }) || isNegativeMetricKey(effectiveGroup);

    const metricCodes = Array.from(
      new Set(
        matchedRows
          .map((row) => String(row.metricCode || "").trim())
          .filter(Boolean)
      )
    );

    let maxPercent = DEFAULT_KPI_MAX_PERCENT;
    if (metricCodes.length > 0) {
      const configRows = await prisma.$queryRawUnsafe<Array<{ maxPercent: number | null; isNegative: number | null }>>(
        `
        SELECT "maxPercent", "isNegative"
        FROM "KpiMetricConfig"
        WHERE UPPER("kpiCode") IN (${metricCodes.map(() => "?").join(",")})
        `,
        ...metricCodes.map((code) => code.toUpperCase())
      );
      if (configRows.some((row) => Number(row.isNegative || 0) === 1)) {
        isNegativeGroup = true;
      }
      maxPercent = configRows.reduce(
        (acc, row) => Math.max(acc, Number(row.maxPercent ?? DEFAULT_KPI_MAX_PERCENT)),
        DEFAULT_KPI_MAX_PERCENT
      );
    }

    const rows = Array.from(grouped.values())
      .map((row) => {
        const percent = isCuocRateGroup
          ? computeCuocN1N3CompletionPercent(row.th, { maxPercent })
          : computeKpiCompletionPercent(row.kh, row.th, { isNegative: isNegativeGroup, maxPercent });
        const thieu = computeKpiAdverseGap(row.kh, row.th, isNegativeGroup);
        return {
          managerUser: row.managerUser,
          managerName: row.managerName,
          jobTitle: row.jobTitle,
          kh: Number(row.kh.toFixed(2)),
          th: Number(row.th.toFixed(2)),
          percent: Number(percent.toFixed(2)),
          thieu,
        };
      })
      .sort((a, b) => a.managerUser.localeCompare(b.managerUser));

    const payload = { reportDate, indicators, rows, isNegativeGroup, maxPercent, selectedGroup: effectiveGroup };
    setCache(cacheKey, payload, 60_000);
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Load manager summary failed" }, { status: 500 });
  }
}
