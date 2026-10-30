export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { calculateKpiReportPayload } from "@/lib/kpi-report-calculation";
import { ServerTiming } from "@/lib/server-timing";
import { buildPersonalKpiQuery } from "@/lib/kpi-report-queries";
import {
  getCuocTargetRatePercent,
  getLatestCuocCompletionForCtv,
  getLatestKpiReportDate,
  getLatestKpiReportDateForCtv,
} from "@/lib/prepaid-query";

export async function GET(request: Request) {
  const cacheGeneration = getCacheGeneration();
  const timing = new ServerTiming();
  const json = (body: Parameters<typeof NextResponse.json>[0], init?: Parameters<typeof NextResponse.json>[1]) =>
    timing.applyTo(timing.measureSync("serialize", () => NextResponse.json(body, init)));

  try {
    const session = await timing.measure("auth", () => auth());
    if (!session) return json({ error: "Bạn chưa đăng nhập" }, { status: 401 });

    await timing.measure("schema", () => ensureKpiTables());

    const url = new URL(request.url);
    const ctvQuery = (url.searchParams.get("ctvUser") || "").trim();
    const dateQuery = (url.searchParams.get("reportDate") || "").trim();

    const allowedCtv = await timing.measure("scope", () => getAccessibleCtvCodes(session));
    let selectedCtv = ctvQuery;
    if (session.user.role === "CTV") {
      selectedCtv = String(session.user.name || "");
    } else if (session.user.role === "MANAGER") {
      if (!selectedCtv) selectedCtv = (allowedCtv || [])[0] || "";
      if (selectedCtv && !(allowedCtv || []).includes(selectedCtv)) {
        return json({ error: "CTV không thuộc quyền quản lý" }, { status: 403 });
      }
    }

    if (!selectedCtv && session.user.role !== "ADMIN") {
      return json({ rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 });
    }

    const cacheKey = [
      "kpi:report",
      session.user.role || "",
      session.user.name || "",
      selectedCtv || "",
      dateQuery || "",
    ].join("|");
    const cached = timing.measureSync("cache", () => getCache<any>(cacheKey));
    timing.setCacheStatus(cached ? "hit" : "miss");
    if (cached) return json(cached);

    let reportDate = dateQuery;
    if (!reportDate) {
      reportDate = await timing.measure("date", () => selectedCtv
        ? getLatestKpiReportDateForCtv(selectedCtv)
        : getLatestKpiReportDate({
            role: String(session.user.role || ""),
            sessionName: String(session.user.name || ""),
          }));
    }

    if (!reportDate) {
      return json({ rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 });
    }

    const reportQuery = buildPersonalKpiQuery(selectedCtv, reportDate);
    const [rows, cuocTargetRatePercent, cuocCompletionPercent] = await timing.measure("query", () => Promise.all([
      prisma.$queryRawUnsafe<any[]>(reportQuery.sql, ...reportQuery.args),
      getCuocTargetRatePercent(),
      selectedCtv ? getLatestCuocCompletionForCtv(selectedCtv) : Promise.resolve(0),
    ]));

    const calculated = timing.measureSync("compute", () => calculateKpiReportPayload(rows, {
      cuocTargetRatePercent,
      cuocCompletionPercent,
    }));

    const responsePayload = {
      reportDate,
      rows: calculated.rows,
      totalBaseScore: calculated.totalBaseScore,
      totalMaxScore: calculated.totalMaxScore,
      totalAchievedScore: calculated.totalAchievedScore,
    };
    timing.measureSync("cache", () => setCache(cacheKey, responsePayload, 60_000, cacheGeneration));
    return json(responsePayload);
  } catch (error: any) {
    return json({ error: error.message || "Không tải được KPI cá nhân" }, { status: 500 });
  }
}
