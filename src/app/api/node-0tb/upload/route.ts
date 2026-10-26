export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";
import { parseFlexibleDate, upsertNode0TbBatch, getNode0TbList } from "@/lib/node-0tb-db";
import { parseImportInteger, toTrimmedString, normalizeHeaderKey } from "@/lib/import-utils";

function detectHeaders(matrix: unknown[][]): { headerRowIndex: number; colMap: { nodeCode: number; dateKd: number; totalPort: number; categoryKd: number } } {
  let headerRowIndex = 0;
  let colMap = { nodeCode: 0, dateKd: 1, totalPort: 2, categoryKd: 3 };

  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    const row = matrix[r] || [];
    const headers = row.map((cell) => normalizeHeaderKey(String(cell ?? "")));

    const nodeIdx = headers.findIndex((h) => h.includes("node") || h.includes("tram") || h.includes("ma thiet bi"));
    const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("ngay kd") || h.includes("kinh doanh") || h.includes("ngay san sang"));
    const portIdx = headers.findIndex((h) => h.includes("port") || h.includes("cong") || h.includes("tong so"));
    const catIdx = headers.findIndex((h) => h.includes("phan loai") || h.includes("thang kd") || h.includes("category") || h.includes("nhom"));

    if (nodeIdx !== -1) {
      headerRowIndex = r;
      colMap = {
        nodeCode: nodeIdx !== -1 ? nodeIdx : 0,
        dateKd: dateIdx !== -1 ? dateIdx : 1,
        totalPort: portIdx !== -1 ? portIdx : 2,
        categoryKd: catIdx !== -1 ? catIdx : (headers.length >= 5 ? 4 : 3),
      };
      break;
    }
  }

  return { headerRowIndex, colMap };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Admin mới có quyền tải lên và cập nhật dữ liệu Node 0TB." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Vui lòng chọn file Excel/XLSM để tải lên." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: "buffer", dense: true });

    // Choose target worksheet: preferentially one containing '0tb' or first sheet
    let targetSheetName = wb.SheetNames.find((s) => s.toLowerCase().includes("0tb") || s.toLowerCase().includes("node"));
    if (!targetSheetName) {
      targetSheetName = wb.SheetNames[0];
    }

    if (!targetSheetName) {
      return NextResponse.json({ error: "File Excel không chứa bảng tính hợp lệ." }, { status: 400 });
    }

    const sheet = wb.Sheets[targetSheetName];
    const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

    if (!matrix || matrix.length === 0) {
      return NextResponse.json({ error: "Bảng tính không có dữ liệu." }, { status: 400 });
    }

    const { headerRowIndex, colMap } = detectHeaders(matrix);
    const dataRows = matrix.slice(headerRowIndex + 1);

    const itemsToUpsert: Array<{
      nodeCode: string;
      dateKd: Date | null;
      dateKdRaw: string;
      dateKdFormatted: string | null;
      totalPort: number | null;
      usedPort: number | null;
      categoryKd: string | null;
    }> = [];

    const skippedRows: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const nodeCode = toTrimmedString(row[colMap.nodeCode]);
      if (!nodeCode || normalizeHeaderKey(nodeCode).startsWith("node") || normalizeHeaderKey(nodeCode).startsWith("ma node")) {
        continue;
      }

      const dateParsed = parseFlexibleDate(row[colMap.dateKd]);
      const totalPort = parseImportInteger(row[colMap.totalPort]);
      let categoryKd = toTrimmedString(row[colMap.categoryKd]);

      // Fallback category if column 4 or 3 is empty
      if (!categoryKd && row.length > 4) {
        categoryKd = toTrimmedString(row[4]);
      }

      itemsToUpsert.push({
        nodeCode,
        dateKd: dateParsed.date,
        dateKdRaw: dateParsed.raw,
        dateKdFormatted: dateParsed.formatted,
        totalPort,
        usedPort: 0,
        categoryKd: categoryKd || "Chưa phân loại",
      });
    }

    if (itemsToUpsert.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy dòng dữ liệu Node 0TB hợp lệ nào trong file." },
        { status: 400 }
      );
    }

    await upsertNode0TbBatch(itemsToUpsert);

    // Refresh list to check coordinate mapping
    const result = await getNode0TbList();

    return NextResponse.json({
      success: true,
      message: `Đã nạp thành công ${itemsToUpsert.length} node vào danh sách Node 0TB.`,
      importedCount: itemsToUpsert.length,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("Error in POST /api/node-0tb/upload:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi khi xử lý file Excel Node 0TB." },
      { status: 500 }
    );
  }
}
