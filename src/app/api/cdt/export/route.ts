export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureKpiTables } from "@/lib/kpi-db";
import {
  buildCdtExportFileName,
  buildCdtExportWorkbookSheets,
  buildCdtMonthRange,
  resolveCdtExportMonth,
} from "@/lib/cdt-export";
import { getLatestCdtTransactionDate } from "@/lib/prepaid-query";

type ExportRow = {
  transactionDate: string;
  transactionTime: string | null;
  ctvUser: string;
  subscriberType: string;
  account: string;
  months: number;
  amount: number;
};

const BORDER = {
  top: { style: "thin", color: { rgb: "B8C4D1" } },
  bottom: { style: "thin", color: { rgb: "B8C4D1" } },
  left: { style: "thin", color: { rgb: "B8C4D1" } },
  right: { style: "thin", color: { rgb: "B8C4D1" } },
};

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "0F172A" } },
  fill: { patternType: "solid", fgColor: { rgb: "A7D8E8" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: BORDER,
};

const SUMMARY_LABEL_STYLE = {
  font: { bold: true, color: { rgb: "0F172A" } },
  fill: { patternType: "solid", fgColor: { rgb: "D6F5EC" } },
  alignment: { horizontal: "left", vertical: "center" },
  border: BORDER,
};

const SUMMARY_VALUE_STYLE = {
  font: { bold: true, color: { rgb: "0F172A" } },
  fill: { patternType: "solid", fgColor: { rgb: "ECFDF5" } },
  alignment: { horizontal: "right", vertical: "center" },
  border: BORDER,
};

function applyWorksheetStyles(worksheet: xlsx.WorkSheet) {
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 26 },
    { wch: 10 },
    { wch: 14 },
  ];
  worksheet["!autofilter"] = { ref: "A4:G4" };
  worksheet["!rows"] = [{ hpx: 22 }, { hpx: 22 }, { hpx: 8 }, { hpx: 26 }];

  const range = xlsx.utils.decode_range(worksheet["!ref"] || "A1:G1");
  const headerRowIndex = 3;
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = xlsx.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[address] as xlsx.CellObject | undefined;
      if (!cell) continue;

      if (rowIndex === headerRowIndex) {
        cell.s = HEADER_STYLE;
        continue;
      }

      if (rowIndex <= 1 && colIndex <= 1) {
        cell.s = colIndex === 0 ? SUMMARY_LABEL_STYLE : SUMMARY_VALUE_STYLE;
        if (colIndex === 1) {
          cell.z = "#,##0";
        }
        continue;
      }

      if (rowIndex === 2) {
        continue;
      }

      const isNumericColumn = colIndex === 5 || colIndex === 6;
      cell.s = {
        border: BORDER,
        alignment: {
          vertical: "center",
          horizontal: isNumericColumn ? "right" : "left",
        },
        fill: rowIndex % 2 === 0
          ? { patternType: "solid", fgColor: { rgb: "F8FAFC" } }
          : undefined,
      } as any;

      if (colIndex === 6) {
        cell.z = "#,##0";
      }
    }
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    await ensureKpiTables();

    const url = new URL(request.url);
    const latestDate = await getLatestCdtTransactionDate({
      role: String(session.user.role || ""),
      sessionName: String(session.user.name || ""),
      managerCode: "",
    });

    const month = resolveCdtExportMonth({
      month: url.searchParams.get("month") || "",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
      fallbackDate: latestDate || "",
    });

    const { from, to } = buildCdtMonthRange(month);

    const rows = await prisma.$queryRawUnsafe<ExportRow[]>(
      `
        SELECT
          c."transactionDate",
          c."transactionTime",
          c."ctvUser",
          c."subscriberType",
          c."account",
          c."months",
          c."amount"
        FROM "CdtTransaction" c
        WHERE c."transactionDate" >= ? AND c."transactionDate" <= ?
        ORDER BY c."transactionDate" ASC, c."transactionTime" ASC, c."ctvUser" ASC, c."account" ASC
      `,
      from,
      to
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Không có dữ liệu CDT trong tháng đã chọn" }, { status: 404 });
    }

    const workbook = xlsx.utils.book_new();
    for (const sheetData of buildCdtExportWorkbookSheets(rows)) {
      const worksheet = xlsx.utils.aoa_to_sheet(sheetData.rows);
      applyWorksheetStyles(worksheet);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetData.name);
    }
    const buffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildCdtExportFileName(month)}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
