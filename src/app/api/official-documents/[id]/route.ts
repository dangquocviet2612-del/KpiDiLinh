export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureOfficialDocTables } from "@/lib/official-docs-db";
import { mapOfficialDocAssets, syncOfficialDocumentAssets } from "@/lib/official-doc-assets";
import { getOfficialDocumentRevisionsByDocumentId, insertOfficialDocumentRevision } from "@/lib/official-doc-revisions";
import { canViewOfficialDocRevisionHistory, DOC_CATEGORIES, DOC_STATUSES, type DocCategory, type DocStatus } from "@/lib/official-docs";

function asIsoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }

    await ensureOfficialDocTables();
    const { id } = await context.params;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown> & { assetsJson: string }>>(
      `
        SELECT
          d."id", d."title", d."category", d."summary", d."content", d."status",
          d."publishedAt", d."expiresAt", d."isPinned", d."createdBy", d."createdAt", d."updatedAt",
          COALESCE(
            (
              SELECT json_group_array(
                json_object(
                  'id', a."id",
                  'type', a."type",
                  'fileUrl', a."fileUrl",
                  'fileName', a."fileName",
                  'mimeType', a."mimeType",
                  'size', a."size",
                  'storageKind', a."storageKind",
                  'createdAt', a."createdAt"
                )
              )
              FROM "OfficialDocumentAsset" a
              WHERE a."documentId" = d."id"
            ),
            '[]'
          ) AS assetsJson
        FROM "OfficialDocument" d
        WHERE d."id" = ?
        LIMIT 1
      `,
      id
    );

    const doc = rows[0];
    if (!doc) {
      return NextResponse.json({ error: "Không tìm thấy công văn" }, { status: 404 });
    }

    if (
      session.user.role !== "ADMIN" &&
      (doc.status !== "PUBLISHED" || (doc.expiresAt && new Date(String(doc.expiresAt)).getTime() < Date.now()))
    ) {
      return NextResponse.json({ error: "Bạn không có quyền xem công văn này" }, { status: 403 });
    }

    const canViewRevisions = canViewOfficialDocRevisionHistory(session.user.role);
    return NextResponse.json({
      item: {
        ...doc,
        isPinned: !!doc.isPinned,
        assets: await mapOfficialDocAssets(JSON.parse(String(doc.assetsJson || "[]"))),
        revisions: canViewRevisions ? await getOfficialDocumentRevisionsByDocumentId(id) : [],
      },
    });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_GET_BY_ID_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ ADMIN mới được chỉnh sửa công văn" }, { status: 403 });
    }

    await ensureOfficialDocTables();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Tiêu đề là bắt buộc" }, { status: 400 });
    }

    const category = String(body?.category || "");
    const status = String(body?.status || "");
    if (!DOC_CATEGORIES.includes(category as DocCategory)) {
      return NextResponse.json({ error: "Danh mục không hợp lệ" }, { status: 400 });
    }
    if (!DOC_STATUSES.includes(status as DocStatus)) {
      return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }

    const summary = String(body?.summary || "").trim() || null;
    const content = String(body?.content || "").trim() || null;
    const isPinned = body?.isPinned ? 1 : 0;
    const publishedAt =
      status === "PUBLISHED" ? asIsoDateOrNull(body?.publishedAt) || new Date().toISOString() : null;
    const expiresAt = asIsoDateOrNull(body?.expiresAt);
    const assets = Array.isArray(body?.assets) ? body.assets : [];

    const updated = await prisma.$executeRawUnsafe(
      `
        UPDATE "OfficialDocument"
        SET "title" = ?, "category" = ?, "summary" = ?, "content" = ?, "status" = ?,
            "publishedAt" = ?, "expiresAt" = ?, "isPinned" = ?, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      title,
      category,
      summary,
      content,
      status,
      publishedAt,
      expiresAt,
      isPinned,
      id
    );

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy công văn" }, { status: 404 });
    }

    await syncOfficialDocumentAssets(id, assets);
    await insertOfficialDocumentRevision({
      documentId: id,
      changeType: "UPDATED",
      changedBy: String(session.user.name || "admin"),
      title,
      summary,
      content,
      status: status as DocStatus,
      category: category as DocCategory,
      isPinned: !!isPinned,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_PUT_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ ADMIN mới được xóa công văn" }, { status: 403 });
    }

    await ensureOfficialDocTables();
    const { id } = await context.params;
    await prisma.$executeRawUnsafe(`DELETE FROM "OfficialDocument" WHERE "id" = ?`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENT_DELETE_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
