import { prisma } from "@/lib/prisma";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";

type SessionLike = {
    user?: {
        role?: string;
        name?: string | null;
    };
} | null;

type ScopeCacheValue =
    | { kind: "all" }
    | { kind: "list"; value: string[] };

export async function getAccessibleCtvCodes(session: SessionLike): Promise<string[] | null> {
    const cacheGeneration = getCacheGeneration();
    if (!session?.user?.role) return [];

    const role = session.user.role;
    const username = session.user.name || "";
    const cacheKey = `scope:ctv|${role}|${username}`;
    const cached = getCache<ScopeCacheValue>(cacheKey);
    if (cached) {
        return cached.kind === "all" ? null : cached.value;
    }

    if (role === "ADMIN") {
        setCache<ScopeCacheValue>(cacheKey, { kind: "all" }, 30_000, cacheGeneration);
        return null;
    }
    if (role === "CTV") {
        const scoped = username ? [username] : [];
        setCache<ScopeCacheValue>(cacheKey, { kind: "list", value: scoped }, 30_000, cacheGeneration);
        return scoped;
    }

    if (role === "MANAGER") {
        try {
            const managed = await prisma.user.findMany({
                where: {
                    role: "CTV",
                    managerCode: username,
                },
                select: { username: true },
            });
            const scoped = managed.map((u) => u.username);
            setCache<ScopeCacheValue>(cacheKey, { kind: "list", value: scoped }, 30_000, cacheGeneration);
            return scoped;
        } catch {
            // Fallback for old Prisma Client/schema without managerCode support.
            const escaped = String(username).replace(/'/g, "''");
            const rows = await prisma.$queryRawUnsafe<Array<{ username: string }>>(
                `SELECT username FROM "User" WHERE role = 'CTV' AND managerCode = '${escaped}'`
            );
            const scoped = rows.map((r) => r.username);
            setCache<ScopeCacheValue>(cacheKey, { kind: "list", value: scoped }, 30_000, cacheGeneration);
            return scoped;
        }
    }

    return [];
}

export async function canAccessCustomerByCtvCode(session: SessionLike, ctvCode: string | null | undefined): Promise<boolean> {
    const allowed = await getAccessibleCtvCodes(session);
    if (allowed === null) return true; // ADMIN
    return !!ctvCode && allowed.includes(ctvCode);
}
