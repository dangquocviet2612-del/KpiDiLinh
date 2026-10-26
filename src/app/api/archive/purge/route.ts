export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAndPurgeExpired, getArchiveStatus, purgeMonthData } from "@/lib/archive";
import { prisma } from "@/lib/prisma";

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

    if (month) {
      const archive = await getArchiveStatus(month);
      if (!archive) {
        return NextResponse.json(
          { error: "Không tìm thấy xác nhận lưu trữ cho tháng đã chọn" },
          { status: 400 }
        );
      }
      if (archive.purgedAt) {
        return NextResponse.json({ month, purged: false, reason: "already_purged" });
      }

      await purgeMonthData(month);
      return NextResponse.json({ month, purged: true });
    }

    const due = await prisma.$queryRawUnsafe<Array<{ archiveMonth: string }>>(
      `
      SELECT "archiveMonth"
      FROM "ArchiveLog"
      WHERE "purgedAt" IS NULL AND datetime("purgeAfter") <= datetime('now')
      ORDER BY "archiveMonth" ASC
      `
    );
    for (const row of due) {
      await purgeMonthData(row.archiveMonth);
    }

    return NextResponse.json({
      purgedMonths: due.map((item) => item.archiveMonth),
      count: due.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể purge dữ liệu lưu trữ" },
      { status: 500 }
    );
  }
}
