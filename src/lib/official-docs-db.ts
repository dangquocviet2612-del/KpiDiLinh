import { prisma } from "@/lib/prisma";

let ensurePromise: Promise<void> | null = null;

export async function ensureOfficialDocTables() {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficialDocument" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "summary" TEXT,
        "content" TEXT,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "publishedAt" DATETIME,
        "expiresAt" DATETIME,
        "isPinned" INTEGER NOT NULL DEFAULT 0,
        "createdBy" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficialDocumentAsset" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "documentId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "fileUrl" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "mimeType" TEXT,
        "size" INTEGER NOT NULL DEFAULT 0,
        "storageKind" TEXT NOT NULL DEFAULT 'EXTERNAL',
        "fileData" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("documentId") REFERENCES "OfficialDocument" ("id") ON DELETE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficialDocumentTempAsset" (
        "id" TEXT PRIMARY KEY,
        "type" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "mimeType" TEXT,
        "size" INTEGER NOT NULL DEFAULT 0,
        "fileData" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficialDocumentRevision" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "documentId" TEXT NOT NULL,
        "changeType" TEXT NOT NULL,
        "changedBy" TEXT,
        "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "title" TEXT NOT NULL,
        "summary" TEXT,
        "content" TEXT,
        "status" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "isPinned" INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY ("documentId") REFERENCES "OfficialDocument" ("id") ON DELETE CASCADE
      )
    `);

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "OfficialDocumentAsset" ADD COLUMN "storageKind" TEXT NOT NULL DEFAULT 'EXTERNAL'`
      );
    } catch {
      // Column already exists.
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "OfficialDocumentAsset" ADD COLUMN "fileData" TEXT`);
    } catch {
      // Column already exists.
    }

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_status_published"
      ON "OfficialDocument" ("status", "publishedAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_category"
      ON "OfficialDocument" ("category")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_pinned"
      ON "OfficialDocument" ("isPinned", "publishedAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_asset_doc"
      ON "OfficialDocumentAsset" ("documentId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_temp_asset_created"
      ON "OfficialDocumentTempAsset" ("createdAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_official_doc_revision_doc_changed"
      ON "OfficialDocumentRevision" ("documentId", "changedAt")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}
