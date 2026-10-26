export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseChurnRiskWorksheet } from "@/lib/churn-risk";
import { clearCacheByPrefix } from "@/lib/kpi-cache";
import { ensureKpiTables } from "@/lib/kpi-db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 },
      );
    }

    await ensureKpiTables();

    const formData = await request.formData();
    const file = formData.get("file");
    const reportMonth = (formData.get("reportMonth") as string || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Vui lòng chọn file nguy cơ rời mạng" },
        { status: 400 },
      );
    }

    if (!reportMonth || !/^\d{4}-\d{2}$/.test(reportMonth)) {
      return NextResponse.json(
        { error: "Kỳ báo cáo không hợp lệ, cần dùng định dạng YYYY-MM" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseChurnRiskWorksheet(buffer);

    if (!parsed.headerValidation.matches) {
      return NextResponse.json(
        {
          error: "File nguy cơ rời mạng không đúng mẫu",
          missingHeaders: parsed.headerValidation.missingHeaders,
        },
        { status: 400 },
      );
    }

    if (!parsed.rows.length) {
      return NextResponse.json(
        {
          error: "Không có dòng hợp lệ để import",
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const chunkSize = 500;

    await prisma.$transaction(
      async (tx) => {
        // Delete existing data for the same month
        await tx.$executeRawUnsafe(
          `DELETE FROM "ChurnRiskRecord" WHERE "reportMonth" = ?`,
          reportMonth,
        );

        for (let index = 0; index < parsed.rows.length; index += chunkSize) {
          const chunk = parsed.rows.slice(index, index + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            reportMonth,
            row.ctvCode,
            row.customerName,
            row.phone,
            row.packageName,
            row.address,
            file.name || "",
            new Date().toISOString(),
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "ChurnRiskRecord"
            ("reportMonth","ctvCode","customerName","phone","packageName","address","sourceFile","updatedAt")
            VALUES ${valuesSql}
            `,
            ...params,
          );
        }
      },
      { timeout: 120000, maxWait: 15000 },
    );

    clearCacheByPrefix("churn-risk:");

    return NextResponse.json({
      message: "Import nguy cơ rời mạng thành công",
      reportMonth,
      totalRows: parsed.totalRows,
      inserted: parsed.rows.length,
      errors: parsed.errors,
    });
  } catch (error: any) {
    console.error("CHURN_RISK_IMPORT_ERROR", error);
    const rawMessage = String(error?.message || "");
    const friendlyErrorMessage =
      rawMessage === "Failed to parse body as FormData."
        ? "Không đọc được file tải lên. File có thể quá lớn."
        : error?.message || "Lỗi máy chủ nội bộ";
    return NextResponse.json({ error: friendlyErrorMessage }, { status: 500 });
  }
}
