import { createClient, type Client, type InValue } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import golden from "../fixtures/performance/kpi-report-golden.json";

type QueryEvent = { operation: string; sql: string; rows: number; write: boolean };
type Payload = { reportDate: string | null; rows: Array<Record<string, any>>; [key: string]: any };
type ApiResult = { status: number; body: Payload; timing: string; queries: QueryEvent[] };

const state = vi.hoisted(() => ({
  client: null as unknown as PrismaClient,
  auth: vi.fn(),
  queries: [] as QueryEvent[],
}));

vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get: (_target, key) => {
      const value = Reflect.get(state.client, key);
      if (typeof value === "function") {
        return async (...parameters: unknown[]) => {
          const sql = typeof parameters[0] === "string" ? parameters[0] : "";
          const write = !["$queryRawUnsafe", "$queryRaw"].includes(String(key)) || !/^\s*SELECT\b/i.test(sql);
          const event = { operation: String(key), sql, rows: 0, write };
          state.queries.push(event);
          if (write) throw new Error(`Fixture forbids route writes: ${String(key)}`);
          const result = await Reflect.apply(value, state.client, parameters);
          event.rows = Array.isArray(result) ? result.length : 0;
          return result;
        };
      }
      if (value && typeof value === "object") {
        return new Proxy(value, {
          get: (delegate, operation) => {
            const method = Reflect.get(delegate, operation);
            if (typeof method !== "function") return method;
            return async (...parameters: unknown[]) => {
              const write = !["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"].includes(String(operation));
              const event = { operation: `${String(key)}.${String(operation)}`, sql: "", rows: 0, write };
              state.queries.push(event);
              if (write) throw new Error(`Fixture forbids route writes: ${event.operation}`);
              const result = await Reflect.apply(method, delegate, parameters);
              event.rows = Array.isArray(result) ? result.length : 0;
              return result;
            };
          },
        });
      }
      return value;
    },
  }),
}));

const DAY = "2026-10-20";
const OLD_DAY = "2026-10-19";
const CUOC_DAY = "2026-10-21";
const ADMIN = "fixture-admin";
const MANAGER = "fixture-manager-a";
const OTHER_MANAGER = "fixture-manager-b";
const NO_DATES_MANAGER = "fixture-manager-no-dates";
const EMPTY_MANAGER = "fixture-manager-empty";
const ALPHA = "fixture-ctv-a";
const BETA = "fixture-ctv-b";
const OUTSIDER = "fixture-ctv-c";
const NO_DATES = "fixture-ctv-no-dates";
const SECONDARY = "fixture-secondary-a";
const INDICATORS = ["Sales", "Loss", "Churn alias", "Bundle", "Zero target", "Null values", "Zero base", "Padded group", "Cuoc synthetic", "Sales", "sales", "Đồng hạng", "Tie Alpha", "Tie Zulu"];
const ALL_USERS = [ALPHA, BETA, OUTSIDER, NO_DATES];
const EMPTY_REPORT = { rows: [], reportDate: null, totalBaseScore: 0, totalMaxScore: 0, totalAchievedScore: 0 };
let database: Client | undefined;
let beforeFingerprint: string | undefined;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function frozen(name: string, result: ApiResult) {
  const actual = { status: result.status, sha256: hash(result.body) };
  expect(actual).toEqual((golden.cases as Record<string, { status: number; sha256: string }>)[name]);
}

function signIn(role: "ADMIN" | "MANAGER" | "CTV", name = role === "ADMIN" ? ADMIN : role === "MANAGER" ? MANAGER : ALPHA) {
  state.auth.mockResolvedValue({ user: { id: `id-${name}`, role, name } });
}

async function request(endpoint: "report" | "summary", parameters: Record<string, string> = {}): Promise<ApiResult> {
  const route = endpoint === "report"
    ? await import("@/app/api/kpi/report/route")
    : await import("@/app/api/kpi/summary/route");
  const offset = state.queries.length;
  const response = await route.GET(new Request(`http://localhost/api/kpi/${endpoint}?${new URLSearchParams(parameters)}`));
  return { status: response.status, body: await response.json(), timing: response.headers.get("Server-Timing") || "", queries: state.queries.slice(offset) };
}

async function execute(sql: string, args: InValue[] = []) {
  if (!database) throw new Error("Synthetic fixture is not connected");
  return database.execute({ sql, args });
}

async function fingerprint() {
  const schema = (await execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name")).rows;
  const tables = (await execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
  const contents = [];
  for (const table of tables) {
    const name = String(table.name).replaceAll('"', '""');
    contents.push({ name, rows: (await execute(`SELECT * FROM "${name}" ORDER BY rowid`)).rows });
  }
  return hash({ schema, contents });
}

async function seed() {
  const users = [
    [ADMIN, "ADMIN", null, null],
    [MANAGER, "MANAGER", null, null],
    [OTHER_MANAGER, "MANAGER", null, null],
    [NO_DATES_MANAGER, "MANAGER", null, null],
    [EMPTY_MANAGER, "MANAGER", null, null],
    [ALPHA, "CTV", MANAGER, SECONDARY],
    [BETA, "CTV", MANAGER, "fixture-secondary-b"],
    [OUTSIDER, "CTV", OTHER_MANAGER, MANAGER],
    [NO_DATES, "CTV", NO_DATES_MANAGER, null],
  ];
  for (const [username, role, managerCode, secondaryCode] of users) {
    await execute('INSERT INTO "User" (id,username,password,role,managerCode,secondaryCode,updatedAt) VALUES (?,?,?,?,?,?,?)', [`id-${username}`, username, "synthetic-not-a-login-hash", role, managerCode, secondaryCode, "2026-01-01T00:00:00.000Z"]);
  }
  await execute('UPDATE "CuocConfig" SET targetRatePercent=89 WHERE id=1');
  await execute('UPDATE "CuocCdConfig" SET targetRatePercent=94 WHERE id=1');
  await execute('UPDATE "KpiMetricConfig" SET displayName=?,baseScore=7,maxPercent=110,sortOrder=70,isEnabled=1,isNegative=0 WHERE kpiCode=?', ["Cuoc synthetic", "CUOC_N1_N3_RATE"]);
  const configs: InValue[][] = [
    ["POS", "Sales", null, 10, 120, 10, 1, 0],
    ["NEG", "Loss", null, 8, 130, 20, 1, 1],
    ["RM_FTTH_ALL", "Churn alias", null, 6, 120, 25, 1, 0],
    ["MERGE_A", "Part A", "Bundle", 4, 120, 30, 1, 0],
    ["MERGE_B", "Part B", "Bundle", 6, 150, 31, 1, 0],
    ["ZERO", "Zero target", null, 5, 120, 40, 1, 0],
    ["NULL_METRIC", "Null values", null, null, null, 50, 1, 0],
    ["ZERO_BASE", "Zero base", null, 0, 120, 60, 1, 0],
    ["PADDED", "Padded source", "  Padded group  ", 2, 125, 65, 1, 0],
    ["DISABLED", "Hidden", null, 99, 999, 1, 0, 0],
    ["PADDED_ALIAS", " Sales ", null, 0, 145, 80, 1, 1],
    ["CASE_ALIAS", "sales", null, 0, 121, 80, 1, 0],
    ["UNICODE", "Đồng hạng", null, 0, 137, 80, 1, 1],
    ["TIE_Z", "Tie Zulu", null, 0, 126, 90, 1, 0],
    ["TIE_A", "Tie Alpha", null, 0, 125, 90, 1, 0],
  ];
  for (const config of configs) {
    await execute('INSERT INTO "KpiMetricConfig" (kpiCode,displayName,mergeGroup,baseScore,maxPercent,sortOrder,isEnabled,isNegative) VALUES (?,?,?,?,?,?,?,?)', config);
  }
  const metrics: Array<[string, string, number | null, number | null, number | null, number | null, number | null]> = [
    [ALPHA, "POS", 100, 10, 150, 130, 1.25],
    [ALPHA, "NEG", 10, 1, 15, 777, null],
    [ALPHA, "RM_FTTH_ALL", 10, 2, 25, 99, null],
    [ALPHA, "MERGE_A", 20, 2, 10, 50, null],
    [ALPHA, "MERGE_B", 30, 3, 45, 150, null],
    [ALPHA, "ZERO", 0, 0, 5, null, null],
    [ALPHA, "NULL_METRIC", null, null, null, null, null],
    [ALPHA, "ZERO_BASE", 10, 2, 20, 200, null],
    [ALPHA, "PADDED", 10, 1, 5, 50, null],
    [ALPHA, "DISABLED", 10000, 10000, 10000, 999, null],
    [ALPHA, "PADDED_ALIAS", 3, 1, 7, 150, null],
    [ALPHA, "CASE_ALIAS", 8, 1, 2, 25, null],
    [ALPHA, "UNICODE", 10, 1, 15, 777, null],
    [ALPHA, "TIE_Z", 4, 1, 1, 25, null],
    [ALPHA, "TIE_A", 4, 1, 3, 75, null],
    [BETA, "POS", 100, 5, 40, 5, null],
    [BETA, "NEG", 10, 1, 1, 0, null],
    [BETA, "RM_FTTH_ALL", 10, 0, 0, 0, null],
    [BETA, "MERGE_A", 20, 0, 0, 0, null],
    [BETA, "MERGE_B", 30, 6, null, 20, null],
    [BETA, "ZERO", 0, 0, 0, null, null],
    [BETA, "NULL_METRIC", 20, 7, null, 35, null],
    [OUTSIDER, "POS", 20, 1, 20, 100, null],
    [OUTSIDER, "NEG", 10, 1, 30, 100, null],
    [SECONDARY, "POS", 900, 9, 900, 100, null],
  ];
  for (const [username, metric, target, daily, actual, completion, growth] of metrics) {
    await execute('INSERT INTO "KpiDailyResult" (reportDate,ctvUser,kpiCode,kpiName,khThang,thNgay,thLuyKe,completionPercent,growthPercent) VALUES (?,?,?,?,?,?,?,?,?)', [DAY, username, metric, `Synthetic ${metric}`, target, daily, actual, completion, growth]);
  }
  await execute('INSERT INTO "KpiDailyResult" (reportDate,ctvUser,kpiCode,khThang,thLuyKe,completionPercent) VALUES (?,?,?,?,?,?)', [OLD_DAY, ALPHA, "POS", 100, 20, 20]);
  await execute('INSERT INTO "KpiDailyResult" (reportDate,ctvUser,kpiCode,khThang,thLuyKe,completionPercent) VALUES (?,?,?,?,?,?)', ["2026-10-22", OUTSIDER, "POS", 20, 10, 50]);
  for (const [date, username, completion] of [[DAY, ALPHA, 95.2], [DAY, OUTSIDER, 97.3], [CUOC_DAY, ALPHA, 98], [CUOC_DAY, BETA, 99], ["2026-10-24", OUTSIDER, 96], ["2026-10-18", BETA, null]] as InValue[][]) {
    await execute('INSERT INTO "CuocDailyResult" (reportDate,ctvUser,completionPercent) VALUES (?,?,?)', [date, username, completion]);
  }
}

beforeEach(async () => {
  vi.resetModules();
  state.auth.mockReset();
  state.queries = [];
  database = undefined;
  beforeFingerprint = undefined;
  const root = process.cwd();
  const parent = path.join(root, ".local/performance/batch4-kpi-report-fixtures");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "fixture-"));
  const url = `file:${path.join(directory, "fixture.sqlite").replaceAll("\\", "/")}`;
  database = createClient({ url });
  const { applyMigrations, loadMigrations } = await import(pathToFileURL(path.join(root, "scripts/lib/migration-runner.mjs")).href);
  await applyMigrations(database, await loadMigrations(path.join(root, "prisma/migrations")), url);
  state.client = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  await seed();
  signIn("ADMIN");
  beforeFingerprint = await fingerprint();
}, 30_000);

afterEach(async () => {
  try {
    expect(state.queries.filter((query) => query.write)).toEqual([]);
    if (beforeFingerprint) expect(await fingerprint()).toBe(beforeFingerprint);
    if (database) {
      expect((await execute('SELECT targetRatePercent FROM "CuocConfig" WHERE id=1')).rows).toEqual([{ targetRatePercent: 89 }]);
      expect((await execute('SELECT targetRatePercent FROM "CuocCdConfig" WHERE id=1')).rows).toEqual([{ targetRatePercent: 94 }]);
      expect((await execute('SELECT baseScore,maxPercent FROM "KpiMetricConfig" WHERE kpiCode=?', ["CUOC_N1_N3_RATE"])).rows).toEqual([{ baseScore: 7, maxPercent: 110 }]);
    }
  } finally {
    await state.client?.$disconnect();
    database?.close();
  }
});

function reportRow(result: ApiResult, code: string) {
  const row = result.body.rows.find((entry) => entry.kpiCode === code);
  expect(row, code).toBeDefined();
  return row!;
}

function assertAlpha(result: ApiResult) {
  expect(result.status).toBe(200);
  expect(result.body.reportDate).toBe(DAY);
  expect(result.body.rows).toHaveLength(14);
  expect(new Set(result.body.rows.map((row) => row.ctvUser))).toEqual(new Set([ALPHA]));
  expect(reportRow(result, "POS")).toMatchObject({ khThang: 100, thLuyKe: 150, completionPercent: 120, achievedScore: 12, growthPercent: 1.25 });
  expect(reportRow(result, "NEG")).toMatchObject({ isNegativeKpi: true, completionPercent: 50, achievedScore: 4 });
  expect(reportRow(result, "RM_FTTH_ALL")).toMatchObject({ isNegativeKpi: true, completionPercent: 0, achievedScore: 0 });
  expect(reportRow(result, "GROUP:Bundle")).toMatchObject({ khThang: 50, thNgay: 5, thLuyKe: 55, baseScore: 10, maxScore: 13.8, achievedScore: 11, completionPercent: 110, maxPercent: 150 });
  expect(reportRow(result, "ZERO")).toMatchObject({ khThang: 0, thLuyKe: 5, completionPercent: 0, achievedScore: 0 });
  expect(reportRow(result, "NULL_METRIC")).toMatchObject({ khThang: 0, thNgay: 0, thLuyKe: 0, baseScore: 10, maxPercent: 120, achievedScore: 0 });
  expect(reportRow(result, "ZERO_BASE")).toMatchObject({ baseScore: 0, completionPercent: 0, achievedScore: 0 });
  expect(result.body.rows.some((row) => row.kpiCode === "DISABLED")).toBe(false);
  expect(reportRow(result, "CUOC_N1_N3_RATE")).toMatchObject({ khThang: 89, thNgay: 98, thLuyKe: 98, baseScore: 7, maxPercent: 110, achievedScore: 7.57, completionPercent: 108.14 });
  expect(result.body).toMatchObject({ totalBaseScore: 58, totalMaxScore: 71.6, totalAchievedScore: 35.57 });
}

function assertSummary(result: ApiResult, users = [ALPHA, BETA], selectedGroup = "Sales") {
  expect(result.status).toBe(200);
  expect(result.body.indicators).toEqual(INDICATORS);
  expect(result.body.selectedGroup).toBe(selectedGroup);
  expect(result.body.rows.map((row) => row.ctvUser)).toEqual(users);
}

describe("managed synthetic SQLite KPI report baseline", () => {
  it.each(["ADMIN", "MANAGER", "CTV"] as const)("personal full scoring payload for %s", async (role) => {
    signIn(role);
    const result = await request("report", { ctvUser: ALPHA });
    assertAlpha(result);
    frozen(`report-${role}`, result);
  });

  it("CTV query tampering cannot select an outsider or secondary identity", async () => {
    signIn("CTV");
    for (const ctvUser of [OUTSIDER, SECONDARY]) {
      const result = await request("report", { ctvUser });
      assertAlpha(result);
      frozen(`report-ctv-tamper-${ctvUser}`, result);
    }
  });

  it("manager default selects its first primary username", async () => {
    signIn("MANAGER");
    const result = await request("report");
    assertAlpha(result);
    frozen("report-manager-default", result);
  });

  it("manager may select another managed primary username", async () => {
    signIn("MANAGER");
    const result = await request("report", { ctvUser: ` ${BETA} ` });
    expect(result.status).toBe(200);
    expect(new Set(result.body.rows.map((row) => row.ctvUser))).toEqual(new Set([BETA]));
    expect(reportRow(result, "POS")).toMatchObject({ completionPercent: 5, achievedScore: 0.5 });
    expect(reportRow(result, "NEG")).toMatchObject({ completionPercent: 130, achievedScore: 10.4 });
    expect(reportRow(result, "NULL_METRIC")).toMatchObject({ thLuyKe: 7, achievedScore: 3.5 });
    expect(reportRow(result, "GROUP:Bundle")).toMatchObject({ thLuyKe: 6, achievedScore: 1.2, completionPercent: 12 });
    frozen("report-manager-beta", result);
  });

  it.each([OUTSIDER, SECONDARY, "fixture-missing"])("manager denies unowned primary/secondary code %s", async (ctvUser) => {
    signIn("MANAGER");
    const result = await request("report", { ctvUser });
    expect(result.status).toBe(403);
    expect(result.queries.some((query) => /FROM\s+"KpiDailyResult"|LEFT JOIN\s+"KpiDailyResult"/i.test(query.sql))).toBe(false);
    frozen(`report-manager-denied-${ctvUser}`, result);
  });

  it("admin explicit secondary code is not silently mapped to its primary user", async () => {
    const result = await request("report", { ctvUser: SECONDARY, reportDate: DAY });
    expect(reportRow(result, "POS")).toMatchObject({ ctvUser: SECONDARY, khThang: 900, thLuyKe: 900 });
    expect(reportRow(result, "CUOC_N1_N3_RATE")).toMatchObject({ thLuyKe: 0, achievedScore: 0 });
    frozen("report-admin-secondary", result);
  });

  it("historical KPI date still uses latest personal cuoc rather than same-date cuoc", async () => {
    signIn("CTV");
    const result = await request("report", { reportDate: ` ${OLD_DAY} `, ctvUser: OUTSIDER });
    expect(result.body.reportDate).toBe(OLD_DAY);
    expect(reportRow(result, "POS")).toMatchObject({ thLuyKe: 20, achievedScore: 2 });
    expect(reportRow(result, "CUOC_N1_N3_RATE")).toMatchObject({ thLuyKe: 98, achievedScore: 7.57 });
    frozen("report-history-latest-cuoc", result);
  });

  it.each([{}, { reportDate: DAY }] as Record<string, string>[])("admin without selected CTV preserves all-row behavior %j", async (parameters) => {
    const result = await request("report", parameters);
    expect(result.status).toBe(200);
    expect(result.body.reportDate).toBe(parameters.reportDate || "2026-10-22");
    if (parameters.reportDate) expect(reportRow(result, "POS")).toMatchObject({ khThang: 1120, thLuyKe: 1110 });
    frozen(`report-admin-all-${parameters.reportDate || "latest"}`, result);
  });

  it.each([EMPTY_MANAGER, NO_DATES_MANAGER])("personal empty scope/date for %s", async (name) => {
    signIn("MANAGER", name);
    const result = await request("report");
    expect(result.body).toEqual(EMPTY_REPORT);
    frozen(`report-empty-${name}`, result);
  });

  it("personal unknown username has no latest date", async () => {
    const result = await request("report", { ctvUser: "fixture-missing" });
    expect(result.body).toEqual(EMPTY_REPORT);
    frozen("report-unknown-no-date", result);
  });

  it("explicit date without KPI rows keeps configured metrics and latest cuoc", async () => {
    const result = await request("report", { ctvUser: ALPHA, reportDate: "2026-01-01" });
    expect(reportRow(result, "POS")).toMatchObject({ khThang: 0, achievedScore: 0 });
    expect(result.body.totalAchievedScore).toBe(7.57);
    frozen("report-explicit-no-rows", result);
  });

  it("personal admin returns empty when no report dates exist", async () => {
    await execute('DELETE FROM "KpiDailyResult"');
    beforeFingerprint = await fingerprint();
    const result = await request("report");
    expect(result.body).toEqual(EMPTY_REPORT);
    frozen("report-no-dates", result);
  });
});

describe("managed synthetic SQLite KPI summary baseline", () => {
  it.each([undefined, "Sales", "  Sales  "])("first/explicit/trimmed group %s", async (group) => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: DAY, ...(group === undefined ? {} : { group }) });
    assertSummary(result);
    expect(result.body.rows).toEqual([{ ctvUser: ALPHA, kh: 100, th: 150, percent: 120, thieu: 0 }, { ctvUser: BETA, kh: 100, th: 40, percent: 40, thieu: 60 }]);
    expect(result.body).toMatchObject({ isNegativeGroup: false, maxPercent: 120 });
    frozen(`summary-sales-${group === undefined ? "first" : group === "Sales" ? "explicit" : "trimmed"}`, result);
  });

  it.each([
    ["Loss", true, 130, { kh: 10, th: 15, percent: 50, thieu: 5 }],
    ["Churn alias", true, 120, { kh: 10, th: 25, percent: 0, thieu: 15 }],
    ["Bundle", false, 150, { kh: 50, th: 55, percent: 110, thieu: 0 }],
    ["Zero target", false, 120, { kh: 0, th: 5, percent: 0, thieu: 0 }],
    ["Null values", false, 120, { kh: 0, th: 0, percent: 0, thieu: 0 }],
    ["Zero base", false, 120, { kh: 10, th: 20, percent: 120, thieu: 0 }],
    ["sales", false, 121, { kh: 8, th: 2, percent: 25, thieu: 6 }],
    ["Đồng hạng", true, 137, { kh: 10, th: 15, percent: 50, thieu: 5 }],
    ["Tie Alpha", false, 125, { kh: 4, th: 3, percent: 75, thieu: 1 }],
    ["Tie Zulu", false, 126, { kh: 4, th: 1, percent: 25, thieu: 3 }],
  ] as const)("full payload and explicit math for %s", async (group, isNegativeGroup, maxPercent, alpha) => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: DAY, group });
    assertSummary(result, [ALPHA, BETA], group);
    expect(result.body).toMatchObject({ isNegativeGroup, maxPercent });
    expect(result.body.rows[0]).toEqual({ ctvUser: ALPHA, ...alpha });
    if (group === "Bundle") expect(result.body.rows[1]).toEqual({ ctvUser: BETA, kh: 50, th: 6, percent: 12, thieu: 44 });
    if (group === "Null values") expect(result.body.rows[1]).toEqual({ ctvUser: BETA, kh: 20, th: 7, percent: 35, thieu: 13 });
    if (group === "Loss") expect(result.body.rows[1]).toEqual({ ctvUser: BETA, kh: 10, th: 1, percent: 130, thieu: 0 });
    frozen(`summary-group-${group}`, result);
  });

  it.each(["Unknown", "Hidden", "  Padded group  ", "SALES"])("raw metadata matching for unknown/disabled/padded/case group %s", async (group) => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: DAY, group });
    assertSummary(result, [ALPHA, BETA], group.trim());
    expect(result.body).toMatchObject({ isNegativeGroup: false, maxPercent: 120 });
    expect(result.body.rows).toEqual([ALPHA, BETA].map((ctvUser) => ({ ctvUser, kh: 0, th: 0, percent: 0, thieu: 0 })));
    expect(result.body.indicators.filter((indicator: string) => indicator === "Sales")).toHaveLength(2);
    frozen(`summary-raw-${group.trim()}`, result);
  });

  it("admin-all scope excludes orphan secondary-code rows and includes users without data", async () => {
    const result = await request("summary", { reportDate: DAY, group: "Sales" });
    assertSummary(result, ALL_USERS);
    expect(result.body.rows[2]).toEqual({ ctvUser: OUTSIDER, kh: 20, th: 20, percent: 100, thieu: 0 });
    expect(result.body.rows[3]).toEqual({ ctvUser: NO_DATES, kh: 0, th: 0, percent: 0, thieu: 0 });
    frozen("summary-admin-all", result);
  });

  it("admin manager filter resolves latest date only inside that manager scope", async () => {
    const result = await request("summary", { group: "Sales", managerCode: ` ${MANAGER} ` });
    assertSummary(result);
    expect(result.body.reportDate).toBe(DAY);
    frozen("summary-admin-manager-filter", result);
  });

  it("manager cannot expand scope through managerCode or secondaryCode", async () => {
    signIn("MANAGER");
    const result = await request("summary", { group: "Sales", managerCode: OTHER_MANAGER });
    assertSummary(result);
    expect(result.body.reportDate).toBe(DAY);
    frozen("summary-manager-tamper", result);
  });

  it("admin latest date is global, not the latest date shared by scoped users", async () => {
    const result = await request("summary", { group: "Sales" });
    assertSummary(result, ALL_USERS);
    expect(result.body.reportDate).toBe("2026-10-22");
    expect(result.body.rows[0].th).toBe(0);
    expect(result.body.rows[2].th).toBe(10);
    frozen("summary-admin-latest", result);
  });

  it.each([EMPTY_MANAGER, NO_DATES_MANAGER])("manager with no scoped users or dates %s", async (name) => {
    signIn("MANAGER", name);
    const result = await request("summary");
    expect(result.body).toEqual({ reportDate: null, indicators: [], rows: [] });
    frozen(`summary-empty-${name}`, result);
  });

  it("admin explicit date with no scoped users preserves its distinct empty shape", async () => {
    const result = await request("summary", { reportDate: DAY, managerCode: EMPTY_MANAGER });
    expect(result.body).toEqual({ reportDate: DAY, indicators: [], rows: [], isNegativeGroup: false, maxPercent: 120 });
    frozen("summary-no-scoped-users", result);
  });

  it("no report dates returns early before metadata and aggregation", async () => {
    await execute('DELETE FROM "KpiDailyResult"');
    beforeFingerprint = await fingerprint();
    const result = await request("summary");
    expect(result.body).toEqual({ reportDate: null, indicators: [], rows: [] });
    frozen("summary-no-dates", result);
  });

  it("disabled-all metadata has no first indicator but preserves config and defaults", async () => {
    await execute('UPDATE "KpiMetricConfig" SET isEnabled=0');
    beforeFingerprint = await fingerprint();
    const result = await request("summary", { reportDate: DAY });
    expect(result.body).toEqual({ reportDate: DAY, indicators: [], rows: [], isNegativeGroup: false, maxPercent: 120, selectedGroup: "" });
    frozen("summary-no-indicators", result);
  });
});

describe("cuoc summary date and whole-scope fallback", () => {
  it("same-date partial data does not backfill missing users with their latest cuoc", async () => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: DAY, group: "Cuoc synthetic" });
    assertSummary(result, [ALPHA, BETA], "Cuoc synthetic");
    expect(result.body.reportDate).toBe(DAY);
    frozen("cuoc-display-name-is-ordinary-group", result);
    const special = await request("summary", { reportDate: DAY, group: "CUOC_N1_N3_RATE" });
    assertSummary(special, [ALPHA, BETA], "CUOC_N1_N3_RATE");
    expect(special.body.reportDate).toBe(DAY);
    expect(special.body.rows).toEqual([{ ctvUser: ALPHA, kh: 89, th: 95.2, percent: 50, thieu: 0 }, { ctvUser: BETA, kh: 89, th: 0, percent: 0, thieu: 89 }]);
    frozen("cuoc-same-date-partial", special);
  });

  it("manager falls back once to the latest date of its whole scope", async () => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: OLD_DAY, group: "CUOC_N1_N3_RATE" });
    assertSummary(result, [ALPHA, BETA], "CUOC_N1_N3_RATE");
    expect(result.body.reportDate).toBe(CUOC_DAY);
    expect(result.body.rows).toEqual([{ ctvUser: ALPHA, kh: 89, th: 98, percent: 108.2, thieu: 0 }, { ctvUser: BETA, kh: 89, th: 99, percent: 116.39, thieu: 0 }]);
    frozen("cuoc-manager-fallback", result);
  });

  it("admin whole-scope fallback is not a latest-per-user merge", async () => {
    const result = await request("summary", { reportDate: OLD_DAY, group: "CUOC_N1_N3_RATE" });
    assertSummary(result, ALL_USERS, "CUOC_N1_N3_RATE");
    expect(result.body.reportDate).toBe("2026-10-24");
    expect(result.body.rows.map((row) => row.th)).toEqual([0, 0, 96, 0]);
    frozen("cuoc-admin-whole-scope-fallback", result);
  });

  it("admin manager-filtered fallback excludes later outside cuoc", async () => {
    const result = await request("summary", { reportDate: OLD_DAY, group: "CUOC_N1_N3_RATE", managerCode: MANAGER });
    assertSummary(result, [ALPHA, BETA], "CUOC_N1_N3_RATE");
    expect(result.body.reportDate).toBe(CUOC_DAY);
    frozen("cuoc-admin-manager-fallback", result);
  });

  it("no cuoc data keeps requested date and zero rows for the scoped usernames", async () => {
    signIn("MANAGER", NO_DATES_MANAGER);
    const result = await request("summary", { reportDate: DAY, group: "CUOC_N1_N3_RATE" });
    assertSummary(result, [NO_DATES], "CUOC_N1_N3_RATE");
    expect(result.body.reportDate).toBe(DAY);
    expect(result.body.rows).toEqual([{ ctvUser: NO_DATES, kh: 89, th: 0, percent: 0, thieu: 89 }]);
    frozen("cuoc-no-data", result);
  });

  it("same-date null completion counts as present and does not trigger fallback", async () => {
    signIn("MANAGER");
    const result = await request("summary", { reportDate: "2026-10-18", group: "CUOC_N1_N3_RATE" });
    expect(result.body.reportDate).toBe("2026-10-18");
    expect(result.body.rows.map((row) => row.th)).toEqual([0, 0]);
    frozen("cuoc-null-present", result);
  });
});

describe("read-only authorization and real cold/warm caching", () => {
  it.each(["report", "summary"] as const)("unauthenticated %s does not access storage", async (endpoint) => {
    state.auth.mockResolvedValue(null);
    const result = await request(endpoint);
    expect(result.status).toBe(401);
    expect(result.queries).toEqual([]);
    frozen(`unauthenticated-${endpoint}`, result);
  });

  it("CTV summary is forbidden before schema or business queries", async () => {
    signIn("CTV");
    const result = await request("summary", { reportDate: DAY });
    expect(result.status).toBe(403);
    expect(result.queries).toEqual([]);
    frozen("ctv-summary-forbidden", result);
  });

  it.each(["ADMIN", "MANAGER", "CTV"] as const)("personal cold/warm real cache for %s", async (role) => {
    signIn(role);
    const cold = await request("report", { reportDate: DAY, ctvUser: ALPHA });
    const warm = await request("report", { reportDate: DAY, ctvUser: ALPHA });
    assertAlpha(cold);
    expect(warm.body).toEqual(cold.body);
    expect(cold.timing).toContain('desc="miss"');
    expect(warm.timing).toContain('desc="hit"');
    expect(cold.queries.some((query) => /sqlite_master/.test(query.sql))).toBe(true);
    expect(cold.queries.some((query) => /LEFT JOIN "KpiDailyResult"/.test(query.sql))).toBe(true);
    expect(cold.queries.filter((query) => query.operation === "user.findMany")).toHaveLength(role === "MANAGER" ? 1 : 0);
    expect(warm.queries).toEqual([]);
    frozen(`cache-report-${role}`, cold);
  });

  it.each(["ADMIN", "MANAGER"] as const)("normal summary explicit-date cold/cachehit for %s", async (role) => {
    signIn(role);
    const parameters = { reportDate: DAY, group: "Sales" };
    const cold = await request("summary", parameters);
    const warm = await request("summary", parameters);
    assertSummary(cold, role === "ADMIN" ? ALL_USERS : [ALPHA, BETA]);
    expect(warm.body).toEqual(cold.body);
    expect(cold.timing).toContain('desc="miss"');
    expect(warm.timing).toContain('desc="hit"');
    expect(cold.queries.some((query) => /sqlite_master/.test(query.sql))).toBe(true);
    expect(cold.queries.filter((query) => query.operation === "user.findMany")).toHaveLength(1);
    expect(warm.queries).toEqual([]);
    const metadata = cold.queries.filter((query) => /FROM "KpiMetricConfig"/.test(query.sql) && !/requirement/.test(query.sql));
    expect(metadata.length).toBeGreaterThan(0);
    console.log("BATCH4_QUERY_OBSERVATION", JSON.stringify({ role, coldQueries: cold.queries.length, warmQueries: warm.queries.length, metadataQueries: metadata.length, metadataRows: metadata.reduce((sum, query) => sum + query.rows, 0), rawRows: cold.queries.reduce((sum, query) => sum + query.rows, 0) }));
    frozen(`cache-summary-${role}`, cold);
  });

  it("personal cache keys remain isolated by role and session name", async () => {
    for (const role of ["ADMIN", "MANAGER", "CTV"] as const) {
      signIn(role);
      const result = await request("report", { reportDate: DAY, ctvUser: ALPHA });
      assertAlpha(result);
      expect(result.timing).toContain('desc="miss"');
      expect(result.queries.some((query) => /LEFT JOIN "KpiDailyResult"/.test(query.sql))).toBe(true);
    }
    signIn("CTV", BETA);
    const beta = await request("report", { reportDate: DAY, ctvUser: ALPHA });
    expect(beta.timing).toContain('desc="miss"');
    expect(new Set(beta.body.rows.map((row) => row.ctvUser))).toEqual(new Set([BETA]));
    frozen("cache-isolated-beta", beta);
  });

  it("summary role/session/filter cache isolation retains separate scope", async () => {
    const parameters = { reportDate: DAY, group: "Sales" };
    const admin = await request("summary", parameters);
    assertSummary(admin, ALL_USERS);
    signIn("MANAGER");
    const manager = await request("summary", parameters);
    assertSummary(manager);
    expect(manager.timing).toContain('desc="miss"');
    signIn("MANAGER", OTHER_MANAGER);
    const other = await request("summary", parameters);
    assertSummary(other, [OUTSIDER]);
    expect(other.timing).toContain('desc="miss"');
    signIn("ADMIN");
    const filtered = await request("summary", { ...parameters, managerCode: MANAGER });
    assertSummary(filtered);
    expect(filtered.timing).toContain('desc="miss"');
    frozen("cache-summary-other-manager", other);
    frozen("cache-summary-filtered-admin", filtered);
  });
});
