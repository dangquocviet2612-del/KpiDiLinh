import { createClient, type Client } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ client: null as unknown as PrismaClient, auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  const value = Reflect.get(state.client, key);
  return typeof value === "function" ? value.bind(state.client) : value;
} }) }));
let database: Client;

async function backupRoute() {
  vi.resetModules();
  return import("@/app/api/admin/backup/route");
}

async function payload() {
  const response = await (await backupRoute()).GET();
  expect(response.status).toBe(200);
  return response.json();
}

function restoreRequest(body: unknown) {
  return new Request("http://localhost/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function configRows() {
  return {
    kpi: (await database.execute("SELECT * FROM KpiMetricConfig ORDER BY id")).rows,
    cuoc: (await database.execute("SELECT * FROM CuocConfig ORDER BY id")).rows,
    cuocCd: (await database.execute("SELECT * FROM CuocCdConfig ORDER BY id")).rows,
    users: (await database.execute("SELECT * FROM User ORDER BY id")).rows,
  };
}

beforeEach(async () => {
  vi.resetModules();
  state.auth.mockReset().mockResolvedValue({ user: { id: "fixture-admin", name: "fixture-admin", role: "ADMIN" } });
  const root = process.cwd();
  const parent = path.join(root, ".local/performance/restore-default-fixtures");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "fixture-"));
  const url = `file:${path.join(directory, "fixture.sqlite").replaceAll("\\", "/")}`;
  database = createClient({ url });
  const { loadMigrations, applyMigrations } = await import(pathToFileURL(path.join(root, "scripts/lib/migration-runner.mjs")).href);
  await applyMigrations(database, await loadMigrations(path.join(root, "prisma/migrations")), url);
  state.client = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  await state.client.user.create({ data: { id: "fixture-admin", username: "fixture-admin", role: "ADMIN", password: await bcrypt.hash("fixture-only-password", 4) } });
});

afterEach(async () => { await state.client?.$disconnect(); database?.close(); });

describe("backup and restore system-default invariants", () => {
  it("exports missing-default data with a cold structural check and zero writes", async () => {
    await database.execute("DELETE FROM KpiMetricConfig");
    await database.execute("DELETE FROM CuocConfig");
    await database.execute("DELETE FROM CuocCdConfig");
    const before = await configRows();
    await payload();
    expect(await configRows()).toEqual(before);
  });

  it("restores legacy empty config arrays and passes a cold full readiness check", async () => {
    const body = await payload();
    body.data.kpiMetricConfigs = [];
    body.data.cuocConfigs = [];
    body.data.cuocCdConfigs = [];
    const response = await (await backupRoute()).POST(restoreRequest(body));
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    vi.resetModules();
    const { ensureRuntimeSchema } = await import("@/lib/runtime-schema");
    await expect(ensureRuntimeSchema("kpi")).resolves.toBeUndefined();
    expect((await database.execute("SELECT kpiCode FROM KpiMetricConfig")).rows).toEqual([{ kpiCode: "CUOC_N1_N3_RATE" }]);
    expect((await database.execute("SELECT targetRatePercent FROM CuocConfig")).rows[0].targetRatePercent).toBe(97);
    expect((await database.execute("SELECT targetRatePercent FROM CuocCdConfig")).rows[0].targetRatePercent).toBe(99.5);
    expect((await database.execute("SELECT baseScore,maxPercent,isEnabled,isNegative FROM KpiMetricConfig")).rows).toEqual([{ baseScore: 10, maxPercent: 120, isEnabled: 1, isNegative: 0 }]);
  });

  it("preserves custom rates and disabled metric settings from the restored backup", async () => {
    await database.execute("UPDATE CuocConfig SET targetRatePercent=89");
    await database.execute("UPDATE CuocCdConfig SET targetRatePercent=94");
    await database.execute("UPDATE KpiMetricConfig SET baseScore=7,isEnabled=0 WHERE kpiCode='CUOC_N1_N3_RATE'");
    const body = await payload();
    const response = await (await backupRoute()).POST(restoreRequest(body));
    expect(response.status).toBe(200);
    expect((await database.execute("SELECT targetRatePercent FROM CuocConfig")).rows[0].targetRatePercent).toBe(89);
    expect((await database.execute("SELECT targetRatePercent FROM CuocCdConfig")).rows[0].targetRatePercent).toBe(94);
    expect((await database.execute("SELECT baseScore,isEnabled FROM KpiMetricConfig")).rows).toEqual([{ baseScore: 7, isEnabled: 0 }]);
  });

  it("rolls back restored rows and defaults together if the required metric insert fails", async () => {
    const body = await payload();
    body.data.kpiMetricConfigs = [];
    body.data.cuocConfigs = [];
    body.data.cuocCdConfigs = [];
    const before = await configRows();
    await database.execute("CREATE TRIGGER fixture_reject_default BEFORE INSERT ON KpiMetricConfig WHEN NEW.kpiCode='CUOC_N1_N3_RATE' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
    const response = await (await backupRoute()).POST(restoreRequest(body));
    expect(response.status).toBe(500);
    expect(await configRows()).toEqual(before);
  });

  it("unauthorized backup and restore do not alter configuration", async () => {
    state.auth.mockResolvedValue(null);
    const before = await configRows();
    const route = await backupRoute();
    expect((await route.GET()).status).toBe(401);
    expect((await route.POST(restoreRequest({ data: {} }))).status).toBe(401);
    expect(await configRows()).toEqual(before);
  });
});
