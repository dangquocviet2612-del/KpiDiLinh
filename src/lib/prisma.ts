import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
    try {
        const url = process.env.DATABASE_URL || "file:dev.db";
        const authToken = process.env.TURSO_AUTH_TOKEN;
        const adapter = new PrismaLibSql({ url, authToken });
        return new PrismaClient({ adapter, log: process.env.PRISMA_DEBUG === "true" ? ["query"] : [] });
    } catch (error: any) {
        if (error.name === "PrismaClientConstructorValidationError" || error.message.includes("engine type \"client\" requires")) {
            return {} as PrismaClient;
        }
        throw error;
    }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
