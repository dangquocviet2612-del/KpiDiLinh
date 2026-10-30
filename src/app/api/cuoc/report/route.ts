export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { getCuocTargetRatePercent, getLatestCuocReportDate } from "@/lib/prepaid-query";
import { buildCuocSummaryRow, computeCuocMissingAmount } from "@/lib/cuoc";

export async function GET(request: Request) {
  const cacheGeneration = getCacheGeneration();
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "B\u1EA1n ch\u01B0a \u0111\u0103ng nh\u1EADp" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "CTV") {
      return NextResponse.json({ error: "B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n truy c\u1EADp d\u1EEF li\u1EC7u c\u01B0\u1EDBc" }, { status: 403 });
    }

    await ensureKpiTables();

    const isAdmin = session.user.role === "ADMIN";
    const allowed = await getAccessibleCtvCodes(session);
    if (!isAdmin && (!allowed || allowed.length === 0)) {
      return NextResponse.json({ reportDate: null, targetRatePercent: await getCuocTargetRatePercent(), rows: [], summaryRow: null });
    }

    const url = new URL(request.url);
    let reportDate = (url.searchParams.get("reportDate") || "").trim();
    const cacheKey = [
      "cuoc:report",
      session.user.role || "",
      session.user.name || "",
      reportDate,
      isAdmin ? "admin" : (allowed || []).join(","),
    ].join("|");
    const cached = getCache<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const latestScopedReportDate = reportDate
      ? ""
      : await getLatestCuocReportDate({
          role: String(session.user.role || ""),
          sessionName: String(session.user.name || ""),
        });

    if (!reportDate) {
      reportDate = latestScopedReportDate;
    }

    const targetRatePercent = await getCuocTargetRatePercent();
    if (!reportDate) {
      const emptyPayload = { reportDate: null, targetRatePercent, rows: [], summaryRow: null };
      setCache(cacheKey, emptyPayload, 60_000, cacheGeneration);
      return NextResponse.json(emptyPayload);
    }

    const scopeSql = isAdmin ? "" : ` AND "ctvUser" IN (${(allowed || []).map(() => "?").join(",")})`;

    const rawRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "ctvUser","employeeCodeRaw","targetAmount","collectedAmount","completionPercent"
      FROM "CuocDailyResult"
      WHERE "reportDate" = ? ${scopeSql}
      ORDER BY "completionPercent" DESC, "ctvUser" ASC
      `,
      reportDate,
      ...(!isAdmin ? (allowed || []) : [])
    );

    let finalReportDate = reportDate;
    let finalRawRows = rawRows;

    if (finalRawRows.length === 0) {
      const fallbackDate =
        latestScopedReportDate ||
        await getLatestCuocReportDate({
          role: String(session.user.role || ""),
          sessionName: String(session.user.name || ""),
        });
      if (fallbackDate && fallbackDate !== reportDate) {
        finalReportDate = fallbackDate;
        finalRawRows = await prisma.$queryRawUnsafe<any[]>(
          `
          SELECT "ctvUser","employeeCodeRaw","targetAmount","collectedAmount","completionPercent"
          FROM "CuocDailyResult"
          WHERE "reportDate" = ? ${scopeSql}
          ORDER BY "completionPercent" DESC, "ctvUser" ASC
          `,
          finalReportDate,
          ...(!isAdmin ? (allowed || []) : [])
        );
      }
    }

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

    const rows = finalRawRows
      .filter((r) => {
        const ctvLower = String(r.ctvUser || "").trim().toLowerCase();
        const empLower = String(r.employeeCodeRaw || "").trim().toLowerCase();
        return webUserSet.has(ctvLower) || webUserSet.has(empLower);
      })
      .map((r) => {
        const targetAmount = Number(r.targetAmount || 0);
        const collectedAmount = Number(r.collectedAmount || 0);
        const missingAmount = computeCuocMissingAmount(targetAmount, collectedAmount, targetRatePercent);
        return {
          ...r,
          targetAmount,
          collectedAmount,
          missingAmount,
        };
      });

    const summaryRow = buildCuocSummaryRow(rows, targetRatePercent);
    const responsePayload = { reportDate: finalReportDate, targetRatePercent, rows, summaryRow };
    setCache(cacheKey, responsePayload, 60_000, cacheGeneration);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "L\u1ED7i t\u1EA3i b\u00E1o c\u00E1o c\u01B0\u1EDBc" }, { status: 500 });
  }
}


