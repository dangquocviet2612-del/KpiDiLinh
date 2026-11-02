import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), scope: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { role: "CTV", name: "unicode-test" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findMany: state.findMany, count: state.count } } }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: state.scope }));
vi.mock("@/lib/ensure-customer-schema", () => ({ ensureCustomerSchema: vi.fn() }));
vi.mock("@/lib/customer-node-mapping", () => ({ getMappedNodeNamesByAccounts: vi.fn().mockResolvedValue(new Map()), normalizeCustomerAccountKey: (s: string) => s }));
vi.mock("@/lib/nodeUtils", () => ({ findNearestNodeName: vi.fn() }));
vi.mock("@/lib/kpi-cache", () => ({ getCache: vi.fn(), getCacheGeneration: vi.fn(), setCache: vi.fn(), clearCacheByPrefix: vi.fn() }));
const rows = ["HUYỀN", "Huyền", "huyền", "TrẦn tHị HuYềN", "HUYỀN".normalize("NFD")].map((name, i) => ({ id: String(i), name, account: `acc${i}`, phone: "0901234567", ctvCode: "allowed", status: "Hoạt động", latitude: 11, longitude: 108 }));
rows.push({ ...rows[0], id: "hidden", ctvCode: "other" });
function matches(row: any, where: any): boolean {
  return Object.entries(where || {}).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((part: any) => matches(row, part));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("contains" in value) return String(row[key] || "").replace(/[A-Z]/g, c => c.toLowerCase()).includes(value.contains.replace(/[A-Z]/g, (c: string) => c.toLowerCase()));
      if ("not" in value) return row[key] !== value.not;
    }
    return row[key] === value;
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.scope.mockResolvedValue(["allowed"]);
  state.findMany.mockImplementation(async ({ where, skip = 0, take }: any) => rows.filter(row => matches(row, where)).slice(skip, take == null ? undefined : skip + take));
  state.count.mockImplementation(async ({ where }: any) => rows.filter(row => matches(row, where)).length);
});
it.each(["HUYỀN", "Huyền", "huyền", "huyền".normalize("NFD")])("list matches Unicode casing %s before counts and pagination", async query => {
  const { GET } = await import("@/app/api/customers/route");
  const response = await GET(new Request(`http://localhost/api/customers?search=${encodeURIComponent(query)}&limit=2&page=2`));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: [{ id: "2" }, { id: "3" }], total: 5, totalPages: 3 });
});
it.each(["HUYỀN", "Huyền", "huyền"])("map matches Unicode casing %s before candidate limit", async query => {
  const { GET } = await import("@/app/api/customers/search-map/route");
  const response = await GET(new Request(`http://localhost/api/customers/search-map?q=${encodeURIComponent(query)}&limit=50`));
  expect(response.status).toBe(200);
  expect((await response.json()).items.map((item: any) => item.id).sort()).toEqual(["0", "1", "2", "3", "4"]);
  expect(state.findMany.mock.calls[0][0].take).toBeUndefined();
  const finalRead = state.findMany.mock.calls.at(-1)![0];
  expect(finalRead.where.id.in).toHaveLength(5);
  expect(finalRead.take).toBe(100);
});
it.each(["acc3", "0901234567"])("preserves map account and phone matches %s", async query => {
  const { GET } = await import("@/app/api/customers/search-map/route");
  const response = await GET(new Request(`http://localhost/api/customers/search-map?q=${query}`));
  expect((await response.json()).items.length).toBeGreaterThan(0);
});
