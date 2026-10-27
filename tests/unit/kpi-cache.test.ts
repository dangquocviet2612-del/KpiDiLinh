import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

describe("bounded process cache", () => {
  it("expires at the exact TTL boundary", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const cache = await import("@/lib/kpi-cache");
    cache.setCache("report", { count: 1 }, 50);
    clock.mockReturnValue(1049);
    expect(cache.getCache("report")).toEqual({ count: 1 });
    clock.mockReturnValue(1050);
    expect(cache.getCache("report")).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("does not retain values with invalid/non-positive TTL %s", async (ttl) => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const cache = await import("@/lib/kpi-cache");
    cache.setCache("report", "previous", 60_000);
    cache.setCache("report", "invalid", ttl);
    expect(cache.getCache("report")).toBeNull();
  });

  it("evicts the oldest unused entry when 1000 live entries are exceeded", async () => {
    const cache = await import("@/lib/kpi-cache");
    for (let index = 0; index < 1000; index += 1) cache.setCache(`report:${index}`, index, 60_000);
    cache.setCache("report:new", "new", 60_000);
    expect(cache.getCache("report:0")).toBeNull();
    expect(cache.getCache("report:1")).toBe(1);
    expect(cache.getCache("report:999")).toBe(999);
    expect(cache.getCache("report:new")).toBe("new");
  });

  it("keeps a recently read entry but does not extend its TTL", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const cache = await import("@/lib/kpi-cache");
    for (let index = 0; index < 1000; index += 1) cache.setCache(`report:${index}`, index, 100);
    clock.mockReturnValue(1050);
    expect(cache.getCache("report:0")).toBe(0);
    cache.setCache("report:new", "new", 100);
    expect(cache.getCache("report:0")).toBe(0);
    expect(cache.getCache("report:1")).toBeNull();
    clock.mockReturnValue(1100);
    expect(cache.getCache("report:0")).toBeNull();
    expect(cache.getCache("report:new")).toBe("new");
  });

  it("prunes expired entries before evicting a still-live entry", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const cache = await import("@/lib/kpi-cache");
    cache.setCache("live", "keep", 100);
    for (let index = 1; index < 1000; index += 1) cache.setCache(`expired:${index}`, index, 5);
    clock.mockReturnValue(1005);
    cache.setCache("new", "new", 100);
    for (let index = 0; index < 998; index += 1) cache.setCache(`fill:${index}`, index, 100);
    expect(cache.getCache("live")).toBe("keep");
    expect(cache.getCache("expired:1")).toBeNull();
  });

  it("updates existing keys without evicting another entry", async () => {
    const cache = await import("@/lib/kpi-cache");
    for (let index = 0; index < 1000; index += 1) cache.setCache(`report:${index}`, index, 60_000);
    cache.setCache("report:0", "updated", 60_000);
    expect(cache.getCache("report:1")).toBe(1);
    cache.setCache("report:new", "new", 60_000);
    expect(cache.getCache("report:2")).toBeNull();
    expect(cache.getCache("report:1")).toBe(1);
    expect(cache.getCache("report:0")).toBe("updated");
  });

  it("preserves false, zero and empty array cache values", async () => {
    const cache = await import("@/lib/kpi-cache");
    cache.setCache("false", false, 60_000);
    cache.setCache("zero", 0, 60_000);
    cache.setCache("array", [], 60_000);
    expect(cache.getCache("false")).toBe(false);
    expect(cache.getCache("zero")).toBe(0);
    expect(cache.getCache("array")).toEqual([]);
  });

  it("clears only matching prefixes, including entries made recently used", async () => {
    const cache = await import("@/lib/kpi-cache");
    cache.setCache("kpi:report|A", "report", 60_000);
    cache.setCache("kpi:summary|A", "summary", 60_000);
    cache.setCache("nodes:list", "nodes", 60_000);
    cache.getCache("kpi:report|A");
    cache.clearCacheByPrefix("kpi:");
    expect(cache.getCache("kpi:report|A")).toBeNull();
    expect(cache.getCache("kpi:summary|A")).toBeNull();
    expect(cache.getCache("nodes:list")).toBe("nodes");
    cache.clearCacheByPrefix("");
    expect(cache.getCache("nodes:list")).toBeNull();
  });
});
