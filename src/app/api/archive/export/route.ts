export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAndPurgeExpired, exportMonthToExcel, recordArchiveExport } from "@/lib/archive";

export async function GET(request: Request) {
  checkAndPurgeExpired().catch((error) => console.error("AUTO_PURGE_ERROR", error));

  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    const month = (new URL(request.url).searchParams.get("month") || "").trim();
    if (!month) {
      return NextResponse.json(
        { error: "Thiếu tháng cần xuất dữ liệu" },
        { status: 400 }
      );
    }

    const exported = await exportMonthToExcel(month);
    await recordArchiveExport(month, String(session.user.name || "admin"), exported.fileName);

    return new NextResponse(exported.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể xuất file lưu trữ" },
      { status: 500 }
    );
  }
}
