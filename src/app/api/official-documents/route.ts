export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncOfficialDocumentAssets, mapOfficialDocAssets } from "@/lib/official-doc-assets";
import { ensureOfficialDocTables } from "@/lib/official-docs-db";
import { getOfficialDocumentRevisionsByDocumentIds, insertOfficialDocumentRevision } from "@/lib/official-doc-revisions";
import { canViewOfficialDocRevisionHistory, DOC_CATEGORIES, DOC_STATUSES, type DocCategory, type DocStatus } from "@/lib/official-docs";

function asCategory(value: unknown): DocCategory {
  const current = String(value || "");
  return DOC_CATEGORIES.includes(current as DocCategory) ? (current as DocCategory) : "COMMUNICATION_CONTENT";
}

function asStatus(value: unknown): DocStatus {
  const current = String(value || "");
  return DOC_STATUSES.includes(current as DocStatus) ? (current as DocStatus) : "DRAFT";
}

function asIsoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildWhereClause(sessionRole: string, q: string, category: string, status: string) {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (sessionRole !== "ADMIN") {
    clauses.push(`d."status" = 'PUBLISHED'`);
    clauses.push(`(d."expiresAt" IS NULL OR d."expiresAt" >= CURRENT_TIMESTAMP)`);
  } else if (status && DOC_STATUSES.includes(status as DocStatus)) {
    clauses.push(`d."status" = ?`);
    params.push(status);
  }

  if (category && DOC_CATEGORIES.includes(category as DocCategory)) {
    clauses.push(`d."category" = ?`);
    params.push(category);
  }

  if (q) {
    clauses.push(`(d."title" LIKE ? OR d."summary" LIKE ? OR d."content" LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }

    await ensureOfficialDocTables();

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const category = String(searchParams.get("category") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 300) : 100;

    const { whereSql, params } = buildWhereClause(session.user.role, q, category, status);

    const docs = await prisma.$queryRawUnsafe<Array<Record<string, unknown> & { assetsJson: string }>>(
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
        ${whereSql}
        ORDER BY d."isPinned" DESC, COALESCE(d."publishedAt", d."createdAt") DESC
        LIMIT ?
      `,
      ...params,
      limit
    );

    const canViewRevisions = canViewOfficialDocRevisionHistory(session.user.role);
    const revisionsByDocumentId = canViewRevisions
      ? await getOfficialDocumentRevisionsByDocumentIds(docs.map((row) => String(row.id || "")).filter(Boolean))
      : new Map();

    const items = await Promise.all(
      docs.map(async (row) => ({
        ...row,
        isPinned: !!row.isPinned,
        assets: await mapOfficialDocAssets(JSON.parse(String(row.assetsJson || "[]"))),
        revisions: canViewRevisions ? (revisionsByDocumentId.get(String(row.id || "")) || []).slice(0, 8) : [],
      }))
    );

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENTS_GET_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ ADMIN mới được tạo công văn" }, { status: 403 });
    }

    await ensureOfficialDocTables();
    const body = await request.json().catch(() => ({}));

    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Tiêu đề là bắt buộc" }, { status: 400 });
    }

    const id = randomUUID();
    const category = asCategory(body?.category);
    const status = asStatus(body?.status);
    const summary = String(body?.summary || "").trim() || null;
    const content = String(body?.content || "").trim() || null;
    const isPinned = body?.isPinned ? 1 : 0;
    const publishedAt =
      status === "PUBLISHED" ? asIsoDateOrNull(body?.publishedAt) || new Date().toISOString() : null;
    const expiresAt = asIsoDateOrNull(body?.expiresAt);
    const assets = Array.isArray(body?.assets) ? body.assets : [];

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "OfficialDocument"
        ("id","title","category","summary","content","status","publishedAt","expiresAt","isPinned","createdBy","updatedAt")
        VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      `,
      id,
      title,
      category,
      summary,
      content,
      status,
      publishedAt,
      expiresAt,
      isPinned,
      String(session.user.name || "admin")
    );

    await syncOfficialDocumentAssets(id, assets);
    await insertOfficialDocumentRevision({
      documentId: id,
      changeType: "CREATED",
      changedBy: String(session.user.name || "admin"),
      title,
      summary,
      content,
      status,
      category,
      isPinned: !!isPinned,
    });
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("OFFICIAL_DOCUMENTS_POST_ERROR", error);
    return NextResponse.json({ error: error?.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
