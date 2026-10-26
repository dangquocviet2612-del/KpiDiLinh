import { prisma } from "@/lib/prisma";

let ensurePromise: Promise<void> | null = null;

export async function ensureCustomerNodeMappingTable() {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CustomerNodeMapping" (
        "id" TEXT PRIMARY KEY,
        "account" TEXT NOT NULL,
        "accountKey" TEXT NOT NULL,
        "nodeName" TEXT NOT NULL,
        "accountAddress" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CustomerNodeMapping" ADD COLUMN "accountAddress" TEXT`);
    } catch {
      // Column already exists.
    }

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_node_mapping_account_key"
      ON "CustomerNodeMapping" ("accountKey")
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_customer_node_mapping_node_name"
      ON "CustomerNodeMapping" ("nodeName")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}
