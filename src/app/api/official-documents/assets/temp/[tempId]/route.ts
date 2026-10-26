export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTempOfficialDocAsset } from "@/lib/official-doc-assets";

export async function GET(_: Request, context: { params: Promise<{ tempId: string }> }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }

    const { tempId } = await context.params;
    const asset = await getTempOfficialDocAsset(tempId);
    if (!asset) {
      return NextResponse.json({ error: "Không tìm thấy tệp tạm" }, { status: 404 });
    }

    const buffer = Buffer.from(asset.fileData, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.fileName || `temp-${asset.id}`)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_TEMP_ASSET_GET_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
