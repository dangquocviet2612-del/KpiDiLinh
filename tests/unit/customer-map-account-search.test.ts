import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { role: "ADMIN", name: "search-test" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findMany: mocks.findMany } } }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/ensure-customer-schema", () => ({ ensureCustomerSchema: vi.fn() }));

it("retains an account matching a middle/suffix query without other matching fields", async () => {
  mocks.findMany.mockResolvedValue([{ id: "suffix-account", account: "l063_gftth_thangtv18", name: "Customer", latitude: 11, longitude: 108 }]);
  const { GET } = await import("@/app/api/customers/search-map/route");
  const response = await GET(new Request("http://localhost/api/customers/search-map?q=thangtv18"));
  expect(response.status).toBe(200);
  expect((await response.json()).items).toEqual([expect.objectContaining({ id: "suffix-account" })]);
  expect(mocks.findMany.mock.calls[0][0].take).toBeUndefined();
  expect(mocks.findMany.mock.calls[1][0].where.id).toEqual({ in: ["suffix-account"] });
});
