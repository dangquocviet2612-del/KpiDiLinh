import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  ensureKpiTables: vi.fn(),
  getAccessibleCtvCodes: vi.fn(),
  getCache: vi.fn(),
  cacheGeneration: Symbol("cache-generation"),
  setCache: vi.fn(),
  getCuocTargetRatePercent: vi.fn(),
  getLatestCuocCompletionForCtv: vi.fn(),
  getLatestKpiReportDate: vi.fn(),
  getLatestKpiReportDateForCtv: vi.fn(),
  getLatestCuocReportDate: vi.fn(),
  getScopedPrepaidCtvUsers: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: mocks.query } }));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: mocks.ensureKpiTables }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: mocks.getAccessibleCtvCodes }));
vi.mock("@/lib/kpi-cache", () => ({ getCache: mocks.getCache, getCacheGeneration: () => mocks.cacheGeneration, setCache: mocks.setCache }));
vi.mock("@/lib/prepaid-query", () => mocks);

import { GET as reportGet } from "@/app/api/kpi/report/route";
import { GET as summaryGet } from "@/app/api/kpi/summary/route";
import { ServerTiming, type ServerTimingPhase } from "@/lib/server-timing";

const reportDate = "2026-10-25";
const ctvUser = "fixture-ctv";
const group = "fixture-group";
const emptyReport = { rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 };
const emptySummary = { reportDate: null, indicators: [], rows: [] };
const routes = [["report", reportGet], ["summary", summaryGet]] as const;
let clock = 0;

function request(route: string, params: Record<string, string> = {}) {
  return new Request(`http://localhost/api/kpi/${route}?${new URLSearchParams(params)}`);
}

function expectTiming(response: Response, phases: string[] = []) {
  const header = response.headers.get("Server-Timing");
  expect(header).not.toBeNull();
  for (const metric of header!.split(", ")) {
    expect(metric).toMatch(/^(auth|schema|scope|date|query|compute|serialize|total|cache);dur=\d+\.\d{2}(;desc="(hit|miss)")?$/);
  }
  for (const phase of ["auth", "serialize", "total", ...phases]) {
    expect(header).toMatch(new RegExp(`(?:^|, )${phase};dur=`));
  }
  return header!;
}

beforeEach(() => {
  vi.resetAllMocks();
  clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock++);
  mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
  mocks.ensureKpiTables.mockResolvedValue(undefined);
  mocks.getAccessibleCtvCodes.mockResolvedValue([ctvUser]);
  mocks.getCache.mockReturnValue(null);
  mocks.getLatestKpiReportDate.mockResolvedValue(reportDate);
  mocks.getLatestKpiReportDateForCtv.mockResolvedValue(reportDate);
  mocks.getLatestCuocReportDate.mockResolvedValue("2026-10-24");
  mocks.getScopedPrepaidCtvUsers.mockResolvedValue([ctvUser]);
  mocks.getCuocTargetRatePercent.mockResolvedValue(97);
  mocks.getLatestCuocCompletionForCtv.mockResolvedValue(98);
  mocks.query.mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe("ServerTiming with a deterministic clock", () => {
  it("records synchronous and asynchronous durations and total elapsed time", async () => {
    let now = 100;
    const timing = new ServerTiming(() => now);
    expect(timing.measureSync("auth", () => { now += 2.25; return 42; })).toBe(42);
    expect(await timing.measure("schema", async () => { now += 3.5; return "ready"; })).toBe("ready");
    now += 1;
    expect(timing.toHeader()).toBe("auth;dur=2.25, schema;dur=3.50, total;dur=6.75");
  });

  it("accumulates repeated phases without rounding each measurement", () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    timing.measureSync("query", () => { now += 0.004; });
    timing.measureSync("query", () => { now += 0.004; });
    expect(timing.toHeader()).toBe("query;dur=0.01, total;dur=0.01");
  });

  it("keeps overlapping async measurements independent and total wall-clock based", async () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const firstOperation = new Promise<string>((resolve) => { resolveFirst = resolve; });
    const secondOperation = new Promise<string>((resolve) => { resolveSecond = resolve; });
    const first = timing.measure("query", () => firstOperation);
    now = 3;
    const second = timing.measure("query", () => secondOperation);
    now = 7;
    resolveFirst("first");
    expect(await first).toBe("first");
    now = 12;
    resolveSecond("second");
    expect(await second).toBe("second");
    expect(timing.toHeader()).toBe("query;dur=16.00, total;dur=12.00");
  });

  it("records async rejections in finally and preserves the original error", async () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    const failure = new Error("fixture-token\r\nX-Secret: fixture-account");
    await expect(timing.measure("query", async () => { now = 9; throw failure; })).rejects.toBe(failure);
    expect(timing.toHeader()).toBe("query;dur=9.00, total;dur=9.00");
  });

  it("records synchronous exceptions in finally", () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    const failure = new Error("fixture-compute-error");
    expect(() => timing.measureSync("compute", () => { now = 4; throw failure; })).toThrow(failure);
    expect(timing.toHeader()).toBe("compute;dur=4.00, total;dur=4.00");
  });

  it("records a synchronous throw from an async operation", async () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    const failure = new Error("fixture-query-error");
    await expect(timing.measure("query", () => { now = 6; throw failure; })).rejects.toBe(failure);
    expect(timing.toHeader()).toBe("query;dur=6.00, total;dur=6.00");
  });

  it.each(["auth", "schema", "scope", "date", "query", "compute", "serialize", "cache"] as const)("accepts the fixed %s label", (phase) => {
    const timing = new ServerTiming(() => 0);
    timing.measureSync(phase, () => undefined);
    expect(timing.toHeader()).toContain(`${phase};dur=0.00`);
  });

  it.each(["sql", "fixture-user", "query;desc=fixture-token", "query, auth", "query\r\nX-Secret: injected", "__proto__", "toString", ""])("rejects unsafe label %j before running work", async (label) => {
    const timing = new ServerTiming(() => 0);
    const operation = vi.fn();
    expect(() => timing.measureSync(label as ServerTimingPhase, operation)).toThrow("Invalid Server-Timing phase");
    await expect(timing.measure(label as ServerTimingPhase, operation)).rejects.toThrow("Invalid Server-Timing phase");
    expect(operation).not.toHaveBeenCalled();
    expect(timing.toHeader()).toBe("total;dur=0.00");
  });

  it.each(["hit", "miss"] as const)("only emits a fixed cache %s description", (status) => {
    const timing = new ServerTiming(() => 0);
    timing.measureSync("cache", () => undefined);
    timing.setCacheStatus(status);
    expect(timing.toHeader()).toBe(`total;dur=0.00, cache;dur=0.00;desc="${status}"`);
  });

  it.each(["fixture-cache-key", 'hit";desc="fixture-token', "hit\r\nX-Secret: injected"])("rejects unsafe cache description %j", (status) => {
    const timing = new ServerTiming(() => 0);
    expect(() => timing.setCacheStatus(status as "hit")).toThrow("Invalid Server-Timing cache status");
    expect(timing.toHeader()).toBe("total;dur=0.00");
  });

  it("does not emit negative or non-finite durations", () => {
    let now = 10;
    const timing = new ServerTiming(() => now);
    timing.measureSync("auth", () => { now = 5; });
    timing.measureSync("query", () => { now = Number.NaN; });
    expect(timing.toHeader()).toBe("auth;dur=0.00, total;dur=0.00");
  });

  it("keeps request timing instances isolated", () => {
    let now = 0;
    const first = new ServerTiming(() => now);
    const second = new ServerTiming(() => now);
    first.measureSync("query", () => { now = 3; });
    expect(first.toHeader()).toBe("query;dur=3.00, total;dur=3.00");
    expect(second.toHeader()).toBe("total;dur=3.00");
  });

  it("attaches timing without replacing status, body or existing response headers", async () => {
    const timing = new ServerTiming(() => 0);
    const response = new Response('{"fixture":true}', { status: 403, headers: { "Cache-Control": "private", "Content-Type": "application/json" } });
    expect(timing.applyTo(response)).toBe(response);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ fixture: true });
    expect(response.headers.get("Cache-Control")).toBe("private");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Server-Timing")).toBe("total;dur=0.00");
  });
});

describe.each(routes)("%s GET Server-Timing", (route, handler) => {
  it("times unauthenticated responses without changing their body or status", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await handler(request(route));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Bạn chưa đăng nhập" });
    expectTiming(response);
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
  });

  it.each([
    ["auth", "auth"],
    ["schema", "ensureKpiTables"],
    ["scope", "getAccessibleCtvCodes"],
    ["date", "getLatestKpiReportDate"],
    ["query", "query"],
  ] as const)("times rejected %s work through the error response", async (phase, dependency) => {
    mocks[dependency].mockImplementation(async () => {
      clock += 7;
      throw new Error("fixture-error-token\r\nX-Private: fixture-account");
    });
    const response = await handler(request(route));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fixture-error-token\r\nX-Private: fixture-account" });
    expectTiming(response, [phase]);
    expect(response.headers.get("X-Private")).toBeNull();
    expect(response.headers.get("Server-Timing")).toContain(`${phase};dur=8.00`);
  });

  it("distinguishes cache hits without exposing the private cache key", async () => {
    const payload = { reportDate, rows: [{ ctvUser }], selectedGroup: group };
    mocks.getCache.mockReturnValue(payload);
    const response = await handler(request(route, { ctvUser, group, managerCode: "fixture-manager", reportDate }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(expectTiming(response, ["schema", "scope", "cache"])).toMatch(/cache;dur=\d+\.\d{2};desc="hit"/);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.setCache).not.toHaveBeenCalled();
  });
});

describe("report GET response and cache semantics", () => {
  it("keeps manager scope denial intact", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-manager", role: "MANAGER" } });
    const response = await reportGet(request("report", { ctvUser: "outside-scope" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "CTV không thuộc quyền quản lý" });
    expectTiming(response, ["scope"]);
    expect(mocks.getCache).not.toHaveBeenCalled();
  });

  it("times an empty manager scope without querying", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-manager", role: "MANAGER" } });
    mocks.getAccessibleCtvCodes.mockResolvedValue([]);
    const response = await reportGet(request("report"));
    expect(await response.json()).toEqual(emptyReport);
    expectTiming(response);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("times missing dates and records a cache miss", async () => {
    mocks.getLatestKpiReportDate.mockResolvedValue("");
    const response = await reportGet(request("report"));
    expect(await response.json()).toEqual(emptyReport);
    expect(expectTiming(response, ["date"])).toContain('desc="miss"');
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("preserves CTV selection, query arguments, scores, cache key and TTL", async () => {
    mocks.auth.mockResolvedValue({ user: { name: ctvUser, role: "CTV" } });
    mocks.query.mockResolvedValue([{ ctvUser, kpiCode: "FIXTURE", khThang: 10, thLuyKe: 8, completionPercent: 80 }]);
    const response = await reportGet(request("report", { ctvUser: "ignored-ctv" }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ reportDate, totalBaseScore: 10, totalMaxScore: 12, totalAchievedScore: 8 });
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0]).toMatchObject({ ctvUser, kpiCode: "FIXTURE", achievedScore: 8 });
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([ctvUser, reportDate, ctvUser]);
    expect(mocks.getCache).toHaveBeenCalledWith(`kpi:report|CTV|${ctvUser}|${ctvUser}|`);
    expect(mocks.setCache).toHaveBeenCalledWith(`kpi:report|CTV|${ctvUser}|${ctvUser}|`, payload, 60_000, mocks.cacheGeneration);
    expect(expectTiming(response, ["date", "query", "compute", "cache"])).toContain('desc="miss"');
  });
});

describe("summary GET response and cache semantics", () => {
  it("keeps CTV role denial intact", async () => {
    mocks.auth.mockResolvedValue({ user: { name: ctvUser, role: "CTV" } });
    const response = await summaryGet(request("summary"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Bạn không có quyền truy cập tổng hợp KPI" });
    expectTiming(response);
    expect(mocks.ensureKpiTables).not.toHaveBeenCalled();
  });

  it("times an empty manager scope without querying", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-manager", role: "MANAGER" } });
    mocks.getAccessibleCtvCodes.mockResolvedValue([]);
    const response = await summaryGet(request("summary"));
    expect(await response.json()).toEqual(emptySummary);
    expectTiming(response, ["scope"]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("times a missing date without looking up the cache", async () => {
    mocks.getLatestKpiReportDate.mockResolvedValue("");
    const response = await summaryGet(request("summary"));
    expect(await response.json()).toEqual(emptySummary);
    expectTiming(response, ["date"]);
    expect(mocks.getCache).not.toHaveBeenCalled();
  });

  it.each(["users", "indicators"])("times the empty %s branch and preserves its cached payload", async (branch) => {
    if (branch === "users") mocks.getScopedPrepaidCtvUsers.mockResolvedValue([]);
    const response = await summaryGet(request("summary"));
    const payload = await response.json();
    expect(payload).toEqual({ reportDate, indicators: [], rows: [], isNegativeGroup: false, maxPercent: 120, ...(branch === "indicators" ? { selectedGroup: "" } : {}) });
    expect(expectTiming(response, ["cache"])).toContain('desc="miss"');
    expect(mocks.setCache).toHaveBeenCalledWith(`kpi:summary|ADMIN|fixture-admin|${reportDate}|||admin`, payload, 60_000, mocks.cacheGeneration);
  });

  it("preserves negative-group math, query arguments and manager cache scope", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-manager", role: "MANAGER" } });
    mocks.query.mockResolvedValueOnce([{ name: group, sortOrder: 0, kpiCode: "RM_FTTH_ALL", maxPercent: 120, isNegative: 1 }])
      .mockResolvedValueOnce([{ ctvUser, kh: 10, th: 12 }]);
    const response = await summaryGet(request("summary", { group, managerCode: "ignored-manager" }));
    const payload = await response.json();
    expect(payload).toEqual({ reportDate, indicators: [group], rows: [{ ctvUser, kh: 10, th: 12, percent: 80, thieu: 2 }], isNegativeGroup: true, maxPercent: 120, selectedGroup: group });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([]);
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([reportDate, group, ctvUser]);
    const cacheKey = `kpi:summary|MANAGER|fixture-manager|${reportDate}|${group}|ignored-manager|${ctvUser}`;
    expect(mocks.getCache).toHaveBeenCalledWith(cacheKey);
    expect(mocks.setCache).toHaveBeenCalledWith(cacheKey, payload, 60_000, mocks.cacheGeneration);
    expectTiming(response, ["date", "query", "compute", "cache"]);
  });

  it("preserves the Cuoc fallback date and N1-N3 formula", async () => {
    const cuocGroup = "CUOC_N1_N3_RATE";
    mocks.query.mockResolvedValueOnce([{ name: cuocGroup, sortOrder: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ctvUser, completionPercent: 98 }]);
    const response = await summaryGet(request("summary", { group: cuocGroup, reportDate }));
    const payload = await response.json();
    expect(payload).toEqual({ reportDate: "2026-10-24", indicators: [cuocGroup], rows: [{ ctvUser, kh: 97, th: 98, percent: 108.2, thieu: 0 }], isNegativeGroup: false, maxPercent: 120, selectedGroup: cuocGroup });
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([reportDate, ctvUser]);
    expect(mocks.query.mock.calls[2].slice(1)).toEqual(["2026-10-24", ctvUser]);
    expect(mocks.setCache).toHaveBeenCalledWith(`kpi:summary|ADMIN|fixture-admin|${reportDate}|${cuocGroup}||admin`, payload, 60_000, mocks.cacheGeneration);
    expectTiming(response, ["date", "query", "compute", "cache"]);
  });
});
