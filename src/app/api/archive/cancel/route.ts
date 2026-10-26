export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelArchiveConfirmation, checkAndPurgeExpired } from "@/lib/archive";

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
        { error: "Thiếu tháng cần hủy xác nhận" },
        { status: 400 }
      );
    }

    await cancelArchiveConfirmation(month);
    return NextResponse.json({ month, cancelled: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể hủy xác nhận lưu trữ" },
      { status: 500 }
    );
  }
}
