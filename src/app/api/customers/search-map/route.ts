import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCtvCodes } from "@/lib/scope";
import { getCache, getCacheGeneration, setCache } from "@/lib/kpi-cache";
import { ensureCustomerSchema } from "@/lib/ensure-customer-schema";

export const dynamic = "force-dynamic";
function parseLimit(value: string | null, defaultLimit = 20, max = 50): number {
    const parsed = Number(value ?? defaultLimit);
    if (Number.isNaN(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(parsed, max);
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

export async function GET(request: Request) {
    const cacheGeneration = getCacheGeneration();
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q")?.trim() || "";
        const limit = parseLimit(searchParams.get("limit"));

        if (!q) return NextResponse.json({ items: [], nextCursor: null });
        const cacheKey = `customers:search-map|${session.user.role || ""}|${session.user.name || ""}|${q}|${limit}`;
        const cached = getCache<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        const qNorm = normalize(q);
        const isNumericQuery = /^\d+$/.test(qNorm);

        const whereClause: any = {
            latitude: { not: null },
            longitude: { not: null },
            OR: [
                { name: { contains: q } },
                { account: { contains: q } },
                { ctvCode: { contains: q } },
                { address: { contains: q } },
            ],
        };

        if (isNumericQuery) {
            whereClause.OR.push({ phone: { contains: qNorm } });
        } else {
            whereClause.OR.push({ phone: { contains: q } });
        }

        const accessibleCtvCodes = await getAccessibleCtvCodes(session);
        if (accessibleCtvCodes !== null) {
            whereClause.ctvCode = { in: accessibleCtvCodes };
        }

        await ensureCustomerSchema();

        const candidateTake = Math.max(limit * 2, 20);
        const raw = await prisma.customer.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                phone: true,
                account: true,
                ctvCode: true,
                address: true,
                latitude: true,
                longitude: true,
                status: true,
            },
            take: candidateTake,
        });

        const scored = raw
            .map((item) => {
                const name = normalize(item.name || "");
                const phone = normalize(item.phone || "");
                const account = normalize(item.account || "");
                const ctvCode = normalize(item.ctvCode || "");
                const address = normalize(item.address || "");

                let score = 0;
                if (phone === qNorm || account === qNorm) score += 100;
                if (phone.startsWith(qNorm) || account.startsWith(qNorm) || name.startsWith(qNorm)) score += 60;
                if (name.includes(qNorm)) score += 30;
                if (ctvCode.includes(qNorm) || address.includes(qNorm)) score += 15;

                return { item, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((x) => x.item);

        const payload = {
            items: scored,
            nextCursor: null,
        };
        setCache(cacheKey, payload, 10_000, cacheGeneration);
        return NextResponse.json(payload);
    } catch (error: any) {
        console.error("search-map customers error", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
