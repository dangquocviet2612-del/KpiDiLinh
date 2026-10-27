import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: vi.fn(),
  ensure: vi.fn(),
  scope: vi.fn(),
  query: vi.fn(),
  target: vi.fn(),
  completion: vi.fn(),
  latest: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: state.query } }));
vi.mock("@/lib/kpi-db", () => ({ ensureKpiTables: state.ensure }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: state.scope }));
vi.mock("@/lib/kpi-cache", () => ({ getCache: () => null, setCache: vi.fn() }));
vi.mock("@/lib/prepaid-query", () => ({
  getCuocTargetRatePercent: state.target,
  getLatestCuocCompletionForCtv: state.completion,
  getLatestKpiReportDate: state.latest,
  getLatestKpiReportDateForCtv: state.latest,
  getLatestCuocReportDate: vi.fn().mockResolvedValue("2026-10-25"),
  getScopedPrepaidCtvUsers: vi.fn().mockResolvedValue(["CTV_A"]),
}));

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function request(path: string) {
  return new Request(`http://localhost/api/kpi/${path}`);
}

const metadata = {
  name: "Growth", sortOrder: 1, kpiCode: "GROWTH", displayName: "Growth",
  kpiName: "Growth", mergeGroup: null, maxPercent: 120, isNegative: 0,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.auth.mockResolvedValue({ user: { id: "synthetic-admin", name: "admin", role: "ADMIN" } });
  state.ensure.mockResolvedValue(undefined);
  state.scope.mockResolvedValue(null);
  state.latest.mockResolvedValue("2026-10-25");
  state.target.mockResolvedValue(91.2);
  state.completion.mockResolvedValue(97);
  state.query.mockResolvedValue([]);
});

describe("KPI request query scheduling", () => {
  it("starts report rows, target and latest cuoc together after readiness and scope", async () => {
    const rows = deferred<unknown[]>();
    state.query.mockReturnValue(rows.promise);
    const { GET } = await import("@/app/api/kpi/report/route");
    const response = GET(request("report?ctvUser=CTV_A&reportDate=2026-10-25"));
    try {
      await vi.waitFor(() => {
        expect(state.query).toHaveBeenCalledOnce();
        expect(state.target).toHaveBeenCalledOnce();
        expect(state.completion).toHaveBeenCalledWith("CTV_A");
      }, { timeout: 1500 });
      expect(state.scope).toHaveBeenCalledOnce();
      expect(state.ensure).toHaveBeenCalledOnce();
    } finally {
      rows.resolve([]);
      await response;
    }
  });

  it("reads summary indicators and selected group metadata in one database call", async () => {
    state.query.mockImplementation(async (sql: string) => sql.includes('FROM "KpiDailyResult"')
      ? [{ ctvUser: "CTV_A", kh: 10, th: 8 }]
      : [metadata]);
    const { GET } = await import("@/app/api/kpi/summary/route");
    const response = await GET(request("summary?group=Growth&reportDate=2026-10-25"));
    expect(response.status).toBe(200);
    expect((await response.json()).rows).toEqual([{ ctvUser: "CTV_A", kh: 10, th: 8, percent: 80, thieu: 2 }]);
    const metadataCalls = state.query.mock.calls.filter(([sql]) => !String(sql).includes('FROM "KpiDailyResult"'));
    expect(metadataCalls).toHaveLength(1);
    expect(state.query).toHaveBeenCalledTimes(2);
  });

  it("loads same-date cuoc rows while the independent target lookup is pending", async () => {
    const target = deferred<number>();
    state.target.mockReturnValue(target.promise);
    state.query.mockImplementation(async (sql: string) => sql.includes('FROM "CuocDailyResult"')
      ? [{ ctvUser: "CTV_A", completionPercent: 95.54 }]
      : [{ ...metadata, name: "CUOC_N1_N3_RATE" }]);
    const { GET } = await import("@/app/api/kpi/summary/route");
    const response = GET(request("summary?group=CUOC_N1_N3_RATE&reportDate=2026-10-25"));
    try {
      await vi.waitFor(() => {
        expect(state.query.mock.calls.some(([sql]) => String(sql).includes('FROM "CuocDailyResult"'))).toBe(true);
      }, { timeout: 1500 });
    } finally {
      target.resolve(91.2);
      await response;
    }
  });

  it("does not prefetch cuoc when no KPI date can be resolved", async () => {
    state.latest.mockResolvedValue("");
    const { GET } = await import("@/app/api/kpi/report/route");
    const response = await GET(request("report?ctvUser=CTV_A"));
    expect(response.status).toBe(200);
    expect((await response.json()).reportDate).toBeNull();
    expect(state.query).not.toHaveBeenCalled();
    expect(state.target).not.toHaveBeenCalled();
    expect(state.completion).not.toHaveBeenCalled();
  });

  it("does not start report data queries before the manager scope resolves", async () => {
    const scope = deferred<string[]>();
    state.auth.mockResolvedValue({ user: { name: "MANAGER_A", role: "MANAGER" } });
    state.scope.mockReturnValue(scope.promise);
    const { GET } = await import("@/app/api/kpi/report/route");
    const response = GET(request("report?ctvUser=OUTSIDER&reportDate=2026-10-25"));
    await vi.waitFor(() => expect(state.scope).toHaveBeenCalledOnce());
    expect(state.query).not.toHaveBeenCalled();
    expect(state.target).not.toHaveBeenCalled();
    scope.resolve(["CTV_A"]);
    expect((await response).status).toBe(403);
    expect(state.query).not.toHaveBeenCalled();
    expect(state.completion).not.toHaveBeenCalled();
  });

  it.each(["report", "summary"])("does no schema or private reads for anonymous %s", async (route) => {
    state.auth.mockResolvedValue(null);
    const { GET } = route === "report" ? await import("@/app/api/kpi/report/route") : await import("@/app/api/kpi/summary/route");
    expect((await GET(request(route))).status).toBe(401);
    expect(state.ensure).not.toHaveBeenCalled();
    expect(state.query).not.toHaveBeenCalled();
    expect(state.target).not.toHaveBeenCalled();
  });
});
