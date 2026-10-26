export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { auth } from "@/auth";

function canRunSetup(request: Request) {
    const secret = process.env.SETUP_SECRET;
    if (!secret) return false;
    const url = new URL(request.url);
    const provided = request.headers.get("x-setup-secret") || url.searchParams.get("key");
    return provided === secret;
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!canRunSetup(request)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const url = process.env.DATABASE_URL || "file:dev.db";
        const authToken = process.env.TURSO_AUTH_TOKEN;

        const client = createClient({ url, authToken });

        const statements = [
            `CREATE TABLE IF NOT EXISTS "User" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "username" TEXT NOT NULL,
                "password" TEXT NOT NULL,
                "role" TEXT NOT NULL DEFAULT 'CTV',
                "managerCode" TEXT,
                "secondaryCode" TEXT,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
            `CREATE TABLE IF NOT EXISTS "Customer" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "account" TEXT,
                "subscriberType" TEXT NOT NULL,
                "phone" TEXT,
                "package" TEXT,
                "price" REAL,
                "address" TEXT,
                "nodeName" TEXT,
                "latitude" REAL,
                "longitude" REAL,
                "ctvCode" TEXT,
                "billingType" TEXT,
                "prepaidPeriod" INTEGER,
                "renewalMonth" DATETIME,
                "expirationDate" DATETIME,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS "EditHistory" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "customerId" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "details" TEXT NOT NULL,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "EditHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT "EditHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS "Node" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "description" TEXT,
                "latitude" REAL NOT NULL,
                "longitude" REAL NOT NULL,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
        ];

        for (const sql of statements) {
            await client.execute(sql);
        }

        try {
            await client.execute(`ALTER TABLE "User" ADD COLUMN "managerCode" TEXT`);
        } catch {
            // Column may already exist on upgraded databases.
        }
        try {
            await client.execute(`ALTER TABLE "User" ADD COLUMN "secondaryCode" TEXT`);
        } catch {
            // Column may already exist on upgraded databases.
        }

        return NextResponse.json({
            success: true,
            message: "All database tables created successfully! You can now access /api/seed to create the admin user.",
            tables: ["User", "Customer", "EditHistory", "Node"]
        });
    } catch (error) {
        console.error("SETUP ERROR:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
