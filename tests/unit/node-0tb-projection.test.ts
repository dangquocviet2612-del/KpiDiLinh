import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node0TbApiResponse, Node0TbItem } from "@/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  findNodes: vi.fn(),
  ensureRuntimeSchema: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.query,
    $executeRawUnsafe: mocks.execute,
    $transaction: mocks.transaction,
    node: { findMany: mocks.findNodes },
  },
}));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.ensureRuntimeSchema }));

import { GET } from "@/app/api/node-0tb/route";
import { getNode0TbList } from "@/lib/node-0tb-db";

const rows = [
  { id: "exact\"'<>&", nodeCode: "FIXTURE-A-SP1", categoryKd: "Group <A> & \"0\"", totalPort: 0 },
  { id: "base", nodeCode: "FIXTURE-B-SP2", categoryKd: "Group <A> & \"0\"", totalPort: 16 },
  { id: "prefix", nodeCode: "FIXTURE-C", categoryKd: "Group B", totalPort: null },
  { id: "missing", nodeCode: "FIXTURE-D", categoryKd: null, totalPort: null },
].map((row) => Object.freeze({
  dateKd: null,
  dateKdRaw: "28/10/<2026> & \"raw\"",
  dateKdFormatted: null,
  usedPort: null,
  note: "unused <script>fixture</script> & \"note\"",
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T01:00:00.000Z",
  ...row,
}));

const coordinateRows = [
  { name: "FIXTURE-A", latitude: 41, longitude: 42, description: "losing base" },
  { name: "fixture-a-sp1", latitude: 0, longitude: 0, description: "exact winner <only>" },
  { name: "fixture-b", latitude: 5, longitude: 6, description: "base winner" },
  { name: "FIXTURE-C-EXT", latitude: 7, longitude: 8, description: "prefix winner" },
  { name: "FIXTURE-D", latitude: null, longitude: 9, description: "invalid coordinate" },
];

const expectedStats = {
  total: 4,
  withCoords: 3,
  withoutCoords: 1,
  categories: [
    { category: "Group <A> & \"0\"", count: 2, withCoords: 2 },
    { category: "Group B", count: 1, withCoords: 1 },
    { category: "Chưa phân loại", count: 1, withCoords: 0 },
  ],
};
const expectedCategories = expectedStats.categories.map((entry) => entry.category);
const mapFields = ["id", "nodeCode", "dateKdFormatted", "totalPort", "categoryKd", "latitude", "longitude", "hasCoordinates"];

function allowlist(item: Node0TbItem) {
  return {
    id: item.id,
    nodeCode: item.nodeCode,
    dateKdFormatted: item.dateKdFormatted,
    totalPort: item.totalPort,
    categoryKd: item.categoryKd,
    latitude: item.latitude,
    longitude: item.longitude,
    hasCoordinates: item.hasCoordinates,
  };
}

function request(query = "") {
  return GET(new Request(`http://localhost/api/node-0tb${query}`));
}

function expectSingleRead() {
  expect(mocks.auth).toHaveBeenCalledExactlyOnceWith();
  expect(mocks.ensureRuntimeSchema).toHaveBeenCalledExactlyOnceWith("node0tb");
  expect(mocks.query).toHaveBeenCalledExactlyOnceWith('SELECT * FROM "Node0Tb" ORDER BY "nodeCode" ASC');
  expect(mocks.findNodes).toHaveBeenCalledExactlyOnceWith({
    select: { name: true, latitude: true, longitude: true, description: true },
  });
  expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.ensureRuntimeSchema.mock.invocationCallOrder[0]);
  expect(mocks.ensureRuntimeSchema.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[0]);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { name: "fixture-admin", role: "ADMIN" } });
  mocks.ensureRuntimeSchema.mockResolvedValue(undefined);
  mocks.query.mockResolvedValue(rows);
  mocks.findNodes.mockResolvedValue(coordinateRows);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("opt-in Node0Tb map projection", () => {
  it("returns exactly eight fields with unchanged values, order, matching, full stats and categories", async () => {
    const response = await request("?projection=map");
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({
      nodes: rows.map((row, index) => ({
        id: row.id,
        nodeCode: row.nodeCode,
        dateKdFormatted: row.dateKdRaw,
        totalPort: row.totalPort,
        categoryKd: row.categoryKd || "Chưa phân loại",
        latitude: [0, 5, 7, null][index],
        longitude: [0, 6, 8, null][index],
        hasCoordinates: index < 3,
      })),
      stats: expectedStats,
      categories: expectedCategories,
    });
    for (const item of data.nodes) expect(Object.keys(item)).toEqual(mapFields);
    expectSingleRead();
  });

  it("uses a pure allowlist mapper without mutating frozen data or forwarding future metadata", async () => {
    const response = await request("?projection=map");
    const projected = await response.json();
    expect(Object.keys(projected.nodes[0])).toEqual(mapFields);
    expectSingleRead();
    const legacy = await getNode0TbList();
    const input = {
      nodes: legacy.nodes.map((node, index) => Object.freeze({
        ...node,
        dateKdFormatted: index === 0 ? null : node.dateKdFormatted,
        categoryKd: index === 0 ? null : node.categoryKd,
        futureMetadata: { privateValue: "fixture-only" },
      })),
      stats: legacy.stats,
      categories: legacy.categories,
      futureResponseMetadata: "fixture-only",
    };
    Object.freeze(input.nodes);
    for (const category of input.stats.categories) Object.freeze(category);
    Object.freeze(input.stats.categories);
    Object.freeze(input.stats);
    Object.freeze(input.categories);
    Object.freeze(input);
    const before = JSON.stringify(input);
    const { projectNode0TbMapData } = await vi.importActual<{
      projectNode0TbMapData: (data: Node0TbApiResponse) => { nodes: ReturnType<typeof allowlist>[]; stats: Node0TbApiResponse["stats"]; categories: string[] };
    }>("@/lib/node-0tb-map");
    const result = projectNode0TbMapData(input);
    expect(result).toEqual({ nodes: input.nodes.map(allowlist), stats: input.stats, categories: input.categories });
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toBe(input);
    expect(result.nodes).not.toBe(input.nodes);
    result.nodes.forEach((node, index) => {
      expect(node).not.toBe(input.nodes[index]);
      expect(Object.keys(node)).toEqual(mapFields);
    });
    expect(result.nodes[0]).toMatchObject({ dateKdFormatted: null, categoryKd: null, totalPort: 0, latitude: 0, longitude: 0 });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.findNodes).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["description", { search: "EXACT WINNER <only>" }, ["exact\"'<>&"]],
    ["category", { category: "group b" }, ["prefix"]],
    ["combined", { search: "base winner", category: "group <a> & \"0\"" }, ["base"]],
    ["ALL", { category: "ALL", search: "fixture" }, rows.map((row) => row.id)],
    ["no matches", { search: "absent-description" }, []],
  ])("preserves %s filtering before projection with unfiltered stats and categories", async (_label, filters, expectedIds) => {
    const params = new URLSearchParams({ projection: "map", ...filters });
    const response = await request(`?${params}`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.nodes.map((node: { id: string }) => node.id)).toEqual(expectedIds);
    for (const item of data.nodes) expect(Object.keys(item)).toEqual(mapFields);
    expect(data.stats).toEqual(expectedStats);
    expect(data.categories).toEqual(expectedCategories);
    expectSingleRead();
  });

  it.each(["", "?projection=", "?projection=MAP", "?projection=Map", "?projection=unknown", "?projection=%20map", "?projection=map%20", "?projection=maps", "?projection=MAP&projection=map"])("retains the exact legacy result for %s", async (query) => {
    const legacy = await getNode0TbList({ search: undefined, category: undefined });
    mocks.query.mockClear();
    mocks.findNodes.mockClear();
    mocks.ensureRuntimeSchema.mockClear();
    const response = await request(query);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(legacy);
    expectSingleRead();
  });

  it("keeps search/category options identical on the legacy endpoint", async () => {
    const response = await request("?search=base+winner&category=group+%3Ca%3E+%26+%220%22&projection=unknown");
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.nodes.map((node: { id: string }) => node.id)).toEqual(["base"]);
    expect(data.nodes[0]).toMatchObject({ nodeDescription: "base winner", note: rows[1].note, usedPort: 0, createdAt: rows[1].createdAt });
    expect(data.stats).toEqual(expectedStats);
    expect(data.categories).toEqual(expectedCategories);
    expectSingleRead();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("retains existing %s read access", async (role) => {
    mocks.auth.mockResolvedValue({ user: { name: "fixture-user", role } });
    const response = await request("?projection=map");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.nodes).toHaveLength(4);
    expect(Object.keys(data.nodes[0])).toEqual(mapFields);
    expectSingleRead();
  });

  it.each([null, {}])("rejects missing authenticated user %j before readiness or DB access", async (session) => {
    mocks.auth.mockResolvedValue(session);
    const response = await request("?projection=map");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.ensureRuntimeSchema).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.findNodes).not.toHaveBeenCalled();
  });

  it("returns readiness failure 500 without reading or exposing data", async () => {
    mocks.ensureRuntimeSchema.mockRejectedValue(new Error("fixture readiness failure"));
    const response = await request("?projection=map");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fixture readiness failure" });
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.findNodes).not.toHaveBeenCalled();
  });

  it.each(["query", "findNodes"] as const)("returns %s read failure 500 without partial data", async (boundary) => {
    mocks[boundary].mockRejectedValue(new Error("fixture read failure"));
    const response = await request("?projection=map");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fixture read failure" });
    expect(mocks.query).toHaveBeenCalledOnce();
    if (boundary === "query") expect(mocks.findNodes).not.toHaveBeenCalled();
    else expect(mocks.findNodes).toHaveBeenCalledOnce();
  });

  it("preserves the empty response with one SELECT and one coordinate lookup", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.findNodes.mockResolvedValue([]);
    const response = await request("?projection=map");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nodes: [], stats: { total: 0, withCoords: 0, withoutCoords: 0, categories: [] }, categories: [],
    });
    expectSingleRead();
  });
});
