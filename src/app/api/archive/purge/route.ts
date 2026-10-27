export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getArchiveStatus, purgeMonthData } from "@/lib/archive";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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

      const purged = await purgeMonthData(month, { requireExpired: false });
      return NextResponse.json({ month, purged });
    }

    const due = await prisma.$queryRawUnsafe<Array<{ archiveMonth: string }>>(
      `
      SELECT "archiveMonth"
      FROM "ArchiveLog"
      WHERE "purgedAt" IS NULL AND datetime("purgeAfter") <= datetime('now')
      ORDER BY "archiveMonth" ASC
      `
    );
    const purgedMonths: string[] = [];
    for (const row of due) {
      if (await purgeMonthData(row.archiveMonth)) {
        purgedMonths.push(row.archiveMonth);
      }
    }

    return NextResponse.json({
      purgedMonths,
      count: purgedMonths.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể purge dữ liệu lưu trữ" },
      { status: 500 }
    );
  }
}
