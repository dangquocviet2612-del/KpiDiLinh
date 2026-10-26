import { prisma } from "@/lib/prisma";

let ensurePromise: Promise<void> | null = null;

export async function ensureNodeEfficiencyColumns() {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    const alterStatements = [
      `ALTER TABLE "Node" ADD COLUMN "totalIntPort" INTEGER`,
      `ALTER TABLE "Node" ADD COLUMN "usedPort" INTEGER`,
      `ALTER TABLE "Node" ADD COLUMN "portEfficiency" REAL`,
      `ALTER TABLE "Node" ADD COLUMN "dateKd" DATETIME`,
      `ALTER TABLE "Node" ADD COLUMN "efficiencyStatus" TEXT`,
    ];

    for (const sql of alterStatements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch {
        // Column already exists.
      }
    }
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}
