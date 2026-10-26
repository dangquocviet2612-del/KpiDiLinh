import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/kpi-cache";

export const dynamic = "force-dynamic";
export const revalidate = 30;

function parseLimit(value: string | null, defaultLimit = 20, max = 50): number {
    const parsed = Number(value ?? defaultLimit);
    if (Number.isNaN(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(parsed, max);
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q")?.trim() || "";
        const limit = parseLimit(searchParams.get("limit"));

        if (!q || q.length < 2) return NextResponse.json({ items: [] });

        const cacheKey = `node:search|${q}|${limit}`;
        const cached = getCache<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        const coordMatch = q.match(/^([-+]?[0-9]*\.?[0-9]+)[\s,]+([-+]?[0-9]*\.?[0-9]+)$/);
        if (coordMatch) {
            const lat = Number(coordMatch[1]);
            const lng = Number(coordMatch[2]);

            const approxRows = await prisma.$queryRawUnsafe<Array<{
                id: string;
                name: string;
                description: string | null;
                latitude: number;
                longitude: number;
            }>>(
                `
                SELECT id, name, description, latitude, longitude
                FROM "Node"
                ORDER BY ((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)) ASC
                LIMIT ?
                `,
                lat,
                lat,
                lng,
                lng,
                Math.max(limit * 3, 30)
            );

            const items = approxRows
                .map((node) => ({
                    ...node,
                    distanceKm: distanceKm(lat, lng, node.latitude, node.longitude),
                }))
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .slice(0, limit);

            const payload = { items };
            setCache(cacheKey, payload, 30_000);
            return NextResponse.json(payload);
        }

        const qNorm = normalize(q);
        const items = await prisma.node.findMany({
            where: {
                OR: [{ name: { contains: q } }, { description: { contains: q } }],
            },
            select: { id: true, name: true, description: true, latitude: true, longitude: true },
            take: Math.max(limit * 3, 30),
            orderBy: { name: "asc" },
        });

        const scored = items
            .map((node) => {
                const name = normalize(node.name || "");
                const desc = normalize(node.description || "");
                let score = 0;
                if (name === qNorm) score += 100;
                if (name.startsWith(qNorm)) score += 60;
                if (name.includes(qNorm)) score += 30;
                if (desc.includes(qNorm)) score += 10;
                return { node, score };
            })
            .sort((a, b) => b.score - a.score)
            .map((x) => x.node)
            .slice(0, limit);

        const payload = { items: scored };
        setCache(cacheKey, payload, 30_000);
        return NextResponse.json(payload);
    } catch (error: any) {
        console.error("node-search-map error", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
