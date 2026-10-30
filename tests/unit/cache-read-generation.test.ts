import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  raw: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: state.findUnique, findMany: state.findMany },
  $queryRawUnsafe: state.raw,
} }));

let cache: typeof import("@/lib/kpi-cache");
const key = "user:me|subject-a|CTV_A|CTV";
const session = { user: { id: "subject-a", name: "CTV_A", role: "CTV" } };
const profile = (canUseGps = false) => ({ id: "subject-a", username: "CTV_A", role: "CTV", canUseGps });
function generation(): symbol {
  return cache.getCacheGeneration();
}

function write(cacheKey: string, value: unknown, ttl: number, token: symbol) {
  cache.setCache(cacheKey, value, ttl, token);
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  cache = await import("@/lib/kpi-cache");
  state.auth.mockResolvedValue(session);
  state.findUnique.mockResolvedValue(profile());
  state.findMany.mockResolvedValue([]);
  state.raw.mockResolvedValue([]);
});

describe("cache read generation behavior", () => {
  it("does not refill a profile invalidated during its database read", async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    state.findUnique.mockReturnValueOnce(pending.promise);
    const route = await import("@/app/api/me/route");
    const response = route.GET();
    await vi.waitFor(() => expect(state.findUnique).toHaveBeenCalledTimes(1));
    const tags = await import("@/lib/cache-tags");
    tags.invalidateCacheForMutation("users");
    pending.resolve(profile(true));
    expect((await response).status).toBe(200);
    expect(cache.getCache(key)).toBeNull();
  });

  it("cannot overwrite a newer profile fill with an older pending response", async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    state.findUnique.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(profile(false));
    const route = await import("@/app/api/me/route");
    const oldResponse = route.GET();
    await vi.waitFor(() => expect(state.findUnique).toHaveBeenCalledTimes(1));
    cache.clearCacheByPrefix("");
    expect((await route.GET()).status).toBe(200);
    pending.resolve(profile(true));
    expect(await (await oldResponse).json()).toMatchObject({ canUseGps: true });
    expect(cache.getCache(key)).toMatchObject({ canUseGps: false });
  });

  it("captures the generation before awaiting authentication", async () => {
    const pending = deferred<typeof session>();
    state.auth.mockReturnValueOnce(pending.promise);
    const route = await import("@/app/api/me/route");
    const response = route.GET();
    await vi.waitFor(() => expect(state.auth).toHaveBeenCalledTimes(1));
    cache.clearCacheByPrefix("");
    pending.resolve(session);
    expect((await response).status).toBe(200);
    expect(cache.getCache(key)).toBeNull();
  });

  it("keeps auth/status/payload and ordinary cache-hit behavior unchanged", async () => {
    const route = await import("@/app/api/me/route");
    expect(await (await route.GET()).json()).toEqual({ ...profile(), ctvList: [] });
    expect(await (await route.GET()).json()).toEqual({ ...profile(), ctvList: [] });
    expect(state.findUnique).toHaveBeenCalledTimes(1);
    state.auth.mockResolvedValueOnce(null);
    expect((await route.GET()).status).toBe(401);
    expect(state.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([null, new Error("synthetic read failure")])("does not cache a missing/failed profile %s", async (result) => {
    if (result instanceof Error) state.findUnique.mockRejectedValueOnce(result);
    else state.findUnique.mockResolvedValueOnce(null);
    const route = await import("@/app/api/me/route");
    expect((await route.GET()).status).toBe(result === null ? 404 : 500);
    expect(cache.getCache(key)).toBeNull();
  });

  it("does not refill manager scope after users invalidation", async () => {
    const pending = deferred<Array<{ username: string }>>();
    state.findMany.mockReturnValueOnce(pending.promise);
    const scope = await import("@/lib/scope");
    const read = scope.getAccessibleCtvCodes({ user: { role: "MANAGER", name: "MANAGER_A" } });
    await vi.waitFor(() => expect(state.findMany).toHaveBeenCalledTimes(1));
    cache.clearCacheByPrefix("");
    pending.resolve([{ username: "CTV_OLD" }]);
    expect(await read).toEqual(["CTV_OLD"]);
    expect(cache.getCache("scope:ctv|MANAGER|MANAGER_A")).toBeNull();
  });

  it("does not refill either scope layer after nested prepaid scope was invalidated", async () => {
    const pending = deferred<Array<{ username: string }>>();
    state.findMany.mockReturnValueOnce(pending.promise);
    const prepaid = await import("@/lib/prepaid-query");
    const read = prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: "MANAGER_A" });
    await vi.waitFor(() => expect(state.findMany).toHaveBeenCalledTimes(1));
    cache.clearCacheByPrefix("");
    pending.resolve([{ username: "CTV_OLD" }]);
    expect(await read).toEqual(["CTV_OLD"]);
    expect(cache.getCache("scope:ctv|MANAGER|MANAGER_A")).toBeNull();
    expect(cache.getCache("prepaid:scope|MANAGER|MANAGER_A")).toBeNull();
  });

  it("does not refill the old latest date after cuoc invalidation", async () => {
    const pending = deferred<Array<{ reportDate: string }>>();
    state.raw.mockReturnValueOnce(pending.promise);
    const prepaid = await import("@/lib/prepaid-query");
    const read = prepaid.getLatestCuocReportDateForCtv("CTV_A");
    await vi.waitFor(() => expect(state.raw).toHaveBeenCalledTimes(1));
    const tags = await import("@/lib/cache-tags");
    tags.invalidateCacheForMutation("cuoc");
    pending.resolve([{ reportDate: "2026-10-20" }]);
    expect(await read).toBe("2026-10-20");
    expect(cache.getCache("prepaid:latest-user|CuocDailyResult|CTV_A")).toBeNull();
  });

  it("changes generation even when invalidation has no settled entries", () => {
    const token = generation();
    cache.clearCacheByPrefix("kpi:");
    expect(generation()).not.toBe(token);
  });

  it("rejects stale fills of an empty cache", () => {
    const token = generation();
    cache.clearCacheByPrefix("kpi:");
    write("kpi:report", "old", 60_000, token);
    expect(cache.getCache("kpi:report")).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("stale TTL %s cannot evict a fresh value", (ttl) => {
    const token = generation();
    cache.clearCacheByPrefix("");
    write("kpi:report", "fresh", 60_000, generation());
    write("kpi:report", "stale", ttl, token);
    expect(cache.getCache("kpi:report")).toBe("fresh");
  });

  it("fences ongoing writes conservatively without clearing unrelated settled entries", () => {
    cache.setCache("nodes:list", "keep", 60_000);
    const token = generation();
    cache.clearCacheByPrefix("kpi:");
    expect(cache.getCache("nodes:list")).toBe("keep");
    write("nodes:new", "old", 60_000, token);
    expect(cache.getCache("nodes:new")).toBeNull();
  });

  it("does not advance generation on reads, TTL expiry or LRU eviction", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const token = generation();
    write("short", false, 1, token);
    expect(cache.getCache("short")).toBe(false);
    clock.mockReturnValue(1001);
    expect(cache.getCache("short")).toBeNull();
    for (let index = 0; index < 1001; index++) write("entry:" + index, index, 60_000, token);
    expect(generation()).toBe(token);
    write("accepted", 0, 60_000, token);
    expect(cache.getCache("accepted")).toBe(0);
  });

  it("does not accept an older token after multiple invalidation generations", () => {
    const first = generation();
    cache.clearCacheByPrefix("");
    const second = generation();
    cache.clearCacheByPrefix("");
    write("kpi:report", "current", 60_000, generation());
    write("kpi:report", "first", 60_000, first);
    write("kpi:report", "second", 60_000, second);
    expect(cache.getCache("kpi:report")).toBe("current");
  });
});
