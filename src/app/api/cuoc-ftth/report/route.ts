export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { buildCuocCdSummaryRow, type CuocCdRow, type CuocCdSummaryRow } from "@/lib/cuoc-cd";

type RawRow = {
  ctvUser: string | null;
  employeeCodeRaw: string | null;
  managerCodeRaw: string | null;
  dauKy: number | null;
  luyKe: number | null;
};
type ReportPayload = {
  reportDate: string | null;
  targetRatePercent: number;
  rows: CuocCdRow[];
  summaryRow: CuocCdSummaryRow | null;
};
type WebUser = { username: string; secondaryCode?: string | null };

export async function GET(request: Request) {
  const cacheGeneration = getCacheGeneration();
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    const role = session.user.role;
    if (role !== "ADMIN" && role !== "MANAGER" && role !== "CTV") {
      return NextResponse.json({ error: "Bạn không có quyền truy cập dữ liệu cước FTTH" }, { status: 403 });
    }

    await ensureRuntimeSchema("cuocFtth");
    const username = session.user.name || "";
    const isAdmin = role === "ADMIN";
    const allowed = await getAccessibleCtvCodes(session);
    const url = new URL(request.url);
    let reportDate = (url.searchParams.get("reportDate") || "").trim();
    if (!reportDate) {
      const latestDateCacheKey = "cuoc-ftth:report:latest-date";
      const cachedReportDate = getCache<string>(latestDateCacheKey);
      if (cachedReportDate !== null) {
        reportDate = cachedReportDate;
      } else {
        const dates = await prisma.$queryRawUnsafe<Array<{ reportDate: string }>>(
          `SELECT DISTINCT "reportDate" FROM "CuocFtthDailyResult" ORDER BY "reportDate" DESC LIMIT 1`
        );
        reportDate = dates[0]?.reportDate || "";
        setCache(latestDateCacheKey, reportDate, 30_000, cacheGeneration);
      }
    }

    const cacheKey = ["cuoc-ftth:report", role, username, reportDate, isAdmin ? "admin" : (allowed || []).join(",")].join("|");
    if (reportDate) {
      const cached = getCache<ReportPayload>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }
    const configRows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocFtthConfig" WHERE "id" = 1 LIMIT 1`
    );
    const targetRatePercent = configRows[0]?.targetRatePercent ?? 99.5;
    if (!reportDate) {
      return NextResponse.json({ reportDate: null, targetRatePercent, rows: [], summaryRow: null });
    }

    const rawRows = await prisma.$queryRawUnsafe<RawRow[]>(
      `SELECT "ctvUser", "employeeCodeRaw", "managerCodeRaw", "dauKy", "luyKe", "thuaThieu", "tonChuaThu"
       FROM "CuocFtthDailyResult" WHERE "reportDate" = ? ORDER BY "id" ASC`,
      reportDate
    );
    const rateFactor = targetRatePercent / 100;
    const mapRow = (row: RawRow): CuocCdRow => {
      const dauKy = Number(row.dauKy || 0);
      const luyKe = Number(row.luyKe || 0);
      const roundedThuaThieu = Math.ceil(dauKy * rateFactor - luyKe);
      return {
        ctvUser: String(row.ctvUser || row.employeeCodeRaw || ""),
        employeeCodeRaw: String(row.employeeCodeRaw || ""),
        managerCodeRaw: String(row.managerCodeRaw || ""),
        dauKy,
        luyKe,
        thuaThieu: Object.is(roundedThuaThieu, -0) ? 0 : roundedThuaThieu,
        tonChuaThu: Number((dauKy - luyKe).toFixed(2)),
      };
    };

    const dbUsers = await prisma.$queryRawUnsafe<WebUser[]>(`SELECT "username", "secondaryCode" FROM "User"`)
      .catch(() => prisma.$queryRawUnsafe<WebUser[]>(`SELECT "username" FROM "User"`));
    const webUserSet = new Set<string>();
    for (const user of dbUsers || []) {
      if (user.username) webUserSet.add(String(user.username).trim().toLowerCase());
      if (user.secondaryCode) webUserSet.add(String(user.secondaryCode).trim().toLowerCase());
    }
    const registeredRows = rawRows.filter((row) =>
      webUserSet.has(String(row.ctvUser || "").trim().toLowerCase()) ||
      webUserSet.has(String(row.employeeCodeRaw || "").trim().toLowerCase())
    );
    const allowedSet = new Set((allowed || []).map((code) => code.toLowerCase()));
    const userLower = username.toLowerCase();
    allowedSet.add(userLower);
    const rows = registeredRows.filter((row) => {
      if (isAdmin) return true;
      const ctvLower = String(row.ctvUser || "").toLowerCase();
      const employeeLower = String(row.employeeCodeRaw || "").toLowerCase();
      if (role === "MANAGER") {
        return allowedSet.has(ctvLower) || allowedSet.has(employeeLower) || String(row.managerCodeRaw || "").toLowerCase() === userLower;
      }
      return ctvLower === userLower || employeeLower === userLower;
    }).map(mapRow);

    const responsePayload: ReportPayload = { reportDate, targetRatePercent, rows, summaryRow: buildCuocCdSummaryRow(rows) };
    setCache(cacheKey, responsePayload, 60_000, cacheGeneration);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("CUOC_FTTH_REPORT_ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi tải báo cáo Cước FTTH" },
      { status: 500 }
    );
  }
}
