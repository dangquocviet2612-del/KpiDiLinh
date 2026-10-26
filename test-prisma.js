const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

try {
    const adapter = new PrismaLibSql({ url: "file:dev.db" });
    const prisma = new PrismaClient({ adapter, log: ['query'] });
    console.log("Prisma instance:", !!prisma);
    prisma.user.findMany().then(() => console.log("Queries work!")).catch(console.error);
} catch (e) {
    console.error("Prisma error:", e);
}
