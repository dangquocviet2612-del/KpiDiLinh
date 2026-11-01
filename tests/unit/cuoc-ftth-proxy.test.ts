import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import proxy from "@/proxy";

let sequence = 0;
let ip: string;
let now: number;
const usedKeys = new Set<string>();

function request(pathname: string, method = "POST", address = ip) {
  usedKeys.add(`rl:import:${pathname}:${address}`);
  return proxy(new NextRequest(`http://localhost${pathname}`, {
    method, headers: { "x-forwarded-for": address },
  }));
}

beforeEach(() => {
  sequence += 1;
  ip = `203.0.113.${sequence}`;
  now = Date.parse("2026-11-01T00:00:00Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  const state = globalThis as typeof globalThis & { __rateLimitStore?: Map<string, unknown> };
  for (const key of usedKeys) state.__rateLimitStore?.delete(key);
  usedKeys.clear();
});

describe("FTTH import proxy parity with CD", () => {
  it.each(["/api/cuoc-cd/import", "/api/cuoc-ftth/import"])("limits %s to six requests per minute", async (pathname) => {
    for (let count = 0; count < 6; count += 1) expect(request(pathname).status).toBe(200);
    const blocked = request(pathname);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát." });
    now += 60_001;
    expect(request(pathname).status).toBe(200);
  });

  it("separates CD, FTTH and different IP budgets", () => {
    for (let count = 0; count < 6; count += 1) expect(request("/api/cuoc-ftth/import").status).toBe(200);
    expect(request("/api/cuoc-ftth/import").status).toBe(429);
    expect(request("/api/cuoc-cd/import").status).toBe(200);
    expect(request("/api/cuoc-ftth/import", "POST", "192.0.2.90").status).toBe(200);
  });

  it("does not spend the import budget on reads or other FTTH endpoints", () => {
    for (let count = 0; count < 8; count += 1) {
      expect(request("/api/cuoc-ftth/import", "GET").status).toBe(200);
      expect(request("/api/cuoc-ftth/report", "GET").status).toBe(200);
      expect(request("/api/cuoc-ftth/config").status).toBe(200);
    }
    for (let count = 0; count < 6; count += 1) expect(request("/api/cuoc-ftth/import").status).toBe(200);
  });
});
