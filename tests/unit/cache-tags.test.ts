import { beforeEach, describe, expect, it, vi } from "vitest";

const keys = [
  "cuoc:report|A", "kpi:report|A", "kpi:summary|A", "kpi:manager-summary|A",
  "prepaid:cuoc-config", "prepaid:latest-user|CuocDailyResult|A",
  "node:search|old", "nodes:list", "map:data|A", "map:detail|A",
  "customers:list|A", "customers:search-map|A", "users:list|CTV", "user:me|A",
  "scope:ctv|MANAGER|A", "cuoc-cd:report|A", "cdt:report|A", "disconnect:report|A",
  "churn-risk:report|A", "future:unknown-dependency",
];

beforeEach(() => { vi.resetModules(); });

async function populatedCache() {
  const cache = await import("@/lib/kpi-cache");
  for (const key of keys) cache.setCache(key, { key }, 60_000);
  return cache;
}

describe("process-cache mutation dependencies", () => {
  it("invalidates all derived KPI/cuoc/prepaid cache entries but keeps unrelated domains", async () => {
    const cache = await populatedCache();
    const { invalidateCacheForMutation } = await import("@/lib/cache-tags");
    invalidateCacheForMutation("cuoc");
    for (const key of keys) {
      const affected = ["cuoc:", "kpi:", "prepaid:"].some((prefix) => key.startsWith(prefix));
      expect(cache.getCache(key), key).toEqual(affected ? null : { key });
    }
  });

  it("invalidates node search/list and map caches without clearing report domains", async () => {
    const cache = await populatedCache();
    const { invalidateCacheForMutation } = await import("@/lib/cache-tags");
    invalidateCacheForMutation("nodes");
    for (const key of keys) {
      const affected = ["node:", "nodes:", "map:", "customers:"].some((prefix) => key.startsWith(prefix));
      expect(cache.getCache(key), key).toEqual(affected ? null : { key });
    }
  });

  it.each(["users", "restore"] as const)("clears every process entry for %s, including future private keys", async (mutation) => {
    const cache = await populatedCache();
    const { invalidateCacheForMutation } = await import("@/lib/cache-tags");
    invalidateCacheForMutation(mutation);
    for (const key of keys) expect(cache.getCache(key), key).toBeNull();
  });
});
