import { prisma } from "@/lib/prisma";

let isCustomerSchemaReady = false;

export async function ensureCustomerSchema(): Promise<void> {
    if (isCustomerSchemaReady) return;

    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN "nodeName" TEXT`);
    } catch {
        // Column may already exist
    }

    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN "status" TEXT DEFAULT 'Hoạt động'`);
    } catch {
        // Column may already exist
    }

    isCustomerSchemaReady = true;
}
