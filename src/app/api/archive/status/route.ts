export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canArchiveMonth,
  countRecords,
  getArchiveExportReadiness,
  getArchiveStatus,
} from "@/lib/archive";

export async function GET(request: Request) {
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
        { error: "Thiếu tháng cần kiểm tra" },
        { status: 400 }
      );
    }

    const [counts, archive, exportReadiness] = await Promise.all([
      countRecords(month),
      getArchiveStatus(month),
      getArchiveExportReadiness(month),
    ]);

    return NextResponse.json({
      month,
      kpiCount: counts.kpiCount,
      cuocCount: counts.cuocCount,
      archive,
      exportLog: exportReadiness.exportLog,
      exportFresh: exportReadiness.ok,
      confirmBlockedReason: exportReadiness.reason,
      latestDataAt: exportReadiness.latestDataAt,
      canArchive: canArchiveMonth(month, archive),
      canConfirm:
        canArchiveMonth(month, archive) &&
        exportReadiness.ok &&
        counts.kpiCount + counts.cuocCount > 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể tải trạng thái lưu trữ" },
      { status: 500 }
    );
  }
}
