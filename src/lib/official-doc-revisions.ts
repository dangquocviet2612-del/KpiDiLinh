import { prisma } from "@/lib/prisma";
import { ensureOfficialDocTables } from "@/lib/official-docs-db";
import type { DocCategory, DocRevision, DocStatus } from "@/lib/official-docs";

type RevisionSnapshotInput = {
  documentId: string;
  changeType: "CREATED" | "UPDATED";
  changedBy: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  status: DocStatus;
  category: DocCategory;
  isPinned: boolean;
};

type RevisionRow = {
  id: number;
  documentId: string;
  changeType: string;
  changedBy: string | null;
  changedAt: string;
  title: string;
  summary: string | null;
  content: string | null;
  status: string;
  category: string;
  isPinned: number | boolean | null;
};

function mapRevisionRow(row: RevisionRow): DocRevision {
  return {
    id: Number(row.id),
    documentId: String(row.documentId || ""),
    changeType: String(row.changeType || "UPDATED").toUpperCase() === "CREATED" ? "CREATED" : "UPDATED",
    changedBy: row.changedBy ? String(row.changedBy) : null,
    changedAt: String(row.changedAt || ""),
    title: String(row.title || ""),
    summary: row.summary ? String(row.summary) : null,
    content: row.content ? String(row.content) : null,
    status: String(row.status || "DRAFT") as DocStatus,
    category: String(row.category || "COMMUNICATION_CONTENT") as DocCategory,
    isPinned: !!row.isPinned,
  };
}

export async function insertOfficialDocumentRevision(input: RevisionSnapshotInput) {
  await ensureOfficialDocTables();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "OfficialDocumentRevision"
      ("documentId","changeType","changedBy","title","summary","content","status","category","isPinned")
      VALUES (?,?,?,?,?,?,?,?,?)
    `,
    input.documentId,
    input.changeType,
    input.changedBy,
    input.title,
    input.summary,
    input.content,
    input.status,
    input.category,
    input.isPinned ? 1 : 0
  );
}

export async function getOfficialDocumentRevisionsByDocumentIds(documentIds: string[]) {
  if (!documentIds.length) {
    return new Map<string, DocRevision[]>();
  }

  await ensureOfficialDocTables();
  const placeholders = documentIds.map(() => "?").join(", ");
  const rows = await prisma.$queryRawUnsafe<RevisionRow[]>(
    `
      SELECT
        r."id",
        r."documentId",
        r."changeType",
        r."changedBy",
        r."changedAt",
        r."title",
        r."summary",
        r."content",
        r."status",
        r."category",
        r."isPinned"
      FROM "OfficialDocumentRevision" r
      WHERE r."documentId" IN (${placeholders})
      ORDER BY r."changedAt" DESC, r."id" DESC
    `,
    ...documentIds
  );

  const grouped = new Map<string, DocRevision[]>();
  for (const row of rows) {
    const revision = mapRevisionRow(row);
    const list = grouped.get(revision.documentId) || [];
    list.push(revision);
    grouped.set(revision.documentId, list);
  }
  return grouped;
}

export async function getOfficialDocumentRevisionsByDocumentId(documentId: string, limit = 12) {
  const grouped = await getOfficialDocumentRevisionsByDocumentIds([documentId]);
  return (grouped.get(documentId) || []).slice(0, limit);
}
