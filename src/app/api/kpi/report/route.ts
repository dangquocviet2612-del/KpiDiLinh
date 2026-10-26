export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getCache, setCache } from "@/lib/kpi-cache";
import { calculateKpiReportPayload } from "@/lib/kpi-report-calculation";
import {
  getCuocTargetRatePercent,
  getLatestCuocCompletionForCtv,
  getLatestKpiReportDate,
  getLatestKpiReportDateForCtv,
} from "@/lib/prepaid-query";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });

    await ensureKpiTables();

    const url = new URL(request.url);
    const ctvQuery = (url.searchParams.get("ctvUser") || "").trim();
    const dateQuery = (url.searchParams.get("reportDate") || "").trim();

    const allowedCtv = await getAccessibleCtvCodes(session);
    let selectedCtv = ctvQuery;
    if (session.user.role === "CTV") {
      selectedCtv = String(session.user.name || "");
    } else if (session.user.role === "MANAGER") {
      if (!selectedCtv) selectedCtv = (allowedCtv || [])[0] || "";
      if (selectedCtv && !(allowedCtv || []).includes(selectedCtv)) {
        return NextResponse.json({ error: "CTV không thuộc quyền quản lý" }, { status: 403 });
      }
    }

    if (!selectedCtv && session.user.role !== "ADMIN") {
      return NextResponse.json({ rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 });
    }

    const cacheKey = [
      "kpi:report",
      session.user.role || "",
      session.user.name || "",
      selectedCtv || "",
      dateQuery || "",
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    let reportDate = dateQuery;
    if (!reportDate) {
      reportDate = selectedCtv
        ? await getLatestKpiReportDateForCtv(selectedCtv)
        : await getLatestKpiReportDate({
            role: String(session.user.role || ""),
            sessionName: String(session.user.name || ""),
          });
    }

    if (!reportDate) {
      return NextResponse.json({ rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        COALESCE(d."ctvUser", ?) AS "ctvUser",
        c."kpiCode",
        COALESCE(d."kpiName", c."kpiName", c."kpiCode") AS "kpiName",
        d."khThang",
        d."thNgay",
        d."thLuyKe",
        d."completionPercent",
        d."growthPercent",
        COALESCE(c."displayName", c."kpiName", c."kpiCode") AS "displayName",
        c."mergeGroup" AS "mergeGroup",
        COALESCE(c."baseScore", 10) AS "baseScore",
        COALESCE(c."maxPercent", 120) AS "maxPercent",
        COALESCE(c."sortOrder", 0) AS "sortOrder",
        COALESCE(c."isEnabled", 1) AS "isEnabled",
        COALESCE(c."isNegative", 0) AS "isNegative"
      FROM "KpiMetricConfig" c
      LEFT JOIN "KpiDailyResult" d
        ON d."kpiCode" = c."kpiCode"
       AND d."reportDate" = ?
       ${selectedCtv ? `AND d."ctvUser" = ?` : ""}
      ORDER BY "sortOrder" ASC, c."kpiCode" ASC
      `,
      ...(selectedCtv ? [selectedCtv, reportDate, selectedCtv] : ["", reportDate])
    );

    const [cuocTargetRatePercent, cuocCompletionPercent] = await Promise.all([
      getCuocTargetRatePercent(),
      selectedCtv ? getLatestCuocCompletionForCtv(selectedCtv) : Promise.resolve(0),
    ]);

    const calculated = calculateKpiReportPayload(rows, {
      cuocTargetRatePercent,
      cuocCompletionPercent,
    });

    const responsePayload = {
      reportDate,
      rows: calculated.rows,
      totalBaseScore: calculated.totalBaseScore,
      totalMaxScore: calculated.totalMaxScore,
      totalAchievedScore: calculated.totalAchievedScore,
    };
    setCache(cacheKey, responsePayload, 60_000);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Không tải được KPI cá nhân" }, { status: 500 });
  }
}
