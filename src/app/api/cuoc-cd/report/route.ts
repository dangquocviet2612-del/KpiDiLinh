export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { buildCuocCdSummaryRow, CuocCdRow } from "@/lib/cuoc-cd";

export async function GET(request: Request) {
  const cacheGeneration = getCacheGeneration();
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn chưa đăng nhập" }, { status: 401 });
    }
    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "MANAGER" &&
      session.user.role !== "CTV"
    ) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập dữ liệu cước cố định" },
        { status: 403 }
      );
    }

    await ensureKpiTables();

    const role = session.user.role;
    const username = session.user.name || "";
    const isAdmin = role === "ADMIN";
    const allowed = await getAccessibleCtvCodes(session);

    const url = new URL(request.url);
    let reportDate = (url.searchParams.get("reportDate") || "").trim();

    // Find latest report date if not specified
    if (!reportDate) {
      const latestDateCacheKey = "cuoc-cd:report:latest-date";
      const cachedReportDate = getCache<string>(latestDateCacheKey);
      if (cachedReportDate !== null) {
        reportDate = cachedReportDate;
      } else {
        const dates = await prisma.$queryRawUnsafe<Array<{ reportDate: string }>>(
          `SELECT DISTINCT "reportDate" FROM "CuocCdDailyResult" ORDER BY "reportDate" DESC LIMIT 1`
        );
        if (dates.length > 0) {
          reportDate = dates[0].reportDate;
        }
        setCache(latestDateCacheKey, reportDate, 30_000, cacheGeneration);
      }
    }

    if (!reportDate) {
      return NextResponse.json({ reportDate: null, rows: [], summaryRow: null });
    }

    const cacheKey = [
      "cuoc-cd:report",
      role,
      username,
      reportDate,
      isAdmin ? "admin" : (allowed || []).join(","),
    ].join("|");

    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Query rows
    const rawRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "ctvUser", "employeeCodeRaw", "managerCodeRaw", "dauKy", "luyKe", "thuaThieu", "tonChuaThu"
      FROM "CuocCdDailyResult"
      WHERE "reportDate" = ?
      ORDER BY "id" ASC
      `,
      reportDate
    );

    const configRows = await prisma.$queryRawUnsafe<Array<{ targetRatePercent: number }>>(
      `SELECT "targetRatePercent" FROM "CuocCdConfig" WHERE "id" = 1 LIMIT 1`
    );
    const targetRatePercent = configRows[0]?.targetRatePercent ?? 99.5;
    const rateFactor = targetRatePercent / 100;

    // Apply role-based filtering:
    // ADMIN: sees all rows
    // MANAGER: sees CTVs in their allowed list or rows where managerCode matches manager's username/secondary
    // CTV: sees rows matching their username or secondaryCode
    let rows: CuocCdRow[] = [];
    const mapRow = (r: any): CuocCdRow => {
      const dauKy = Number(r.dauKy || 0);
      const luyKe = Number(r.luyKe || 0);
      const rawThuaThieu = dauKy * rateFactor - luyKe;
      const roundedThuaThieu = Math.ceil(rawThuaThieu);
      const thuaThieu = Object.is(roundedThuaThieu, -0) ? 0 : roundedThuaThieu;
      const tonChuaThu = Number((dauKy - luyKe).toFixed(2));
      return {
        ctvUser: String(r.ctvUser || r.employeeCodeRaw || ""),
        employeeCodeRaw: String(r.employeeCodeRaw || ""),
        managerCodeRaw: String(r.managerCodeRaw || ""),
        dauKy,
        luyKe,
        thuaThieu,
        tonChuaThu,
      };
    };

    // Fetch web users to restrict report display ONLY to users registered in web system
    const dbUsers = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT "username", "secondaryCode" FROM "User"`
    ).catch(async () => {
      return prisma.$queryRawUnsafe<any[]>(`SELECT "username" FROM "User"`);
    })) || [];
    const webUserSet = new Set<string>();
    for (const u of dbUsers) {
      if (u.username) webUserSet.add(String(u.username).trim().toLowerCase());
      if (u.secondaryCode) webUserSet.add(String(u.secondaryCode).trim().toLowerCase());
    }

    // Only keep rows whose employeeCodeRaw or ctvUser exists in web user list
    const filteredRawRows = rawRows.filter((r) => {
      const ctvLower = String(r.ctvUser || "").trim().toLowerCase();
      const empLower = String(r.employeeCodeRaw || "").trim().toLowerCase();
      return webUserSet.has(ctvLower) || webUserSet.has(empLower);
    });

    if (isAdmin) {
      rows = filteredRawRows.map(mapRow);
    } else if (role === "MANAGER") {
      const allowedSet = new Set((allowed || []).map((code) => code.toLowerCase()));
      allowedSet.add(username.toLowerCase());

      rows = filteredRawRows
        .filter((r) => {
          const ctvLower = String(r.ctvUser || "").toLowerCase();
          const empLower = String(r.employeeCodeRaw || "").toLowerCase();
          const mgrLower = String(r.managerCodeRaw || "").toLowerCase();
          return (
            allowedSet.has(ctvLower) ||
            allowedSet.has(empLower) ||
            mgrLower === username.toLowerCase()
          );
        })
        .map(mapRow);
    } else if (role === "CTV") {
      const userLower = username.toLowerCase();
      rows = filteredRawRows
        .filter((r) => {
          const ctvLower = String(r.ctvUser || "").toLowerCase();
          const empLower = String(r.employeeCodeRaw || "").toLowerCase();
          return ctvLower === userLower || empLower === userLower;
        })
        .map(mapRow);
    }

    const summaryRow = buildCuocCdSummaryRow(rows);
    const responsePayload = { reportDate, targetRatePercent, rows, summaryRow };
    setCache(cacheKey, responsePayload, 60_000, cacheGeneration);

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("CUOC_CD_REPORT_ERROR", error);
    return NextResponse.json(
      { error: error.message || "Lỗi tải báo cáo Cước CD" },
      { status: 500 }
    );
  }
}
