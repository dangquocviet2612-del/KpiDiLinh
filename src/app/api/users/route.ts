export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/api-auth";
import { userInputSchema } from "@/lib/validations/user.schema";
import { recordAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { clearCacheByPrefix, getCache, setCache } from "@/lib/kpi-cache";

async function ensureManagerCodeColumn() {
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "managerCode" TEXT`);
    } catch {
        // Column already exists or DB does not need migration.
    }
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "secondaryCode" TEXT`);
    } catch {
        // Column already exists or DB does not need migration.
    }
}

// GET users for dropdown/management
export async function GET(request: Request) {
    try {
        await ensureManagerCodeColumn();
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const roleFilter = new URL(request.url).searchParams.get("role");
        const where: any = {};
        const cacheKey = `users:list|${session.user.role || ""}|${session.user.name || ""}|${roleFilter || ""}`;
        const cached = getCache<any[]>(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        if (session.user.role === "CTV") {
            where.username = session.user.name;
        } else if (session.user.role === "MANAGER") {
            where.role = "CTV";
            where.managerCode = session.user.name;
        } else if (roleFilter) {
            where.role = roleFilter;
        }

        let users: any[] = [];
        try {
            users = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    role: true,
                    managerCode: true,
                    secondaryCode: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: "desc" }
            });
        } catch {
            // Fallback for old Prisma Client/schema without managerCode
            const clauses: string[] = [];
            const params: string[] = [];

            if (session.user.role === "CTV") {
                clauses.push(`username = ?`);
                params.push(String(session.user.name || ""));
            } else if (session.user.role === "MANAGER") {
                clauses.push(`role = ?`);
                params.push("CTV");
                clauses.push(`managerCode = ?`);
                params.push(String(session.user.name || ""));
            } else if (roleFilter) {
                clauses.push(`role = ?`);
                params.push(roleFilter);
            }

            const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
            users = await prisma.$queryRawUnsafe(
                `SELECT id, username, role, managerCode, secondaryCode, canUseGps, createdAt, updatedAt
                 FROM "User"
                 ${whereSql}
                 ORDER BY createdAt DESC`,
                ...params
            );
        }

        setCache(cacheKey, users, 30_000);
        return NextResponse.json(users);
    } catch (error) {
        console.error("USERS_GET_ERROR", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST create a new User (Admin only)
export async function POST(request: Request) {
    try {
        await ensureManagerCodeColumn();
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;

        const rawBody = await request.json();
        const parseResult = userInputSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map((e) => e.message).join(", ");
            return NextResponse.json({ error: errorDetails }, { status: 422 });
        }

        const { username, password, canUseGps, role, managerCode, secondaryCode } = parseResult.data;

        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let newUser: any;
        try {
            newUser = await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: role || "CTV",
                    managerCode: managerCode || null,
                    secondaryCode: secondaryCode || null,
                    canUseGps: canUseGps === true,
                },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    managerCode: true,
                    secondaryCode: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
        } catch {
            newUser = await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: role || "CTV",
                    canUseGps: canUseGps === true,
                },
                select: {
                    id: true,
                    username: true,
                    role: true,
                    canUseGps: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            if (managerCode !== undefined && managerCode !== null && managerCode !== "") {
                await prisma.$executeRawUnsafe(
                    `UPDATE "User" SET managerCode = ? WHERE id = ?`,
                    String(managerCode),
                    String(newUser.id)
                );
                (newUser as any).managerCode = String(managerCode);
            } else {
                (newUser as any).managerCode = null;
            }
            if (secondaryCode !== undefined && secondaryCode !== null && secondaryCode !== "") {
                await prisma.$executeRawUnsafe(
                    `UPDATE "User" SET secondaryCode = ? WHERE id = ?`,
                    String(secondaryCode),
                    String(newUser.id)
                );
                (newUser as any).secondaryCode = String(secondaryCode);
            } else {
                (newUser as any).secondaryCode = null;
            }
        }

        clearCacheByPrefix("users:list|");
        clearCacheByPrefix("user:me|");
        clearCacheByPrefix("scope:ctv|");
        clearCacheByPrefix("prepaid:");
        clearCacheByPrefix("kpi:summary");
        clearCacheByPrefix("kpi:report");
        clearCacheByPrefix("cuoc:report");
        clearCacheByPrefix("cdt:");

        await recordAuditLog({
            userId: authResult.user.id,
            username: authResult.user.username,
            action: "USER_CREATE",
            resource: "User",
            details: {
                createdUserId: newUser.id,
                createdUsername: newUser.username,
                role: newUser.role,
                canUseGps: newUser.canUseGps,
                managerCode: (newUser as any).managerCode,
            },
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        console.error("USERS_POST_ERROR", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
