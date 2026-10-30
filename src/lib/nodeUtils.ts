import { prisma } from "@/lib/prisma";

type CachedNode = { name: string; latitude: number; longitude: number };
let nodeCache: CachedNode[] | null = null;
let nodeCacheExpiry = 0;
let nodeCacheGeneration = Symbol();
let nodeCachePending: Promise<CachedNode[]> | null = null;
const NODE_CACHE_TTL_MS = 5 * 60 * 1000;

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

async function loadNodeCoordinates(): Promise<CachedNode[]> {
    const generation = nodeCacheGeneration;
    const nodes = await prisma.node.findMany({ select: { name: true, latitude: true, longitude: true } });
    const coordinates = nodes.filter((node) => node.latitude !== null && node.longitude !== null) as CachedNode[];
    if (generation === nodeCacheGeneration) {
        nodeCache = coordinates;
        nodeCacheExpiry = Date.now() + NODE_CACHE_TTL_MS;
    }
    return coordinates;
}

export async function findNearestNodeName(lat: number, lng: number): Promise<string | null> {
    let nodes = nodeCache;
    if (!nodes || Date.now() > nodeCacheExpiry) {
        if (!nodeCachePending) {
            const pending = loadNodeCoordinates().finally(() => {
                if (nodeCachePending === pending) nodeCachePending = null;
            });
            nodeCachePending = pending;
        }
        nodes = await nodeCachePending;
    }
    let minDistance = Infinity;
    let nearestNodeName: string | null = null;

    for (const node of nodes) {
        if (node.latitude === null || node.longitude === null) continue;
        const dist = getDistanceFromLatLonInKm(lat, lng, node.latitude, node.longitude);
        if (dist < minDistance) {
            minDistance = dist;
            nearestNodeName = node.name;
        }
    }

    return nearestNodeName;
}

export function invalidateNearestNodeCache() {
    nodeCache = null;
    nodeCacheExpiry = 0;
    nodeCacheGeneration = Symbol();
    nodeCachePending = null;
}
