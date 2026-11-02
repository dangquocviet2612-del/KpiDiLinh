import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), audit: vi.fn(), scope: vi.fn(), auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findMany: state.findMany, findFirst: state.findFirst, create: state.create }, editHistory: { create: vi.fn() } } }));
vi.mock("@/lib/scope", () => ({ getAccessibleCtvCodes: state.scope }));
vi.mock("@/lib/audit", () => ({ recordAuditLog: state.audit }));
vi.mock("@/lib/ensure-customer-schema", () => ({ ensureCustomerSchema: vi.fn() }));
vi.mock("@/lib/customer-node-mapping", () => ({ getMappedNodeNameForAccount: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/nodeUtils", () => ({ findNearestNodeName: vi.fn() }));
vi.mock("@/lib/kpi-cache", () => ({ getCache: vi.fn(), getCacheGeneration: vi.fn(), setCache: vi.fn(), clearCacheByPrefix: vi.fn() }));
const row = { id: "existing", name: "Same Name", account: null, phone: "0901234567", ctvCode: "allowed", latitude: 10, longitude: 106 };
const input = { name: row.name, account: "new-account", latitude: 10, longitude: 106, ctvCode: "allowed" };
async function post(body: unknown) {
 const { POST } = await import("@/app/api/customers/route");
 return POST(new Request("http://localhost/api/customers", { method: "POST", body: JSON.stringify(body) }));
}
beforeEach(() => {
 vi.clearAllMocks();
 state.auth.mockResolvedValue({ user: { id: "u1", name: "allowed", role: "CTV" } });
 state.scope.mockResolvedValue(["allowed"]);
 state.findFirst.mockResolvedValue(null);
 state.findMany.mockImplementation(async ({ where }) => [row, { ...row, id: "hidden", ctvCode: "other" }].filter(r => !where.ctvCode || where.ctvCode.in.includes(r.ctvCode)));
 state.create.mockResolvedValue({ id: "created", ...input });
});
describe("POST duplicate guard", () => {
 it("returns scoped minimal candidates without any write", async () => {
  const response = await post(input);
  expect(response.status).toBe(409);
  const data = await response.json();
  expect(data.code).toBe("CUSTOMER_POSSIBLE_DUPLICATE");
  expect(data.candidates.map((r: {id: string}) => r.id)).toEqual(["existing"]);
  expect(data.candidates[0]).not.toHaveProperty("latitude");
  expect(state.findMany).toHaveBeenCalledWith({ where: { ctvCode: { in: ["allowed"] } }, select: { id: true, name: true, account: true, ctvCode: true, phone: true, latitude: true, longitude: true } });
  expect(state.create).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
 });
 it.each([null, {}, {reason: " " , candidateIds: ["existing"]}, {reason: "Valid reason", candidateIds: "existing"}])("rejects malformed confirmation %j without write", async duplicateConfirmation => {
  expect((await post({ ...input, duplicateConfirmation })).status).toBe(422);
  expect(state.create).not.toHaveBeenCalled();
 });
 it.each([{candidateIds:["other"]}, {candidateIds:[]}, {candidateIds:["existing", "hidden"]}, {candidateIds:["existing", "existing"]}])("rechecks exact candidate IDs %j without write", async ({candidateIds}) => {
  expect((await post({ ...input, duplicateConfirmation: { reason: "Different household", candidateIds } })).status).toBe(409);
  expect(state.create).not.toHaveBeenCalled();
 });
 it("creates only after confirmation and audits recomputed candidate IDs", async () => {
  const response = await post({ ...input, duplicateConfirmation: { reason: "  Different household  ", candidateIds: ["existing"] } });
  expect(response.status).toBe(201);
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CUSTOMER_DUPLICATE_OVERRIDE", details: { customerId: "created", candidateIds: ["existing"], reason: "Different household" } }));
  expect(state.create.mock.invocationCallOrder[0]).toBeLessThan(state.audit.mock.invocationCallOrder[0]);
 });
 it("preserves global exact account block even with confirmed suspects", async () => {
  state.findFirst.mockResolvedValue({ id: "anywhere" });
  expect((await post({ ...input, duplicateConfirmation: { reason: "Different household", candidateIds: ["existing"] } })).status).toBe(400);
  expect(state.create).not.toHaveBeenCalled();
 });
 it("does not warn for out-of-scope customers", async () => {
  state.scope.mockResolvedValue(["empty-scope"]);
  expect((await post({ ...input, ctvCode: "empty-scope" })).status).toBe(201);
 });
 it("checks duplicate phone even for other names", async () => {
  expect((await post({ ...input, name: "Different Name", phone: "+84 901.234.567" })).status).toBe(409);
 });
 it("rejects unauthenticated requests before any candidate read", async () => {
  state.auth.mockResolvedValue(null);
  expect((await post(input)).status).toBe(401);
  expect(state.findMany).not.toHaveBeenCalled();
 });
});
