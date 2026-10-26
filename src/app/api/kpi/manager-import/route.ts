export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { assertArchiveMonthWritable } from "@/lib/archive";
import { parseManagerKpiWorkbook } from "@/lib/manager-kpi";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    await ensureKpiTables();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file KPI quản lý" },
        { status: 400 }
      );
    }

    const rows = parseManagerKpiWorkbook(Buffer.from(await file.arrayBuffer()));
    if (!rows.length) {
      return NextResponse.json(
        { error: "Không đọc được dữ liệu KPI quản lý từ file" },
        { status: 400 }
      );
    }

    const reportDate = String(rows[0]?.reportDate || "").trim();
    if (!reportDate) {
      return NextResponse.json(
        { error: "Không xác định được ngày dữ liệu từ file KPI quản lý" },
        { status: 400 }
      );
    }

    await assertArchiveMonthWritable(reportDate.slice(0, 7));

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "ManagerKpiDailyResult" WHERE "reportDate" = ?`,
          reportDate
        );

        const chunkSize = 150;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            row.reportDate,
            row.managerUser,
            row.managerName || null,
            row.jobTitle || null,
            row.metricCode,
            row.metricName || null,
            row.metricLabel || null,
            row.khToDate,
            row.khMonth,
            row.thDay,
            row.thLuyKe,
            row.percentToDate,
            row.percentMonth,
            row.samePeriodValue,
            row.growthPercent,
            row.rawPayload,
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "ManagerKpiDailyResult"
            ("reportDate","managerUser","managerName","jobTitle","metricCode","metricName","metricLabel","khToDate","khMonth","thDay","thLuyKe","percentToDate","percentMonth","samePeriodValue","growthPercent","rawPayload")
            VALUES ${valuesSql}
            `,
            ...params
          );
        }
      },
      { maxWait: 15000, timeout: 180000 }
    );

    clearCacheByPrefix("kpi:summary");
    clearCacheByPrefix("kpi:manager-summary");
    clearCacheByPrefix("prepaid:");

    const uniqueManagers = new Set(rows.map((row) => row.managerUser).filter(Boolean));
    const uniqueMetrics = new Set(rows.map((row) => row.metricCode).filter(Boolean));

    return NextResponse.json({
      message: "Import KPI quản lý thành công",
      reportDate,
      inserted: rows.length,
      managerCount: uniqueManagers.size,
      metricCount: uniqueMetrics.size,
    });
  } catch (error) {
    console.error("MANAGER_KPI_IMPORT_ERROR", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";
    const status = message.includes("đã được xác nhận lưu trữ") ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? message : "Lỗi máy chủ nội bộ" },
      { status }
    );
  }
}