export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireAuth } from "@/lib/api-auth";
import { userInputSchema } from "@/lib/validations/user.schema";
import { recordAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { invalidateCacheForMutation } from "@/lib/cache-tags";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";

async function ensureManagerCodeColumn() {
    await ensureRuntimeSchema("users");
}

// GET users for dropdown/management
export async function GET(request: Request) {
    const cacheGeneration = getCacheGeneration();
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await ensureManagerCodeColumn();

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

        setCache(cacheKey, users, 30_000, cacheGeneration);
        return NextResponse.json(users);
    } catch (error) {
        console.error("USERS_GET_ERROR", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST create a new User (Admin only)
export async function POST(request: Request) {
    let writeCommitted = false;
    try {
        const authResult = await requireAuth({ roles: ["ADMIN"] });
        if (authResult.errorResponse) return authResult.errorResponse;

        const rawBody = await request.json();
        const parseResult = userInputSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map((e) => e.message).join(", ");
            return NextResponse.json({ error: errorDetails }, { status: 422 });
        }

        const { username, password, canUseGps, role, managerCode, secondaryCode } = parseResult.data;

        await ensureManagerCodeColumn();

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
            writeCommitted = true;
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
            writeCommitted = true;
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

        invalidateCacheForMutation("users");
        writeCommitted = false;

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
    } finally {
        if (writeCommitted) invalidateCacheForMutation("users");
    }
}
