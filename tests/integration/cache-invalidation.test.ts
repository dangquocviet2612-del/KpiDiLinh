import { createClient, type Client } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import AdmZip from "adm-zip";
import bcrypt from "bcryptjs";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as xlsx from "xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: state.auth }));

const ADMIN = "batch5-admin";
const MANAGER = "batch5-manager-a";
const OTHER_MANAGER = "batch5-manager-b";
const ALPHA = "batch5-ctv-a";
const BETA = "batch5-ctv-b";
const DAY = "2026-10-20";
const CUOC_DAY = "2026-10-19";
const NEW_DAY = "2026-10-21";
const GROUP = "CUOC_N1_N3_RATE";
const globalPrisma = globalThis as unknown as { prisma?: PrismaClient };
let database: Client;
let client: PrismaClient;
let routes: Awaited<ReturnType<typeof loadRoutes>>;
let cache: typeof import("@/lib/kpi-cache");

async function loadRoutes() {
  return {
    cuocImport: await import("@/app/api/cuoc/import/route"),
    cuocConfig: await import("@/app/api/cuoc/config/route"),
    cuocReport: await import("@/app/api/cuoc/report/route"),
    report: await import("@/app/api/kpi/report/route"),
    summary: await import("@/app/api/kpi/summary/route"),
    nodeUpload: await import("@/app/api/nodes/upload/route"),
    nodeSearch: await import("@/app/api/node-search-map/route"),
    nodes: await import("@/app/api/nodes/route"),
    customers: await import("@/app/api/customers/route"),
    customerSearch: await import("@/app/api/customers/search-map/route"),
    map: await import("@/app/api/customers/map-data/route"),
    users: await import("@/app/api/users/route"),
    user: await import("@/app/api/users/[id]/route"),
    me: await import("@/app/api/me/route"),
    backup: await import("@/app/api/admin/backup/route"),
    prepaid: await import("@/lib/prepaid-query"),
    scope: await import("@/lib/scope"),
    nearest: await import("@/lib/nodeUtils"),
    mapping: await import("@/lib/customer-node-mapping"),
  };
}

function session(role = "ADMIN", name = ADMIN) {
  return { user: { id: name, role, name } };
}

function signIn(role = "ADMIN", name = ADMIN) {
  state.auth.mockResolvedValue(session(role, name));
}

function request(endpoint: string, body?: unknown, method = "POST") {
  return new Request(`http://localhost/api/${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function getRequest(endpoint: string, parameters: Record<string, string> = {}) {
  return new Request(`http://localhost/api/${endpoint}?${new URLSearchParams(parameters)}`);
}

async function json(response: Response, status = 200) {
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(status);
  return body;
}

function workbook(rows: unknown[][]) {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(rows), "Synthetic");
  return xlsx.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function upload(endpoint: string, buffer?: Buffer, filename = "batch5-fixture.xlsx") {
  const form = new FormData();
  if (buffer) form.set("file", new File([new Uint8Array(buffer)], filename));
  return new Request(`http://localhost/api/${endpoint}`, { method: "POST", body: form });
}

function cuocWorkbook(day = NEW_DAY, completion = 98, code = "batch5-secondary-a") {
  const rows: unknown[][] = Array.from({ length: 6 }, () => []);
  const [year, month, date] = day.split("-");
  rows[0] = [`Ng\u00e0y: ${date}/${month}/${year}`];
  rows[5] = ["", "", "", "Manager", "Employee", "", "", "", "", "", "", "Target", "", "", "", "Collected", "", "Completion"];
  rows.push(["", "", "", MANAGER, code, "", "", "", "", "", "", 1000, "", "", "", completion * 10, "", completion]);
  return workbook(rows);
}

function summaryRequest() {
  return getRequest("kpi/summary", { group: GROUP, reportDate: DAY });
}

function reportRequest() {
  return getRequest("kpi/report", { ctvUser: ALPHA });
}

function userParams(name = ALPHA) {
  return { params: Promise.resolve({ id: name }) };
}

function warmSentinels() {
  const keys = ["cuoc:batch5", "kpi:batch5", "prepaid:batch5", "node:batch5", "nodes:batch5", "map:batch5", "customers:batch5", "users:batch5", "scope:batch5", "batch5:unrelated"];
  const values = keys.map((key) => ({ key }));
  keys.forEach((key, index) => cache.setCache(key, values[index], 60_000));
  return { keys, values };
}

function expectRetained(warm: ReturnType<typeof warmSentinels>) {
  warm.keys.forEach((key, index) => expect(cache.getCache(key), key).toBe(warm.values[index]));
}

function expectInvalidated(warm: ReturnType<typeof warmSentinels>, prefixes: string[]) {
  warm.keys.forEach((key, index) => {
    expect(cache.getCache(key), key).toBe(prefixes.some((prefix) => key.startsWith(prefix)) ? null : warm.values[index]);
  });
}

async function warmKpi() {
  const summary = await json(await routes.summary.GET(summaryRequest()));
  const report = await json(await routes.report.GET(reportRequest()));
  const cuoc = await json(await routes.cuocReport.GET(getRequest("cuoc/report")));
  const summaryHit = await routes.summary.GET(summaryRequest());
  expect(summaryHit.headers.get("Server-Timing")).toContain('desc="hit"');
  expect((await routes.report.GET(reportRequest())).headers.get("Server-Timing")).toContain('desc="hit"');
  expect(await json(summaryHit)).toEqual(summary);
  return { summary, report, cuoc };
}

async function warmManager(name: string) {
  signIn("MANAGER", name);
  const customers = await json(await routes.customers.GET(getRequest("customers")));
  const search = await json(await routes.customerSearch.GET(getRequest("customers/search-map", { q: "batch5" })));
  const map = await json(await routes.map.GET(getRequest("customers/map-data", { includeDetails: "true" })));
  const users = await json(await routes.users.GET(getRequest("users")));
  const summary = await json(await routes.summary.GET(summaryRequest()));
  const report = await json(await routes.report.GET(getRequest("kpi/report", { ctvUser: name === MANAGER ? ALPHA : BETA })));
  const scope = await routes.scope.getAccessibleCtvCodes(session("MANAGER", name));
  const prepaid = await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: name });
  return { customers, search, map, users, summary, report, scope, prepaid };
}

async function seed() {
  const password = await bcrypt.hash("batch5-synthetic-password", 4);
  for (const [username, role, managerCode, secondaryCode] of [
    [ADMIN, "ADMIN", null, null],
    [MANAGER, "MANAGER", null, null],
    [OTHER_MANAGER, "MANAGER", null, null],
    [ALPHA, "CTV", MANAGER, "batch5-secondary-a"],
    [BETA, "CTV", OTHER_MANAGER, "batch5-secondary-b"],
  ]) {
    await client.user.create({ data: { id: username!, username: username!, password, role: role!, managerCode, secondaryCode } });
  }
  await client.kpiMetricConfig.update({ where: { kpiCode: GROUP }, data: { displayName: GROUP } });
  for (const username of [ALPHA, BETA]) {
    await client.kpiDailyResult.create({ data: { reportDate: DAY, ctvUser: username, kpiCode: GROUP, khThang: 1, thNgay: 1, thLuyKe: 1 } });
    await client.cuocDailyResult.create({ data: { reportDate: CUOC_DAY, ctvUser: username, employeeCodeRaw: username, targetAmount: 1000, collectedAmount: 900, completionPercent: 90 } });
    await client.customer.create({ data: { id: `customer-${username}`, name: `Customer ${username}`, account: `account-${username}`, subscriberType: "FIXED", ctvCode: username, latitude: 10, longitude: 106, nodeName: "batch5-node-old" } });
  }
  await client.node.create({ data: { id: "batch5-node", name: "batch5-node-old", description: "original", latitude: 10, longitude: 106 } });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "file::memory:");
  vi.stubEnv("TURSO_AUTH_TOKEN", "");
  state.auth.mockReset();
  signIn();
  const root = process.cwd();
  const parent = path.join(root, ".local/performance");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "batch5-cache-fixture-"));
  const url = `file:${path.join(directory, "fixture.sqlite").replaceAll("\\", "/")}`;
  database = createClient({ url });
  const { loadMigrations, applyMigrations } = await import(pathToFileURL(path.join(root, "scripts/lib/migration-runner.mjs")).href);
  await applyMigrations(database, await loadMigrations(path.join(root, "prisma/migrations")), url);
  client = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  globalPrisma.prisma = client;
  cache = await import("@/lib/kpi-cache");
  routes = await loadRoutes();
  expect((await import("@/lib/prisma")).prisma).toBe(client);
  await seed();
});

afterEach(async () => {
  cache?.clearCacheByPrefix("");
  await client?.$disconnect();
  database?.close();
  delete globalPrisma.prisma;
  vi.unstubAllEnvs();
});

describe("batch5 process cache invalidation with real SQLite and PrismaLibSql (auth mock only)", () => {
  it.each([CUOC_DAY, NEW_DAY])("CUOC XLSX import refreshes summary/report and latest-date fallback for %s", async (day) => {
    const before = await warmKpi();
    expect(before.summary.rows.find((row: { ctvUser: string }) => row.ctvUser === ALPHA).th).toBe(90);
    expect(await routes.prepaid.getLatestCuocReportDateForCtv(ALPHA)).toBe(CUOC_DAY);
    const warm = warmSentinels();
    const imported = await json(await routes.cuocImport.POST(upload("cuoc/import", cuocWorkbook(day))));
    expect(imported).toMatchObject({ reportDate: day, inserted: 1, skippedRows: 0 });
    expect((await client.cuocDailyResult.findUniqueOrThrow({ where: { reportDate_ctvUser: { reportDate: day, ctvUser: ALPHA } } })).completionPercent).toBe(98);
    const summary = await json(await routes.summary.GET(summaryRequest()));
    expect(summary.reportDate).toBe(day);
    expect(summary.rows.find((row: { ctvUser: string }) => row.ctvUser === ALPHA).th).toBe(98);
    const report = await json(await routes.report.GET(reportRequest()));
    expect(report.rows[0].thLuyKe).toBe(98);
    expect(report.totalAchievedScore).toBeGreaterThan(before.report.totalAchievedScore);
    expect((await json(await routes.cuocReport.GET(getRequest("cuoc/report")))).reportDate).toBe(day);
    expect(await routes.prepaid.getLatestCuocReportDateForCtv(ALPHA)).toBe(day);
    expect(await routes.prepaid.getLatestCuocCompletionForCtv(ALPHA)).toBe(98);
    expectInvalidated(warm, ["cuoc:", "kpi:", "prepaid:"]);
  });

  it("CUOC config refreshes summary KH/gap and report KH without changing fixed-formula score", async () => {
    const before = await warmKpi();
    const warm = warmSentinels();
    expect(await json(await routes.cuocConfig.POST(request("cuoc/config", { targetRatePercent: 95 })))).toEqual({ ok: true, targetRatePercent: 95 });
    expect((await client.cuocConfig.findUniqueOrThrow({ where: { id: 1 } })).targetRatePercent).toBe(95);
    const summary = await json(await routes.summary.GET(summaryRequest()));
    expect(summary.rows[0]).toMatchObject({ kh: 95, th: 90, thieu: 5 });
    const report = await json(await routes.report.GET(reportRequest()));
    expect(report.rows[0].khThang).toBe(95);
    expect(report.totalAchievedScore).toBe(before.report.totalAchievedScore);
    const cuoc = await json(await routes.cuocReport.GET(getRequest("cuoc/report")));
    expect(cuoc.targetRatePercent).toBe(95);
    expect(cuoc.rows[0].missingAmount).toBe(50);
    expect(await routes.prepaid.getCuocTargetRatePercent()).toBe(95);
    expectInvalidated(warm, ["cuoc:", "kpi:", "prepaid:"]);
  });

  it.each(["kml", "kmz"])("node %s position upload refreshes real text/coordinate search and nearest-node cache", async (extension) => {
    const query = getRequest("node-search-map", { q: "batch5" });
    const coordinates = getRequest("node-search-map", { q: "10,106" });
    expect((await json(await routes.nodeSearch.GET(query))).items).toHaveLength(1);
    await json(await routes.nodeSearch.GET(coordinates));
    await json(await routes.nodes.GET(getRequest("nodes")));
    expect(await routes.nearest.findNearestNodeName(10, 106)).toBe("batch5-node-old");
    const warm = warmSentinels();
    const xml = '<kml><Document><Placemark><name>batch5-node-old</name><description>changed</description><Point><coordinates>107,11,0</coordinates></Point></Placemark><Placemark><name>batch5-node-new</name><Point><coordinates>106,10,0</coordinates></Point></Placemark></Document></kml>';
    const archive = new AdmZip();
    archive.addFile("doc.kml", Buffer.from(xml));
    const result = await json(await routes.nodeUpload.POST(upload("nodes/upload", extension === "kml" ? Buffer.from(xml) : archive.toBuffer(), `batch5.${extension}`)));
    expect(result).toMatchObject({ mode: "NODE_POSITIONS", created: 1, updated: 1 });
    const search = await json(await routes.nodeSearch.GET(query));
    expect(search.items).toHaveLength(2);
    expect(search.items.find((node: { name: string }) => node.name === "batch5-node-old")).toMatchObject({ latitude: 11, longitude: 107, description: "changed" });
    expect((await json(await routes.nodeSearch.GET(coordinates))).items[0].name).toBe("batch5-node-new");
    expect(await routes.nearest.findNearestNodeName(10, 106)).toBe("batch5-node-new");
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it("node efficiency XLSX success invalidates search and map dependencies after real writes", async () => {
    await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })));
    const warm = warmSentinels();
    const result = await json(await routes.nodeUpload.POST(upload("nodes/upload", workbook([["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY"], ["batch5-node-old", 100, 25, 25]]))));
    expect(result).toMatchObject({ mode: "NODE_EFFICIENCY", updated: 1, errors: [] });
    expect((await client.node.findUniqueOrThrow({ where: { id: "batch5-node" } })).usedPort).toBe(25);
    expect(cache.getCache("node:search|batch5|20")).toBeNull();
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it.each(["list", "search"])("account-node XLSX success refreshes warmed customer %s cache and maps", async (consumer) => {
    const query = getRequest("customers/map-data", { includeDetails: "true" });
    const searchQuery = getRequest("customers/search-map", { q: "batch5" });
    const list = await json(await routes.customers.GET(getRequest("customers")));
    expect(list.data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).nodeName).toBe("batch5-node-old");
    const search = await json(await routes.customerSearch.GET(searchQuery));
    const searchKey = `customers:search-map|ADMIN|${ADMIN}|batch5|20`;
    const warmSearch = cache.getCache(searchKey);
    expect(warmSearch).toEqual(search);
    await json(await routes.map.GET(query));
    await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })));
    const warm = warmSentinels();
    const result = await json(await routes.nodeUpload.POST(upload("nodes/upload", workbook([["Account", "Node"], [`account-${ALPHA}`, "batch5-mapped-node"]]))));
    expect(result).toMatchObject({ mode: "ACCOUNT_NODE_MAP", inserted: 1, syncedCustomers: 1 });
    expect((await client.customer.findUniqueOrThrow({ where: { id: `customer-${ALPHA}` } })).nodeName).toBe("batch5-mapped-node");
    expect((await json(await routes.map.GET(query))).data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).nodeName).toBe("batch5-mapped-node");
    if (consumer === "list") {
      expect((await json(await routes.customers.GET(getRequest("customers")))).data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).nodeName).toBe("batch5-mapped-node");
    } else {
      expect(cache.getCache(searchKey)).toBeNull();
      expect(await json(await routes.customerSearch.GET(searchQuery))).toEqual(search);
      expect(cache.getCache(searchKey)).not.toBe(warmSearch);
    }
    expect(cache.getCache("node:search|batch5|20")).toBeNull();
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it.each(["first row fails", "last row fails", "later chunk fails"])("partial efficiency upload (%s) preserves commits but refreshes real cached node fields", async (scenario) => {
    const count = scenario === "later chunk fails" ? 120 : 1;
    const successful = Array.from({ length: count }, (_unused, index) => ({
      id: index === 0 ? "batch5-node" : `batch5-efficiency-${index}`,
      name: index === 0 ? "batch5-node-old" : `batch5-efficiency-${index}`,
      latitude: 10,
      longitude: 106,
    }));
    if (successful.length > 1) await client.node.createMany({ data: successful.slice(1) });
    await client.node.create({ data: { id: "batch5-rejected-node", name: "batch5-rejected-node", latitude: 10, longitude: 106 } });
    const query = getRequest("nodes");
    const before = await json(await routes.nodes.GET(query));
    expect(before.data.find((node: { id: string }) => node.id === "batch5-node").usedPort).toBeNull();
    await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })));
    await database.execute("CREATE TRIGGER batch5_reject_efficiency BEFORE UPDATE ON Node WHEN OLD.id='batch5-rejected-node' BEGIN SELECT RAISE(ABORT,'batch5 partial efficiency failure'); END");
    const warm = warmSentinels();
    const rows: unknown[][] = successful.map((node) => [node.name, 100, 25, 25]);
    const rejectedRow = ["batch5-rejected-node", 100, 25, 25];
    if (scenario === "first row fails") rows.unshift(rejectedRow);
    else rows.push(rejectedRow);
    const response = await routes.nodeUpload.POST(upload("nodes/upload", workbook([["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY"], ...rows])));
    expect(response.status).toBe(500);
    const persisted = await client.node.findMany({ where: { id: { in: successful.map((node) => node.id) } } });
    expect(persisted).toHaveLength(count);
    expect(persisted.every((node) => node.usedPort === 25)).toBe(true);
    expect((await client.node.findUniqueOrThrow({ where: { id: "batch5-rejected-node" } })).usedPort).toBeNull();
    const refreshed = await json(await routes.nodes.GET(query));
    expect(refreshed.data.find((node: { id: string }) => node.id === "batch5-node").usedPort).toBe(25);
    expect(cache.getCache("node:search|batch5|20")).toBeNull();
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it("entirely rejected efficiency writes retain warm cache and original node fields", async () => {
    const query = getRequest("nodes");
    const before = await json(await routes.nodes.GET(query));
    const warmNodes = cache.getCache("nodes:list");
    await database.execute("CREATE TRIGGER batch5_reject_all_efficiency BEFORE UPDATE ON Node BEGIN SELECT RAISE(ABORT,'batch5 no efficiency commit'); END");
    const warm = warmSentinels();
    expect((await routes.nodeUpload.POST(upload("nodes/upload", workbook([["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY"], ["batch5-node-old", 100, 25, 25]])))).status).toBe(500);
    expect((await client.node.findUniqueOrThrow({ where: { id: "batch5-node" } })).usedPort).toBeNull();
    expectRetained(warm);
    expect(cache.getCache("nodes:list")).toBe(warmNodes);
    expect(await json(await routes.nodes.GET(query))).toEqual(before);
  });

  it.each(["managerCode", "secondaryCode"])("fallback user create commits a minimal user before %s failure and clears stale scopes", async (field) => {
    const username = "batch5-partial-created";
    await client.customer.create({ data: { id: "batch5-partial-customer", name: username, account: username, ctvCode: username, subscriberType: "FIXED", latitude: 10, longitude: 106 } });
    await client.kpiDailyResult.create({ data: { reportDate: DAY, ctvUser: username, kpiCode: GROUP } });
    await warmManager(MANAGER);
    signIn();
    await json(await routes.users.GET(getRequest("users")));
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "ADMIN", sessionName: ADMIN })).not.toContain(username);
    await database.execute(`CREATE TRIGGER batch5_force_create_fallback BEFORE INSERT ON User WHEN NEW.username='${username}' AND NEW.managerCode IS NOT NULL BEGIN SELECT RAISE(ABORT,'batch5 force create fallback'); END`);
    await database.execute(`CREATE TRIGGER batch5_reject_create_raw_update BEFORE UPDATE OF ${field} ON User WHEN OLD.username='${username}' BEGIN SELECT RAISE(ABORT,'batch5 partial create ${field} failure'); END`);
    const warm = warmSentinels();
    expect((await routes.users.POST(request("users", { username, password: "batch5-fake-password", role: "CTV", managerCode: MANAGER, secondaryCode: "batch5-partial-secondary" }))).status).toBe(500);
    expect(await client.user.findUniqueOrThrow({ where: { username } })).toMatchObject({ role: "CTV", managerCode: field === "managerCode" ? null : MANAGER, secondaryCode: null });
    expect((await json(await routes.users.GET(getRequest("users")))).some((user: { username: string }) => user.username === username)).toBe(true);
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "ADMIN", sessionName: ADMIN })).toContain(username);
    signIn("MANAGER", MANAGER);
    const count = field === "managerCode" ? 1 : 2;
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toHaveLength(count);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows).toHaveLength(count);
    expectInvalidated(warm, [""]);
  });

  it.each(["managerCode", "secondaryCode"])("fallback user update commits role before %s failure and refreshes fixed MANAGER membership", async (field) => {
    await warmManager(MANAGER);
    signIn();
    await json(await routes.users.GET(getRequest("users")));
    await database.execute(`CREATE TRIGGER batch5_force_update_fallback BEFORE UPDATE OF managerCode,secondaryCode ON User WHEN OLD.id='${ALPHA}' AND OLD.role='CTV' AND NEW.role='MANAGER' BEGIN SELECT RAISE(ABORT,'batch5 force update fallback'); END`);
    await database.execute(`CREATE TRIGGER batch5_reject_update_raw_update BEFORE UPDATE OF ${field} ON User WHEN OLD.id='${ALPHA}' BEGIN SELECT RAISE(ABORT,'batch5 partial update ${field} failure'); END`);
    const warm = warmSentinels();
    expect((await routes.user.PUT(request(`users/${ALPHA}`, { role: "MANAGER", managerCode: OTHER_MANAGER, secondaryCode: "batch5-partial-secondary" }, "PUT"), userParams())).status).toBe(500);
    expect(await client.user.findUniqueOrThrow({ where: { id: ALPHA } })).toMatchObject({ role: "MANAGER", managerCode: field === "managerCode" ? MANAGER : OTHER_MANAGER, secondaryCode: "batch5-secondary-a" });
    expect((await json(await routes.users.GET(getRequest("users")))).find((user: { username: string }) => user.username === ALPHA).role).toBe("MANAGER");
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toEqual([]);
    expect((await json(await routes.customerSearch.GET(getRequest("customers/search-map", { q: "batch5" })))).items).toEqual([]);
    expect(await json(await routes.users.GET(getRequest("users")))).toEqual([]);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows).toEqual([]);
    await json(await routes.report.GET(reportRequest()), 403);
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: MANAGER })).toEqual([]);
    expectInvalidated(warm, [""]);
  });

  it.each(["managerCode", "secondaryCode"])("User PUT %s-only failure with an empty fallback retains User rows and real warm scopes", async (field) => {
    await warmManager(MANAGER);
    const scopeKey = `scope:ctv|MANAGER|${MANAGER}`;
    const warmScope = cache.getCache(scopeKey);
    signIn();
    const before = await client.user.findMany({ orderBy: { id: "asc" } });
    const auditCount = await client.auditLog.count();
    await database.execute(`CREATE TRIGGER batch5_reject_field_only BEFORE UPDATE OF ${field} ON User WHEN OLD.id='${ALPHA}' BEGIN SELECT RAISE(ABORT,'batch5 field-only no User commit'); END`);
    const warm = warmSentinels();
    const value = field === "managerCode" ? OTHER_MANAGER : "batch5-rejected-secondary";
    expect((await routes.user.PUT(request(`users/${ALPHA}`, { [field]: value }, "PUT"), userParams())).status).toBe(500);
    expect(await client.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await client.auditLog.count()).toBe(auditCount);
    expect(cache.getCache(scopeKey)).toBe(warmScope);
    expectRetained(warm);
    signIn("MANAGER", MANAGER);
    expect((await routes.summary.GET(summaryRequest())).headers.get("Server-Timing")).toContain('desc="hit"');
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toHaveLength(1);
  });

  it("User PUT empty fallback still clears after a raw manager write commits before secondary failure", async () => {
    await warmManager(MANAGER);
    await warmManager(OTHER_MANAGER);
    signIn();
    const before = await client.user.findMany({ orderBy: { id: "asc" } });
    const auditCount = await client.auditLog.count();
    await database.execute(`CREATE TRIGGER batch5_reject_secondary_after_manager BEFORE UPDATE OF secondaryCode ON User WHEN OLD.id='${ALPHA}' BEGIN SELECT RAISE(ABORT,'batch5 raw secondary failure after manager commit'); END`);
    const warm = warmSentinels();
    expect((await routes.user.PUT(request(`users/${ALPHA}`, { managerCode: OTHER_MANAGER, secondaryCode: "batch5-rejected-secondary" }, "PUT"), userParams())).status).toBe(500);
    expect(await client.user.findMany({ orderBy: { id: "asc" } })).toEqual(before.map((user) => user.id === ALPHA ? { ...user, managerCode: OTHER_MANAGER } : user));
    expect(await client.auditLog.count()).toBe(auditCount);
    expectInvalidated(warm, [""]);
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toEqual([]);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows).toEqual([]);
    await json(await routes.report.GET(reportRequest()), 403);
    const gaining = await warmManager(OTHER_MANAGER);
    expect(gaining.customers.data).toHaveLength(2);
    expect(gaining.prepaid).toContain(ALPHA);
  });

  it.each(["managerCode", "secondaryCode"])("User PUT %s-only raw fallback success counts as a committed write", async (field) => {
    await warmManager(MANAGER);
    signIn();
    const before = await client.user.findMany({ orderBy: { id: "asc" } });
    const auditCount = await client.auditLog.count();
    await database.execute(`CREATE TRIGGER batch5_force_raw_only_fallback BEFORE UPDATE OF updatedAt ON User WHEN OLD.id='${ALPHA}' BEGIN SELECT RAISE(ABORT,'batch5 force field-only fallback'); END`);
    const value = field === "managerCode" ? OTHER_MANAGER : "batch5-raw-secondary";
    const warm = warmSentinels();
    const result = await json(await routes.user.PUT(request(`users/${ALPHA}`, { [field]: value }, "PUT"), userParams()));
    expect(result[field]).toBe(value);
    expect(await client.user.findMany({ orderBy: { id: "asc" } })).toEqual(before.map((user) => user.id === ALPHA ? { ...user, [field]: value } : user));
    expect(await client.auditLog.count()).toBe(auditCount + 1);
    expectInvalidated(warm, [""]);
  });

  it.each([
    { name: "empty body", body: {} },
    { name: "blank password", body: { password: "" } },
    { name: "null password", body: { password: null } },
  ])("no-op User PUT ($name) preserves User rows and caches while retaining audit behavior", async ({ body }) => {
    await warmManager(MANAGER);
    const scopeKey = `scope:ctv|MANAGER|${MANAGER}`;
    const warmScope = cache.getCache(scopeKey);
    signIn();
    const before = await client.user.findMany({ orderBy: { id: "asc" } });
    const auditCount = await client.auditLog.count();
    const warm = warmSentinels();
    expect(await json(await routes.user.PUT(request(`users/${ALPHA}`, body, "PUT"), userParams()))).toMatchObject({ id: ALPHA, username: ALPHA, role: "CTV", managerCode: MANAGER, secondaryCode: "batch5-secondary-a" });
    expect(await client.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await client.auditLog.count()).toBe(auditCount + 1);
    const audit = await client.auditLog.findFirstOrThrow({ where: { action: "USER_UPDATE", resource: "User" } });
    expect(audit).toMatchObject({ userId: ADMIN, username: ADMIN });
    expect(JSON.parse(audit.details!)).toMatchObject({ targetUserId: ALPHA, targetUsername: ALPHA });
    expect(cache.getCache(scopeKey)).toBe(warmScope);
    expectRetained(warm);
    signIn("MANAGER", MANAGER);
    expect((await routes.summary.GET(summaryRequest())).headers.get("Server-Timing")).toContain('desc="hit"');
  });

  it.each(["create", "update"])("fully rejected user %s and fallback retain database contents and warm caches", async (operation) => {
    await warmManager(MANAGER);
    signIn();
    const before = await client.user.findMany({ orderBy: { id: "asc" } });
    await database.execute(`CREATE TRIGGER batch5_reject_user_write BEFORE ${operation === "create" ? "INSERT" : "UPDATE"} ON User BEGIN SELECT RAISE(ABORT,'batch5 no user commit'); END`);
    const warm = warmSentinels();
    const response = operation === "create"
      ? await routes.users.POST(request("users", { username: "batch5-rejected-user", password: "batch5-fake-password", role: "CTV", managerCode: MANAGER }))
      : await routes.user.PUT(request(`users/${ALPHA}`, { role: "MANAGER", managerCode: OTHER_MANAGER }, "PUT"), userParams());
    expect(response.status).toBe(500);
    expect(await client.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expectRetained(warm);
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toHaveLength(1);
  });

  it.each(["second mapping chunk", "customer sync"])("mapping upload %s failure preserves committed mappings and refreshes warmed customer reads", async (failure) => {
    const listQuery = getRequest("customers");
    const mapQuery = getRequest("customers/map-data", { includeDetails: "true" });
    await json(await routes.customers.GET(listQuery));
    await json(await routes.map.GET(mapQuery));
    await json(await routes.customerSearch.GET(getRequest("customers/search-map", { q: "batch5" })));
    const rows: unknown[][] = [[`account-${ALPHA}`, "batch5-partial-mapped-node"]];
    if (failure === "second mapping chunk") {
      for (let index = 1; index < 180; index += 1) rows.push([`batch5-mapping-${index}`, "batch5-partial-mapped-node"]);
      rows.push(["batch5-rejected-mapping", "batch5-partial-mapped-node"]);
      await database.execute("CREATE TRIGGER batch5_reject_mapping_chunk BEFORE INSERT ON CustomerNodeMapping WHEN NEW.account='batch5-rejected-mapping' BEGIN SELECT RAISE(ABORT,'batch5 second mapping chunk failure'); END");
    } else {
      await database.execute(`CREATE TRIGGER batch5_reject_mapping_sync BEFORE UPDATE ON Customer WHEN OLD.id='customer-${ALPHA}' BEGIN SELECT RAISE(ABORT,'batch5 mapping customer sync failure'); END`);
    }
    const warm = warmSentinels();
    expect((await routes.nodeUpload.POST(upload("nodes/upload", workbook([["Account", "Node"], ...rows])))).status).toBe(500);
    expect(await client.customerNodeMapping.count()).toBe(failure === "second mapping chunk" ? 180 : 1);
    expect(await client.customerNodeMapping.findUnique({ where: { accountKey: `account-${ALPHA}` } })).toMatchObject({ nodeName: "batch5-partial-mapped-node" });
    expect((await client.customer.findUniqueOrThrow({ where: { id: `customer-${ALPHA}` } })).nodeName).toBe("batch5-node-old");
    expect((await json(await routes.customers.GET(listQuery))).data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).nodeName).toBe("batch5-partial-mapped-node");
    expect((await json(await routes.map.GET(mapQuery))).data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).nodeName).toBe("batch5-partial-mapped-node");
    expect(cache.getCache(`customers:search-map|ADMIN|${ADMIN}|batch5|20`)).toBeNull();
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it("mapping sync callback clears real customer caches after a committed 350-row chunk before the next chunk fails", async () => {
    const synthetic = Array.from({ length: 350 }, (_unused, index) => ({
      id: `batch5-sync-${index}`,
      name: `batch5-sync-${index}`,
      account: `batch5-sync-${index}`,
      ctvCode: ALPHA,
      subscriberType: "FIXED",
      nodeName: "batch5-node-old",
      latitude: 10,
      longitude: 106,
    }));
    await client.customer.createMany({ data: synthetic });
    const accounts = [`account-${ALPHA}`, ...synthetic.map((customer) => customer.account)];
    await client.customerNodeMapping.createMany({ data: accounts.map((account) => ({ account, accountKey: account, nodeName: "batch5-synced-node" })) });
    const query = getRequest("customers", { search: `account-${ALPHA}` });
    await json(await routes.customers.GET(query));
    await json(await routes.map.GET(getRequest("customers/map-data", { includeDetails: "true" })));
    await database.execute("CREATE TRIGGER batch5_reject_second_sync_chunk BEFORE UPDATE ON Customer WHEN OLD.id='batch5-sync-349' BEGIN SELECT RAISE(ABORT,'batch5 second sync chunk failure'); END");
    const { invalidateCacheForMutation } = await import("@/lib/cache-tags");
    const warm = warmSentinels();
    await expect(routes.mapping.syncMappedNodesToCustomersByAccounts(accounts, () => invalidateCacheForMutation("nodes"))).rejects.toThrow("batch5 second sync chunk failure");
    expect((await client.customer.findUniqueOrThrow({ where: { id: `customer-${ALPHA}` } })).nodeName).toBe("batch5-synced-node");
    expect((await client.customer.findUniqueOrThrow({ where: { id: "batch5-sync-349" } })).nodeName).toBe("batch5-node-old");
    expect(cache.getCache(`customers:list|ADMIN|${ADMIN}|search=account-${ALPHA}`)).toBeNull();
    expect(cache.getCache(`map:data|ADMIN|${ADMIN}|0|1|10000|all`)).toBeNull();
    expect((await json(await routes.customers.GET(query))).data[0].nodeName).toBe("batch5-synced-node");
    expectInvalidated(warm, ["node:", "nodes:", "map:", "customers:"]);
  });

  it("managerCode reassignment refreshes both fixed MANAGER sessions' customer/KPI/users/prepaid scopes", async () => {
    expect((await warmManager(MANAGER)).search.items).toHaveLength(1);
    expect((await warmManager(OTHER_MANAGER)).customers.data).toHaveLength(1);
    const warm = warmSentinels();
    signIn();
    expect(await json(await routes.user.PUT(request(`users/${ALPHA}`, { managerCode: OTHER_MANAGER }, "PUT"), userParams()))).toMatchObject({ managerCode: OTHER_MANAGER });
    expect((await client.user.findUniqueOrThrow({ where: { id: ALPHA } })).managerCode).toBe(OTHER_MANAGER);
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toEqual([]);
    expect((await json(await routes.customerSearch.GET(getRequest("customers/search-map", { q: "batch5" })))).items).toEqual([]);
    expect((await json(await routes.map.GET(getRequest("customers/map-data", { includeDetails: "true" })))).data).toEqual([]);
    expect(await json(await routes.users.GET(getRequest("users")))).toEqual([]);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows).toEqual([]);
    await json(await routes.report.GET(reportRequest()), 403);
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: MANAGER })).toEqual([]);
    const gaining = await warmManager(OTHER_MANAGER);
    expect(gaining.customers.data).toHaveLength(2);
    expect(gaining.search.items).toHaveLength(2);
    expect(gaining.map.data).toHaveLength(2);
    expect(gaining.users).toHaveLength(2);
    expect(gaining.summary.rows).toHaveLength(2);
    expect(gaining.prepaid.sort()).toEqual([ALPHA, BETA]);
    expectInvalidated(warm, [""]);
  });

  it("user creation clears process cache after persistence and expands an already-warm manager scope", async () => {
    await warmManager(MANAGER);
    signIn();
    const warm = warmSentinels();
    const name = "batch5-created";
    const created = await json(await routes.users.POST(request("users", { username: name, password: "batch5-fake-password", role: "CTV", managerCode: MANAGER })), 201);
    expect(created).toMatchObject({ username: name, role: "CTV", managerCode: MANAGER });
    expect(await client.user.findUnique({ where: { username: name } })).not.toBeNull();
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.users.GET(getRequest("users")))).map((user: { username: string }) => user.username).sort()).toEqual([name, ALPHA].sort());
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: MANAGER })).toContain(name);
    expectInvalidated(warm, [""]);
  });

  it("user removal refreshes warm customer search/list and revokes DB membership for fixed manager session", async () => {
    await warmManager(MANAGER);
    signIn();
    const warm = warmSentinels();
    expect(await json(await routes.user.DELETE(request(`users/${ALPHA}`, undefined, "DELETE"), userParams()))).toMatchObject({ success: true });
    expect(await client.user.findUnique({ where: { id: ALPHA } })).toBeNull();
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toEqual([]);
    expect((await json(await routes.customerSearch.GET(getRequest("customers/search-map", { q: "batch5" })))).items).toEqual([]);
    expect(await json(await routes.users.GET(getRequest("users")))).toEqual([]);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows).toEqual([]);
    await json(await routes.report.GET(reportRequest()), 403);
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: MANAGER })).toEqual([]);
    expectInvalidated(warm, [""]);
  });

  it("restore clears all process keys and refreshes actual scope/users/prepaid/customer/node reads", async () => {
    const backup = await json(await routes.backup.GET());
    backup.data.users.find((user: { username: string }) => user.username === ALPHA).managerCode = OTHER_MANAGER;
    backup.data.customers.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).name = "batch5-restored-customer";
    backup.data.nodes[0].latitude = 12;
    backup.data.nodes[0].description = "restored";
    backup.data.cuocDailyResults.find((row: { ctvUser: string }) => row.ctvUser === ALPHA).completionPercent = 98;
    backup.data.cuocConfigs[0].targetRatePercent = 95;
    await warmManager(MANAGER);
    await warmManager(OTHER_MANAGER);
    signIn();
    await warmKpi();
    await json(await routes.me.GET());
    await json(await routes.users.GET(getRequest("users")));
    await json(await routes.customers.GET(getRequest("customers")));
    await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })));
    await routes.prepaid.getLatestCuocReportDateForCtv(ALPHA);
    const warm = warmSentinels();
    expect(await json(await routes.backup.POST(request("admin/backup", backup)))).toMatchObject({ success: true });
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toEqual([]);
    expect(await json(await routes.users.GET(getRequest("users")))).toEqual([]);
    expect(await routes.prepaid.getScopedPrepaidCtvUsers({ role: "MANAGER", sessionName: MANAGER })).toEqual([]);
    expect((await warmManager(OTHER_MANAGER)).customers.data).toHaveLength(2);
    signIn();
    expect((await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })))).items[0]).toMatchObject({ latitude: 12, description: "restored" });
    expect((await json(await routes.customers.GET(getRequest("customers")))).data.find((customer: { ctvCode: string }) => customer.ctvCode === ALPHA).name).toBe("batch5-restored-customer");
    expect(await routes.prepaid.getCuocTargetRatePercent()).toBe(95);
    expect(await routes.prepaid.getLatestCuocCompletionForCtv(ALPHA)).toBe(98);
    expect((await json(await routes.summary.GET(summaryRequest()))).rows.find((row: { ctvUser: string }) => row.ctvUser === ALPHA)).toMatchObject({ kh: 95, th: 98 });
    expectInvalidated(warm, [""]);
  });

  it.each(["unmatched efficiency", "invalid account mapping", "header-only mapping"])("node %s makes no business writes and retains warm cache", async (mode) => {
    await json(await routes.nodeSearch.GET(getRequest("node-search-map", { q: "batch5" })));
    const warm = warmSentinels();
    const rows = mode === "unmatched efficiency"
      ? [["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY"], ["not-a-node", 100, 25, 25]]
      : mode === "invalid account mapping" ? [["Account", "Node"], ["", "batch5-node-old"]] : [["Account", "Node"]];
    const before = await client.node.findMany();
    const result = await json(await routes.nodeUpload.POST(upload("nodes/upload", workbook(rows))));
    expect(result.updated).toBe(0);
    expect(await client.node.findMany()).toEqual(before);
    expect(await client.customerNodeMapping.count()).toBe(0);
    expectRetained(warm);
    expect(cache.getCache("node:search|batch5|20")).not.toBeNull();
  });

  it("node position insert trigger rolls back all nodes and retains search/nearest caches", async () => {
    const query = getRequest("node-search-map", { q: "batch5" });
    const before = await json(await routes.nodeSearch.GET(query));
    await routes.nearest.findNearestNodeName(10, 106);
    const rows = await client.node.findMany();
    await database.execute("CREATE TRIGGER batch5_reject_node BEFORE INSERT ON Node BEGIN SELECT RAISE(ABORT,'batch5 node rollback'); END");
    const warm = warmSentinels();
    const xml = '<kml><Placemark><name>batch5-new</name><Point><coordinates>107,11</coordinates></Point></Placemark></kml>';
    expect((await routes.nodeUpload.POST(upload("nodes/upload", Buffer.from(xml), "batch5.kml"))).status).toBe(500);
    expect(await client.node.findMany()).toEqual(rows);
    expectRetained(warm);
    expect(await json(await routes.nodeSearch.GET(query))).toEqual(before);
    expect(await routes.nearest.findNearestNodeName(10, 106)).toBe("batch5-node-old");
  });

  it.each(["cuoc import", "cuoc config", "node upload", "user create", "user update", "user delete", "restore"])("unauthenticated %s retains warm cache", async (operation) => {
    await warmKpi();
    const warm = warmSentinels();
    state.auth.mockResolvedValue(null);
    const response = operation === "cuoc import" ? await routes.cuocImport.POST(upload("cuoc/import", cuocWorkbook()))
      : operation === "cuoc config" ? await routes.cuocConfig.POST(request("cuoc/config", { targetRatePercent: 95 }))
      : operation === "node upload" ? await routes.nodeUpload.POST(upload("nodes/upload"))
      : operation === "user create" ? await routes.users.POST(request("users", {}))
      : operation === "user update" ? await routes.user.PUT(request(`users/${ALPHA}`, {}, "PUT"), userParams())
      : operation === "user delete" ? await routes.user.DELETE(request(`users/${ALPHA}`, undefined, "DELETE"), userParams())
      : await routes.backup.POST(request("admin/backup", {}));
    expect(response.status).toBe(401);
    expectRetained(warm);
    signIn();
    expect((await routes.summary.GET(summaryRequest())).headers.get("Server-Timing")).toContain('desc="hit"');
  });

  it.each(["create", "update", "delete"])("fixed MANAGER cannot %s a user (403) and warm keys survive", async (operation) => {
    await warmManager(MANAGER);
    const warm = warmSentinels();
    const response = operation === "create" ? await routes.users.POST(request("users", {}))
      : operation === "update" ? await routes.user.PUT(request(`users/${ALPHA}`, {}, "PUT"), userParams())
      : await routes.user.DELETE(request(`users/${ALPHA}`, undefined, "DELETE"), userParams());
    expect(response.status).toBe(403);
    expectRetained(warm);
    expect((await client.user.findUniqueOrThrow({ where: { id: ALPHA } })).managerCode).toBe(MANAGER);
  });

  it("validation failures and restore admin/self-delete safeguards retain warm real cache", async () => {
    await warmKpi();
    const warm = warmSentinels();
    expect((await routes.cuocImport.POST(upload("cuoc/import"))).status).toBe(400);
    expect((await routes.cuocImport.POST(upload("cuoc/import", cuocWorkbook(NEW_DAY, 98, "unmapped")))).status).toBe(400);
    expect((await routes.cuocConfig.POST(request("cuoc/config", { targetRatePercent: -1 }))).status).toBe(400);
    expect((await routes.nodeUpload.POST(upload("nodes/upload", workbook([["bad-header"], ["value"]])))).status).toBe(400);
    expect((await routes.users.POST(request("users", {}))).status).toBe(422);
    expect((await routes.user.PUT(request(`users/${ALPHA}`, { role: "invalid" }, "PUT"), userParams())).status).toBe(422);
    expect((await routes.user.DELETE(request(`users/${ADMIN}`, undefined, "DELETE"), userParams(ADMIN))).status).toBe(400);
    expect((await routes.backup.POST(request("admin/backup", {}))).status).toBe(400);
    const backup = await json(await routes.backup.GET());
    backup.data.users = backup.data.users.filter((user: { role: string }) => user.role !== "ADMIN");
    expect((await routes.backup.POST(request("admin/backup", backup))).status).toBe(400);
    expectRetained(warm);
    expect((await routes.summary.GET(summaryRequest())).headers.get("Server-Timing")).toContain('desc="hit"');
  });

  it("archived CUOC month rejects import without cache invalidation or data writes", async () => {
    await client.archiveLog.create({ data: { archiveMonth: "2026-10", archivedBy: ADMIN, purgeAfter: new Date("2099-01-01") } });
    await warmKpi();
    const before = await client.cuocDailyResult.findMany({ orderBy: { id: "asc" } });
    const warm = warmSentinels();
    expect((await routes.cuocImport.POST(upload("cuoc/import", cuocWorkbook()))).status).toBe(400);
    expect(await client.cuocDailyResult.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expectRetained(warm);
  });

  it("CUOC insert trigger rolls back deleted rows and leaves warm summary/report intact", async () => {
    const before = await warmKpi();
    const rows = await client.cuocDailyResult.findMany({ orderBy: { id: "asc" } });
    await database.execute("CREATE TRIGGER batch5_reject_cuoc BEFORE INSERT ON CuocDailyResult BEGIN SELECT RAISE(ABORT,'batch5 synthetic rollback'); END");
    const warm = warmSentinels();
    expect((await routes.cuocImport.POST(upload("cuoc/import", cuocWorkbook(CUOC_DAY)))).status).toBe(500);
    expect(await client.cuocDailyResult.findMany({ orderBy: { id: "asc" } })).toEqual(rows);
    expectRetained(warm);
    expect(await json(await routes.summary.GET(summaryRequest()))).toEqual(before.summary);
    expect(await json(await routes.report.GET(reportRequest()))).toEqual(before.report);
  });

  it("required restore-default trigger rolls back all restored writes and does not invalidate", async () => {
    const backup = await json(await routes.backup.GET());
    backup.data.users.find((user: { username: string }) => user.username === ALPHA).managerCode = OTHER_MANAGER;
    backup.data.kpiMetricConfigs = [];
    backup.data.cuocConfigs = [];
    backup.data.cuocCdConfigs = [];
    await warmManager(MANAGER);
    signIn();
    const before = { users: await client.user.findMany({ orderBy: { id: "asc" } }), customers: await client.customer.findMany({ orderBy: { id: "asc" } }), nodes: await client.node.findMany({ orderBy: { id: "asc" } }), metrics: await client.kpiMetricConfig.findMany(), configs: await client.cuocConfig.findMany() };
    await database.execute("CREATE TRIGGER batch5_reject_default BEFORE INSERT ON KpiMetricConfig WHEN NEW.kpiCode='CUOC_N1_N3_RATE' BEGIN SELECT RAISE(ABORT,'batch5 required-default rollback'); END");
    const warm = warmSentinels();
    expect((await routes.backup.POST(request("admin/backup", backup))).status).toBe(500);
    expect({ users: await client.user.findMany({ orderBy: { id: "asc" } }), customers: await client.customer.findMany({ orderBy: { id: "asc" } }), nodes: await client.node.findMany({ orderBy: { id: "asc" } }), metrics: await client.kpiMetricConfig.findMany(), configs: await client.cuocConfig.findMany() }).toEqual(before);
    expectRetained(warm);
    signIn("MANAGER", MANAGER);
    expect((await json(await routes.customers.GET(getRequest("customers")))).data).toHaveLength(1);
  });

  it("successful legacy restore supplies required defaults before clearing process cache", async () => {
    const backup = await json(await routes.backup.GET());
    backup.data.kpiMetricConfigs = [];
    backup.data.cuocConfigs = [];
    backup.data.cuocCdConfigs = [];
    const warm = warmSentinels();
    await json(await routes.backup.POST(request("admin/backup", backup)));
    expect(await client.kpiMetricConfig.findUnique({ where: { kpiCode: GROUP } })).toMatchObject({ baseScore: 10, maxPercent: 120, isEnabled: 1 });
    expect(await client.cuocConfig.findUnique({ where: { id: 1 } })).toMatchObject({ targetRatePercent: 97 });
    expect(await client.cuocCdConfig.findUnique({ where: { id: 1 } })).toMatchObject({ targetRatePercent: 99.5 });
    expectInvalidated(warm, [""]);
  });
});
