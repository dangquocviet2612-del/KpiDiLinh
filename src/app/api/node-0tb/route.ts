export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clearNode0TbData, getNode0TbList } from "@/lib/node-0tb-db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;

    const data = await getNode0TbList({ search, category });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in GET /api/node-0tb:", error);
    return NextResponse.json(
      { error: error?.message || "Không thể tải danh sách Node 0TB" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Admin mới có quyền xóa dữ liệu Node 0TB" }, { status: 403 });
    }

    await clearNode0TbData();
    return NextResponse.json({ success: true, message: "Đã xóa toàn bộ dữ liệu Node 0TB" });
  } catch (error: any) {
    console.error("Error in DELETE /api/node-0tb:", error);
    return NextResponse.json(
      { error: error?.message || "Không thể xóa dữ liệu Node 0TB" },
      { status: 500 }
    );
  }
}
