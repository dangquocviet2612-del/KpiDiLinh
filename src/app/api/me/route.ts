export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCache, setCache } from "@/lib/kpi-cache";

// GET current user info (including canUseGps)
export async function GET() {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cacheKey = `user:me|${session.user.id}|${session.user.name || ""}|${session.user.role || ""}`;
        const cached = getCache<any>(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                username: true,
                role: true,
                canUseGps: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        let ctvList: Array<{ id: string; username: string; managerCode?: string | null }> = [];
        if (user.role === "ADMIN" || user.role === "MANAGER") {
            const where: any = { role: "CTV" };
            if (user.role === "MANAGER") where.managerCode = user.username;
            try {
                ctvList = await prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        username: true,
                        managerCode: true,
                    },
                    orderBy: { createdAt: "desc" },
                });
            } catch {
                // Fallback for environments with older Prisma Client typings.
                ctvList = await prisma.$queryRawUnsafe<Array<{ id: string; username: string; managerCode: string | null }>>(
                    user.role === "MANAGER"
                        ? `SELECT id, username, managerCode FROM "User" WHERE role = 'CTV' AND managerCode = ? ORDER BY createdAt DESC`
                        : `SELECT id, username, managerCode FROM "User" WHERE role = 'CTV' ORDER BY createdAt DESC`,
                    ...(user.role === "MANAGER" ? [user.username] : [])
                );
            }
        }

        const payload = { ...user, ctvList };
        setCache(cacheKey, payload, 30_000);
        return NextResponse.json(payload);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
