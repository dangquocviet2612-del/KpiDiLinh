export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Admin mới có quyền tải file mẫu Node 0TB." },
        { status: 403 }
      );
    }

    const headers = [
      "NODE_CODE",
      "DATE_KD",
      "TOTAL_PORT",
      "PHAN_LOAI_KD",
    ];

    const sampleData = [
      headers,
      ["LDG0019-GN11-SN14", "28/07/2021", 8, "Tủ >24T"],
      ["LDG0019-LDG032-SN25", "10/04/2025", 8, "Tủ 12-24T"],
      ["LDG0068-GN22-SN13", "14/10/2025", 8, "Tủ 6-12T"],
      ["LDG0145-GN31-SN12", "01/01/2026", 16, "Tủ 0-6T"],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(sampleData);

    // Set column widths
    ws["!cols"] = [
      { wch: 26 }, // NODE_CODE
      { wch: 16 }, // DATE_KD
      { wch: 14 }, // TOTAL_PORT
      { wch: 22 }, // PHAN_LOAI_KD
    ];

    xlsx.utils.book_append_sheet(wb, ws, "Node 0TB Mẫu");

    const excelBuffer = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Mau_Node_0TB.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/node-0tb/template:", error);
    return NextResponse.json(
      { error: error?.message || "Không thể tạo file mẫu." },
      { status: 500 }
    );
  }
}
