import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureOfficialDocTables } from "@/lib/official-docs-db";
import type { DocAsset, DocAssetStorageKind, DocAssetType } from "@/lib/official-docs";

type TempAssetRow = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  fileData: string;
};

type ExistingAssetRow = {
  id: number;
  documentId: string;
  type: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  storageKind: string | null;
  fileData: string | null;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function detectOfficialDocAssetType(mimeType: string): DocAssetType {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("image/")) return "IMAGE";
  return "FILE";
}

export function getOfficialDocInlineAssetUrl(assetId: number | string) {
  return `/api/official-documents/assets/${assetId}`;
}

export function getOfficialDocTempAssetUrl(tempId: string) {
  return `/api/official-documents/assets/temp/${tempId}`;
}

export function resolveOfficialDocAssetUrl(asset: {
  id?: number | null;
  fileUrl?: string | null;
  storageKind?: string | null;
}) {
  const storageKind = String(asset.storageKind || "EXTERNAL").toUpperCase() as DocAssetStorageKind;
  if (storageKind === "INLINE" && asset.id) {
    return getOfficialDocInlineAssetUrl(asset.id);
  }
  return String(asset.fileUrl || "");
}

export async function createTempOfficialDocAsset(file: File): Promise<DocAsset> {
  await ensureOfficialDocTables();

  const tempId = randomUUID();
  const mimeType = file.type || "application/octet-stream";
  const fileName = sanitizeFileName(file.name || "file.bin");
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileData = buffer.toString("base64");
  const type = detectOfficialDocAssetType(mimeType);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "OfficialDocumentTempAsset"
      ("id","type","fileName","mimeType","size","fileData")
      VALUES (?,?,?,?,?,?)
    `,
    tempId,
    type,
    fileName,
    mimeType,
    file.size,
    fileData
  );

  return {
    tempId,
    type,
    fileUrl: getOfficialDocTempAssetUrl(tempId),
    fileName: file.name || fileName,
    mimeType,
    size: file.size,
    storageKind: "INLINE",
  };
}

export async function getTempOfficialDocAsset(tempId: string) {
  await ensureOfficialDocTables();
  const rows = await prisma.$queryRawUnsafe<TempAssetRow[]>(
    `
      SELECT "id","type","fileName","mimeType","size","fileData"
      FROM "OfficialDocumentTempAsset"
      WHERE "id" = ?
      LIMIT 1
    `,
    tempId
  );
  return rows[0] || null;
}

export async function getOfficialDocAssetById(assetId: number) {
  await ensureOfficialDocTables();
  const rows = await prisma.$queryRawUnsafe<Array<ExistingAssetRow & { docStatus: string; expiresAt: string | null }>>(
    `
      SELECT
        a."id",
        a."documentId",
        a."type",
        a."fileUrl",
        a."fileName",
        a."mimeType",
        a."size",
        a."storageKind",
        a."fileData",
        d."status" as "docStatus",
        d."expiresAt"
      FROM "OfficialDocumentAsset" a
      JOIN "OfficialDocument" d ON d."id" = a."documentId"
      WHERE a."id" = ?
      LIMIT 1
    `,
    assetId
  );
  return rows[0] || null;
}

export async function mapOfficialDocAssets(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const id = Number(row.id || 0);
    const storageKind = String(row.storageKind || "EXTERNAL").toUpperCase() as DocAssetStorageKind;
    return {
      id,
      type: String(row.type || "FILE") as DocAssetType,
      fileUrl: resolveOfficialDocAssetUrl({
        id,
        fileUrl: row.fileUrl ? String(row.fileUrl) : "",
        storageKind,
      }),
      fileName: String(row.fileName || ""),
      mimeType: row.mimeType ? String(row.mimeType) : "",
      size: Number(row.size || 0),
      storageKind,
    } satisfies DocAsset;
  });
}

export async function getOfficialDocumentAssetRowsForBackup(orderBySql = "") {
  await ensureOfficialDocTables();
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "OfficialDocumentAsset" ${orderBySql}`
  );
}

export async function syncOfficialDocumentAssets(documentId: string, assets: unknown[]) {
  await ensureOfficialDocTables();

  const existingRows = await prisma.$queryRawUnsafe<ExistingAssetRow[]>(
    `
      SELECT "id","documentId","type","fileUrl","fileName","mimeType","size","storageKind","fileData"
      FROM "OfficialDocumentAsset"
      WHERE "documentId" = ?
      ORDER BY "id" ASC
    `,
    documentId
  );
  const existingMap = new Map(existingRows.map((row) => [row.id, row]));
  const keepIds = new Set<number>();
  const tempIdsToDelete: string[] = [];

  for (const rawAsset of assets) {
    const asset = (rawAsset || {}) as Partial<DocAsset> & { tempId?: string };
    const assetId = Number(asset.id || 0);
    const fileName = String(asset.fileName || "").trim();
    const mimeType = String(asset.mimeType || "").trim();
    const size = Number(asset.size || 0);
    const type = String(asset.type || "FILE");
    const fileUrl = String(asset.fileUrl || "").trim();

    if (assetId && existingMap.has(assetId) && !asset.tempId) {
      const existing = existingMap.get(assetId)!;
      if (String(existing.storageKind || "EXTERNAL").toUpperCase() === "INLINE") {
        await prisma.$executeRawUnsafe(
          `
            UPDATE "OfficialDocumentAsset"
            SET "type" = ?, "fileName" = ?, "mimeType" = ?, "size" = ?, "fileUrl" = ?, "storageKind" = 'INLINE'
            WHERE "id" = ?
          `,
          type,
          fileName || existing.fileName,
          mimeType || existing.mimeType || "",
          size || existing.size || 0,
          existing.fileUrl || "",
          assetId
        );
      } else {
        await prisma.$executeRawUnsafe(
          `
            UPDATE "OfficialDocumentAsset"
            SET "type" = ?, "fileName" = ?, "mimeType" = ?, "size" = ?, "fileUrl" = ?, "storageKind" = 'EXTERNAL', "fileData" = NULL
            WHERE "id" = ?
          `,
          type,
          fileName || existing.fileName,
          mimeType || existing.mimeType || "",
          size || existing.size || 0,
          fileUrl || existing.fileUrl,
          assetId
        );
      }
      keepIds.add(assetId);
      continue;
    }

    if (asset.tempId) {
      const temp = await getTempOfficialDocAsset(String(asset.tempId));
      if (!temp) continue;

      const inserted = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `
          INSERT INTO "OfficialDocumentAsset"
          ("documentId","type","fileUrl","fileName","mimeType","size","storageKind","fileData")
          VALUES (?,?,?,?,?,?,?,?)
          RETURNING "id"
        `,
        documentId,
        temp.type,
        "",
        temp.fileName,
        temp.mimeType || "",
        Number(temp.size || 0),
        "INLINE",
        temp.fileData
      );

      if (inserted[0]?.id) keepIds.add(Number(inserted[0].id));
      tempIdsToDelete.push(temp.id);
      continue;
    }

    if (!fileUrl || !fileName) {
      continue;
    }

    const inserted = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
        INSERT INTO "OfficialDocumentAsset"
        ("documentId","type","fileUrl","fileName","mimeType","size","storageKind","fileData")
        VALUES (?,?,?,?,?,?,?,NULL)
        RETURNING "id"
      `,
      documentId,
      type,
      fileUrl,
      fileName,
      mimeType,
      size,
      "EXTERNAL"
    );

    if (inserted[0]?.id) keepIds.add(Number(inserted[0].id));
  }

  const idsToDelete = existingRows
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id));

  for (const id of idsToDelete) {
    await prisma.$executeRawUnsafe(`DELETE FROM "OfficialDocumentAsset" WHERE "id" = ?`, id);
  }

  for (const tempId of tempIdsToDelete) {
    await prisma.$executeRawUnsafe(`DELETE FROM "OfficialDocumentTempAsset" WHERE "id" = ?`, tempId);
  }
}
