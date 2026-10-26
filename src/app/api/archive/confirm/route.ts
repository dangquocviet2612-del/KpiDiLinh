export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  checkAndPurgeExpired,
  getArchiveExportReadiness,
  getArchiveStatus,
  upsertArchiveConfirmation,
} from "@/lib/archive";

export async function POST(request: Request) {
  checkAndPurgeExpired().catch((error) => console.error("AUTO_PURGE_ERROR", error));

  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const month = String(body?.month || "").trim();
    if (!month) {
      return NextResponse.json(
        { error: "Thiếu tháng cần xác nhận lưu trữ" },
        { status: 400 }
      );
    }

    const existing = await getArchiveStatus(month);
    if (existing?.purgedAt) {
      return NextResponse.json(
        { error: "Tháng này đã bị purge và không thể xác nhận lại" },
        { status: 400 }
      );
    }

    const exportReadiness = await getArchiveExportReadiness(month);
    if (!exportReadiness.ok || !exportReadiness.exportLog) {
      const errorMessage =
        exportReadiness.reason === "no_data"
          ? "Không có dữ liệu KPI/Cước cho tháng đã chọn"
          : exportReadiness.reason === "stale_export"
            ? "Bản xuất Excel đã cũ. Hãy xuất lại file trước khi xác nhận lưu trữ"
            : "Bạn cần xuất file Excel cho tháng này trước khi xác nhận lưu trữ";

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const archive = await upsertArchiveConfirmation(
      month,
      String(session.user.name || "admin"),
      exportReadiness.exportLog.fileName
    );

    return NextResponse.json({ month, archive });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể xác nhận lưu trữ" },
      { status: 500 }
    );
  }
}
