export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOfficialDocAssetById } from "@/lib/official-doc-assets";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }

    const { assetId } = await context.params;
    const numericId = Number(assetId);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Tệp không hợp lệ" }, { status: 400 });
    }

    const asset = await getOfficialDocAssetById(numericId);
    if (!asset) {
      return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404 });
    }

    if (
      session.user.role !== "ADMIN" &&
      (asset.docStatus !== "PUBLISHED" || (asset.expiresAt && new Date(asset.expiresAt).getTime() < Date.now()))
    ) {
      return NextResponse.json({ error: "Bạn không có quyền xem tệp này" }, { status: 403 });
    }

    const storageKind = String(asset.storageKind || "EXTERNAL").toUpperCase();
    if (storageKind !== "INLINE") {
      if (!asset.fileUrl) {
        return NextResponse.json({ error: "Tệp không khả dụng" }, { status: 404 });
      }
      return NextResponse.redirect(asset.fileUrl);
    }

    if (!asset.fileData) {
      return NextResponse.json({ error: "Dữ liệu tệp bị thiếu" }, { status: 404 });
    }

    const buffer = Buffer.from(asset.fileData, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.fileName || `asset-${asset.id}`)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_ASSET_GET_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
