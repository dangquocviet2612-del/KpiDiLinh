export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";
import {
  buildDisconnectCtvUsernameMaps,
  DISCONNECT_TEMPLATE_HEADERS_BY_SOURCE,
  normalizeDisconnectReportMonth,
  normalizeDisconnectSourceType,
  parseDisconnectWorksheetRows,
  resolveDisconnectCtvUsername,
} from "@/lib/disconnect";
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
    const reportMonth = normalizeDisconnectReportMonth(formData.get("reportMonth"));
    const sourceType = normalizeDisconnectSourceType(formData.get("sourceType"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui lòng chọn file rời mạng" }, { status: 400 });
    }
    if (!reportMonth) {
      return NextResponse.json(
        { error: "Kỳ file không hợp lệ, cần dùng định dạng YYYY-MM" },
        { status: 400 },
      );
    }
    if (!sourceType) {
      return NextResponse.json({ error: "Nguồn rời mạng không hợp lệ" }, { status: 400 });
    }

    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
      raw: true,
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      cellText: false,
      sheetStubs: false,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Không đọc được sheet dữ liệu" }, { status: 400 });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const parsed = parseDisconnectWorksheetRows(sheet, sourceType);
    if (!parsed.headerValidation.matches) {
      return NextResponse.json(
        {
          error: "File rời mạng không đúng mẫu",
          expectedHeaders: DISCONNECT_TEMPLATE_HEADERS_BY_SOURCE[sourceType],
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

    const users = await prisma.user.findMany({
      where: { role: "CTV" },
      select: { username: true, secondaryCode: true },
    } as any);
    const ctvMaps = buildDisconnectCtvUsernameMaps(
      users as Array<{ username: string; secondaryCode: string | null }>,
    );

    const matchedRows = parsed.rows
      .map((row) => {
        const ctvUsername = resolveDisconnectCtvUsername(row.ctvCode, ctvMaps);
        if (!ctvUsername) {
          parsed.errors.push(
            `Dòng ${row.sourceLineNo}: STAFF_CODE_THU_CUOC "${row.ctvCode}" không tồn tại trong hệ thống`,
          );
          return null;
        }
        return {
          ...row,
          ctvCode: ctvUsername,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (!matchedRows.length) {
      return NextResponse.json(
        {
          error: "Không có mã CTV nào trong file khớp hệ thống",
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const chunkSize = 500;
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "DisconnectRecord" WHERE "reportMonth" = ? AND "sourceType" = ?`,
          reportMonth,
          sourceType,
        );

        for (let index = 0; index < matchedRows.length; index += chunkSize) {
          const chunk = matchedRows.slice(index, index + chunkSize);
          const valuesSql = chunk.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(", ");
          const params = chunk.flatMap((row) => [
            reportMonth,
            sourceType,
            row.account,
            row.serviceName,
            row.ctvCode,
            row.suspendedDateIso,
            row.suspendedDateText,
            row.cancelDateIso,
            row.cancelDateText,
            row.cancelMonth,
            file.name || "",
            new Date().toISOString(),
          ]);

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "DisconnectRecord"
            ("reportMonth","sourceType","account","serviceName","ctvCode","suspendedDateIso","suspendedDateText","cancelDateIso","cancelDateText","cancelMonth","sourceFile","updatedAt")
            VALUES ${valuesSql}
            `,
            ...params,
          );
        }
      },
      { timeout: 120000, maxWait: 15000 },
    );

    clearCacheByPrefix("disconnect:");
    clearCacheByPrefix("prepaid:");

    return NextResponse.json({
      message: "Import rời mạng thành công",
      reportMonth,
      sourceType,
      totalRows: parsed.totalRows,
      inserted: matchedRows.length,
      duplicateCount: parsed.duplicateCount,
      skipped: Math.max(0, parsed.totalRows - matchedRows.length),
      skippedUnknownCtv: Math.max(0, parsed.rows.length - matchedRows.length),
      errors: parsed.errors,
    });
  } catch (error: any) {
    console.error("DISCONNECT_IMPORT_ERROR", error);
    const rawMessage = String(error?.message || "");
    const friendlyErrorMessage = rawMessage === "Failed to parse body as FormData."
      ? "Không đọc được file tải lên. File có thể quá lớn, vui lòng khởi động lại server để áp dụng cấu hình upload mới rồi thử lại."
      : error?.message || "Lỗi máy chủ nội bộ";
    return NextResponse.json({ error: friendlyErrorMessage }, { status: 500 });
  }
}
