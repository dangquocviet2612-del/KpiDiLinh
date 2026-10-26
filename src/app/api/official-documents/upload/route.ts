export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTempOfficialDocAsset } from "@/lib/official-doc-assets";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ ADMIN mới được tải tệp công văn" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui lòng chọn file để tải lên" }, { status: 400 });
    }

    const maxSizeMb = file.type.startsWith("video/") ? 200 : 20;
    const maxSize = maxSizeMb * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File vượt quá ${maxSizeMb}MB` }, { status: 400 });
    }

    const item = await createTempOfficialDocAsset(file);
    return NextResponse.json({ item });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_UPLOAD_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
