import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { node: { findMany: mocks.findMany } } }));

type NodeCoordinates = { name: string; latitude: number | null; longitude: number | null };
let nearest: typeof import("@/lib/nodeUtils");
const origin = Date.parse("2026-10-29T00:00:00.000Z");
const ttl = 5 * 60 * 1000;
const nodes: NodeCoordinates[] = [
  { name: "synthetic-west", latitude: 10, longitude: 106 },
  { name: "synthetic-east", latitude: 10, longitude: 108 },
];
const row = (name: string): NodeCoordinates[] => [{ name, latitude: 10, longitude: 106 }];

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(origin);
  mocks.findMany.mockReset().mockResolvedValue(nodes);
  nearest = await import("@/lib/nodeUtils");
});

afterEach(() => { vi.useRealTimers(); });

describe("nearest-node coordinate cache", () => {
  it.each([1, 10, 100])("shares one cold read across %i callers and computes each caller's nearest node", async (count) => {
    const pending = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValue(pending.promise);
    const reads = Array.from({ length: count }, (_value, index) => nearest.findNearestNodeName(10, index % 2 === 0 ? 106 : 108));
    pending.resolve(nodes);
    expect(await Promise.all(reads)).toEqual(Array.from({ length: count }, (_value, index) => index % 2 === 0 ? "synthetic-west" : "synthetic-east"));
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the coordinate projection and warm-cache behavior unchanged", async () => {
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-west");
    expect(await nearest.findNearestNodeName(10, 108)).toBe("synthetic-east");
    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({ select: { name: true, latitude: true, longitude: true } });
  });

  it("hits at the original expiry boundary and shares the first expired refresh", async () => {
    await nearest.findNearestNodeName(10, 106);
    vi.setSystemTime(origin + ttl);
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-west");
    vi.setSystemTime(origin + ttl + 1);
    mocks.findMany.mockResolvedValue(row("synthetic-refreshed"));
    expect(await Promise.all(Array.from({ length: 3 }, () => nearest.findNearestNodeName(10, 106))))
      .toEqual(Array(3).fill("synthetic-refreshed"));
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("starts the five-minute TTL at successful completion rather than request entry", async () => {
    const pending = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValueOnce(pending.promise);
    const read = nearest.findNearestNodeName(10, 106);
    vi.setSystemTime(origin + 120000);
    pending.resolve(nodes);
    await read;
    vi.setSystemTime(origin + 120000 + ttl);
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-west");
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    vi.setSystemTime(origin + 120000 + ttl + 1);
    await nearest.findNearestNodeName(10, 106);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("caches an empty snapshot instead of treating it as another miss", async () => {
    mocks.findMany.mockResolvedValue([]);
    expect(await nearest.findNearestNodeName(10, 106)).toBeNull();
    expect(await nearest.findNearestNodeName(10, 106)).toBeNull();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("ignores incomplete coordinates, keeps zero coordinates and preserves the first equal-distance row", async () => {
    mocks.findMany.mockResolvedValue([
      { name: "synthetic-no-lat", latitude: null, longitude: 0 },
      { name: "synthetic-no-lng", latitude: 0, longitude: null },
      { name: "synthetic-first", latitude: 0, longitude: 0 },
      { name: "synthetic-second", latitude: 0, longitude: 0 },
    ]);
    expect(await nearest.findNearestNodeName(0, 0)).toBe("synthetic-first");
  });

  it("returns null when every node lacks a complete coordinate pair", async () => {
    mocks.findMany.mockResolvedValue([{ name: "synthetic-no-coordinate", latitude: null, longitude: null }]);
    expect(await nearest.findNearestNodeName(10, 106)).toBeNull();
  });

  it("propagates a shared failure to every caller without caching it", async () => {
    const pending = deferred<NodeCoordinates[]>();
    const failure = new Error("synthetic read failure");
    mocks.findMany.mockReturnValue(pending.promise);
    const outcomes = Promise.allSettled([nearest.findNearestNodeName(10, 106), nearest.findNearestNodeName(10, 108)]);
    pending.reject(failure);
    expect(await outcomes).toEqual([{ status: "rejected", reason: failure }, { status: "rejected", reason: failure }]);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed load and shares the retry instead of retaining a rejected promise", async () => {
    const failure = new Error("synthetic retryable failure");
    mocks.findMany.mockRejectedValueOnce(failure);
    await expect(nearest.findNearestNodeName(10, 106)).rejects.toBe(failure);
    expect(await Promise.all(Array.from({ length: 3 }, () => nearest.findNearestNodeName(10, 106))))
      .toEqual(Array(3).fill("synthetic-west"));
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not poison later reads if the database call throws synchronously", async () => {
    const failure = new Error("synthetic synchronous failure");
    mocks.findMany.mockImplementationOnce(() => { throw failure; });
    await expect(nearest.findNearestNodeName(10, 106)).rejects.toBe(failure);
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-west");
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("invalidates a settled snapshot immediately", async () => {
    await nearest.findNearestNodeName(10, 106);
    mocks.findMany.mockResolvedValue(row("synthetic-new"));
    nearest.invalidateNearestNodeCache();
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-new");
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not republish a read invalidated before it completes", async () => {
    const pending = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValueOnce(pending.promise).mockResolvedValue(row("synthetic-new"));
    const oldRead = nearest.findNearestNodeName(10, 106);
    nearest.invalidateNearestNodeCache();
    pending.resolve(row("synthetic-old"));
    expect(await oldRead).toBe("synthetic-old");
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-new");
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite a newer settled snapshot with a late old response", async () => {
    const pending = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValueOnce(pending.promise).mockResolvedValue(row("synthetic-new"));
    const oldRead = nearest.findNearestNodeName(10, 106);
    nearest.invalidateNearestNodeCache();
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-new");
    pending.resolve(row("synthetic-old"));
    expect(await oldRead).toBe("synthetic-old");
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-new");
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"])("an old load's %s cannot clear or replace a new generation's pending load", async (settlement) => {
    const oldPending = deferred<NodeCoordinates[]>();
    const newPending = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValueOnce(oldPending.promise).mockReturnValueOnce(newPending.promise).mockResolvedValue(row("synthetic-unexpected-third-read"));
    const oldOutcome = Promise.allSettled([nearest.findNearestNodeName(10, 106)]);
    nearest.invalidateNearestNodeCache();
    const newRead = nearest.findNearestNodeName(10, 106);
    const failure = new Error("synthetic old-generation failure");
    if (settlement === "resolve") oldPending.resolve(row("synthetic-old"));
    else oldPending.reject(failure);
    const result = await oldOutcome;
    const joinedRead = nearest.findNearestNodeName(10, 106);
    newPending.resolve(row("synthetic-new"));
    expect(await Promise.all([newRead, joinedRead])).toEqual(["synthetic-new", "synthetic-new"]);
    expect(result).toEqual(settlement === "resolve" ? [{ status: "fulfilled", value: "synthetic-old" }] : [{ status: "rejected", reason: failure }]);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-new");
  });

  it("keeps only the current generation cache after multiple invalidations and reverse completions", async () => {
    const first = deferred<NodeCoordinates[]>();
    const second = deferred<NodeCoordinates[]>();
    const third = deferred<NodeCoordinates[]>();
    mocks.findMany.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const firstRead = nearest.findNearestNodeName(10, 106);
    nearest.invalidateNearestNodeCache();
    const secondRead = nearest.findNearestNodeName(10, 106);
    nearest.invalidateNearestNodeCache();
    const thirdRead = nearest.findNearestNodeName(10, 106);
    third.resolve(row("synthetic-third"));
    expect(await thirdRead).toBe("synthetic-third");
    second.resolve(row("synthetic-second"));
    expect(await secondRead).toBe("synthetic-second");
    first.resolve(row("synthetic-first"));
    expect(await firstRead).toBe("synthetic-first");
    expect(await nearest.findNearestNodeName(10, 106)).toBe("synthetic-third");
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
  });
});
