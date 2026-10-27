import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  checkAndPurgeExpired: vi.fn(),
  countRecords: vi.fn(),
  getArchiveStatus: vi.fn(),
  getArchiveExportReadiness: vi.fn(),
  canArchiveMonth: vi.fn(),
  exportMonthToExcel: vi.fn(),
  recordArchiveExport: vi.fn(),
  upsertArchiveConfirmation: vi.fn(),
  cancelArchiveConfirmation: vi.fn(),
  purgeMonthData: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/archive", () => mocks);
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: mocks.query } }));

import * as statusRoute from "@/app/api/archive/status/route";
import * as exportRoute from "@/app/api/archive/export/route";
import * as confirmRoute from "@/app/api/archive/confirm/route";
import * as cancelRoute from "@/app/api/archive/cancel/route";
import * as purgeRoute from "@/app/api/archive/purge/route";
import * as cronRoute from "@/app/api/archive/cron/route";

type Route = { POST?: (request: Request) => Promise<Response> };

const month = "2026-08";
const exportLog = {
  id: 1,
  archiveMonth: month,
  exportedBy: "fixture-admin",
  exportedAt: "2026-09-01 00:00:00",
  fileName: `archive_kpi_cuoc_${month}.xlsx`,
};
const archive = { archiveMonth: month, purgeAfter: "2000-01-01 00:00:00", purgedAt: null };

function makeRequest(path: string, method = "POST", body: object = { month }) {
  return new Request(`http://localhost/api/archive/${path}?month=${month}`, {
    method,
    ...(method === "POST" ? {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : {}),
  });
}

function expectNoMutation() {
  for (const mutation of [
    mocks.checkAndPurgeExpired,
    mocks.exportMonthToExcel,
    mocks.recordArchiveExport,
    mocks.upsertArchiveConfirmation,
    mocks.cancelArchiveConfirmation,
    mocks.purgeMonthData,
  ]) {
    expect(mutation).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
  mocks.checkAndPurgeExpired.mockResolvedValue(2);
  mocks.countRecords.mockResolvedValue({ kpiCount: 1, cuocCount: 1 });
  mocks.getArchiveStatus.mockResolvedValue(archive);
  mocks.getArchiveExportReadiness.mockResolvedValue({
    ok: true, reason: null, exportLog, latestDataAt: "2026-08-31 00:00:00",
  });
  mocks.canArchiveMonth.mockReturnValue(true);
  mocks.exportMonthToExcel.mockResolvedValue({ buffer: Buffer.from("fixture-xlsx"), fileName: exportLog.fileName });
  mocks.recordArchiveExport.mockResolvedValue(exportLog);
  mocks.upsertArchiveConfirmation.mockResolvedValue(archive);
  mocks.cancelArchiveConfirmation.mockResolvedValue(true);
  mocks.purgeMonthData.mockResolvedValue(true);
  mocks.query.mockResolvedValue([{ archiveMonth: month }, { archiveMonth: "2026-07" }]);
  vi.stubEnv("CRON_SECRET", "fixture-cron-secret");
  vi.stubEnv("ARCHIVE_CRON_SECRET", "fixture-archive-secret");
});

afterEach(() => vi.unstubAllEnvs());

describe("archive read and authorization safety", () => {
  it("GET status only reads even when an archive is overdue", async () => {
    const response = await statusRoute.GET(makeRequest("status", "GET"));
    expect(response.status).toBe(200);
    expect((await response.json()).archive.purgeAfter).toBe(archive.purgeAfter);
    expectNoMutation();
  });

  it.each([null, "CTV", "MANAGER"])("denied role %s cannot mutate through status", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    const response = await statusRoute.GET(makeRequest("status", "GET"));
    expect([401, 403]).toContain(response.status);
    expect(mocks.getArchiveStatus).not.toHaveBeenCalled();
    expectNoMutation();
  });

  it.each([null, "CTV", "MANAGER", "ADMIN"])("legacy export GET is write-free 405 for %s", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    const response = await exportRoute.GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expectNoMutation();
  });

  for (const [path, route] of [
    ["export", exportRoute], ["confirm", confirmRoute], ["cancel", cancelRoute], ["purge", purgeRoute],
  ] as Array<[string, Route]>) {
    it.each([null, "CTV", "MANAGER"])(`denied role %s cannot mutate through ${path} POST`, async (role) => {
      mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
      expect(route.POST).toBeTypeOf("function");
      const response = await route.POST!(makeRequest(path));
      expect([401, 403]).toContain(response.status);
      expect(mocks.query).not.toHaveBeenCalled();
      expect(mocks.getArchiveStatus).not.toHaveBeenCalled();
      expectNoMutation();
    });
  }

  it.each([
    ["confirm", confirmRoute], ["cancel", cancelRoute], ["purge", purgeRoute],
  ] as Array<[string, Route]>)("authorized %s never launches unrelated auto-purge", async (path, route) => {
    const response = await route.POST!(makeRequest(path));
    expect(response.status).toBe(200);
    expect(mocks.checkAndPurgeExpired).not.toHaveBeenCalled();
  });
});

describe("archive export and confirmation contract", () => {
  it("ADMIN POST generates the workbook before recording the successful export", async () => {
    const handler = (exportRoute as Route).POST;
    expect(handler).toBeTypeOf("function");
    const response = await handler!(makeRequest("export"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(exportLog.fileName);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(await response.text()).toBe("fixture-xlsx");
    expect(mocks.recordArchiveExport).toHaveBeenCalledWith(month, "fixture-admin", exportLog.fileName);
    expect(mocks.exportMonthToExcel.mock.invocationCallOrder[0]).toBeLessThan(mocks.recordArchiveExport.mock.invocationCallOrder[0]);
    expect(mocks.checkAndPurgeExpired).not.toHaveBeenCalled();
  });

  it("failed generation cannot record a successful export", async () => {
    mocks.exportMonthToExcel.mockRejectedValue(new Error("fixture generation failure"));
    const handler = (exportRoute as Route).POST;
    expect(handler).toBeTypeOf("function");
    expect((await handler!(makeRequest("export"))).status).toBe(500);
    expect(mocks.recordArchiveExport).not.toHaveBeenCalled();
  });

  it("an export-log failure cannot return a successful download", async () => {
    mocks.recordArchiveExport.mockRejectedValue(new Error("fixture log failure"));
    const handler = (exportRoute as Route).POST;
    expect(handler).toBeTypeOf("function");
    expect((await handler!(makeRequest("export"))).status).toBe(500);
  });

  it.each(["no_data", "no_export", "stale_export"])("confirmation rejects %s", async (reason) => {
    mocks.getArchiveExportReadiness.mockResolvedValue({ ok: false, reason, exportLog: null });
    expect((await confirmRoute.POST(makeRequest("confirm"))).status).toBe(400);
    expect(mocks.upsertArchiveConfirmation).not.toHaveBeenCalled();
  });

  it("confirmation fails closed when readiness lookup errors", async () => {
    mocks.getArchiveExportReadiness.mockRejectedValue(new Error("fixture read failure"));
    expect((await confirmRoute.POST(makeRequest("confirm"))).status).toBe(500);
    expect(mocks.upsertArchiveConfirmation).not.toHaveBeenCalled();
  });

  it("a fresh export allows confirmation with the recorded filename", async () => {
    expect((await confirmRoute.POST(makeRequest("confirm"))).status).toBe(200);
    expect(mocks.upsertArchiveConfirmation).toHaveBeenCalledWith(month, "fixture-admin", exportLog.fileName);
  });

  it("the existing UI export caller explicitly uses POST", () => {
    const source = readFileSync(new URL("../../src/app/(dashboard)/archive/page.tsx", import.meta.url), "utf8");
    const exportHandler = source.slice(source.indexOf("const handleExport"), source.indexOf("const handleArchiveAction"));
    expect(exportHandler).toMatch(/fetch\([\s\S]*?\/api\/archive\/export[\s\S]*?method:\s*"POST"/);
  });
});

describe("purge results", () => {
  it("cancellation does not report success when a purge has already claimed the archive", async () => {
    mocks.cancelArchiveConfirmation.mockResolvedValue(false);
    const response = await cancelRoute.POST(makeRequest("cancel"));
    expect((await response.json()).cancelled).toBe(false);
  });

  it("manual purge passes an explicit expiry bypass", async () => {
    const response = await purgeRoute.POST(makeRequest("purge"));
    expect(await response.json()).toEqual({ month, purged: true });
    expect(mocks.purgeMonthData).toHaveBeenCalledWith(month, { requireExpired: false });
  });

  it("manual purge reports false when another worker or cancel wins the claim", async () => {
    mocks.purgeMonthData.mockResolvedValue(false);
    const response = await purgeRoute.POST(makeRequest("purge"));
    expect((await response.json()).purged).toBe(false);
  });

  it("bulk purge returns only months actually claimed and purged", async () => {
    mocks.purgeMonthData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const response = await purgeRoute.POST(makeRequest("purge", "POST", {}));
    expect(await response.json()).toEqual({ purgedMonths: ["2026-07"], count: 1 });
    expect(mocks.purgeMonthData).toHaveBeenCalledWith(month);
    expect(mocks.purgeMonthData).toHaveBeenCalledWith("2026-07");
  });
});

describe("authenticated scheduler remains functional", () => {
  const schedulerHeaders: Array<Record<string, string>> = [
    { authorization: "Bearer fixture-cron-secret" },
    { "x-archive-cron-secret": "fixture-archive-secret" },
    { "x-cron-secret": "fixture-cron-secret" },
  ];
  for (const method of ["GET", "POST"] as const) {
    it.each([undefined, "wrong-fixture-secret"])(`${method} with invalid secret %s performs no purge`, async (secret) => {
      const response = await cronRoute[method](new Request("http://localhost/api/archive/cron", {
        method, headers: secret ? { authorization: `Bearer ${secret}` } : {},
      }));
      expect(response.status).toBe(401);
      expectNoMutation();
    });

    it.each(schedulerHeaders)(`${method} with a valid fixture scheduler secret runs purge`, async (headers) => {
      const response = await cronRoute[method](new Request("http://localhost/api/archive/cron", { method, headers }));
      expect(await response.json()).toEqual({ purgedCount: 2 });
      expect(mocks.checkAndPurgeExpired).toHaveBeenCalledTimes(1);
    });

    it(`${method} with no configured secrets remains denied`, async () => {
      vi.stubEnv("CRON_SECRET", "");
      vi.stubEnv("ARCHIVE_CRON_SECRET", "");
      const response = await cronRoute[method](new Request("http://localhost/api/archive/cron", { method }));
      expect(response.status).toBe(401);
      expectNoMutation();
    });
  }
});
