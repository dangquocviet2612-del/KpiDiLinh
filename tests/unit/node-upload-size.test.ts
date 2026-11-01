import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/nodes/upload/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), readWorkbook: vi.fn(), rows: vi.fn(), nodes: vi.fn(), transaction: vi.fn(), createMany: vi.fn(), update: vi.fn(), execute: vi.fn(), ensureEfficiency: vi.fn(), ensureMapping: vi.fn(), upsertMapping: vi.fn(), syncMapping: vi.fn(), invalidate: vi.fn(), nearest: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("xlsx", () => ({ read: mocks.readWorkbook, utils: { sheet_to_json: mocks.rows } }));
vi.mock("@/lib/prisma", () => ({ prisma: { node: { findMany: mocks.nodes }, $transaction: mocks.transaction, $executeRawUnsafe: mocks.execute } }));
vi.mock("@/lib/node-efficiency-db", () => ({ ensureNodeEfficiencyColumns: mocks.ensureEfficiency }));
vi.mock("@/lib/customer-node-mapping-db", () => ({ ensureCustomerNodeMappingTable: mocks.ensureMapping }));
vi.mock("@/lib/customer-node-mapping", () => ({ upsertCustomerNodeMappings: mocks.upsertMapping, syncMappedNodesToCustomersByAccounts: mocks.syncMapping }));
vi.mock("@/lib/cache-tags", () => ({ invalidateCacheForMutation: mocks.invalidate }));
vi.mock("@/lib/nodeUtils", () => ({ invalidateNearestNodeCache: mocks.nearest }));

const cap = 4_000_000;
const message = "File tối đa 4 MB cho mỗi lần import Node trên web. Hãy chia nhỏ file rồi thử lại.";
const kml = '<kml><Document><Placemark><name>fixture-node</name><Point><coordinates>107.9,11.5,0</coordinates></Point></Placemark></Document></kml>';

function fixtureFile(size: number, extension = "xlsx", content: Uint8Array = Buffer.from(kml)) {
  const bytes = Uint8Array.from(content);
  const file = new File([bytes], "fixture-node." + extension);
  Object.defineProperty(file, "size", { value: size });
  const arrayBuffer = vi.spyOn(file, "arrayBuffer").mockResolvedValue(bytes.buffer);
  return { file, arrayBuffer };
}

function requestFor(file: File | string | null) {
  const formData = vi.fn().mockResolvedValue({ get: () => file });
  return { request: { formData } as unknown as Request, formData };
}

function expectNoBusinessAccess() {
  for (const mock of [mocks.nodes, mocks.transaction, mocks.createMany, mocks.update, mocks.execute, mocks.ensureEfficiency, mocks.ensureMapping, mocks.upsertMapping, mocks.syncMapping, mocks.invalidate, mocks.nearest]) expect(mock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "1");
  mocks.auth.mockResolvedValue({ user: { id: "fixture-admin", role: "ADMIN" } });
  mocks.readWorkbook.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
  mocks.rows.mockReturnValue([]);
  mocks.nodes.mockResolvedValue([]);
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.execute.mockResolvedValue(1);
  mocks.transaction.mockImplementation(async (operation: (transaction: { node: { createMany: typeof mocks.createMany; update: typeof mocks.update } }) => Promise<void>) => operation({ node: { createMany: mocks.createMany, update: mocks.update } }));
  mocks.upsertMapping.mockResolvedValue({ total: 1, inserted: 1, updated: 0, changedAccountKeys: ["fixture-account"] });
  mocks.syncMapping.mockResolvedValue(1);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("node upload hosted file-size gate", () => {
  it.each(["kml", "kmz", "xlsx", "xls"])("rejects oversized %s before reading, parsing or business access", async (extension) => {
    const { file, arrayBuffer } = fixtureFile(cap + 1, extension);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: message });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.readWorkbook).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([cap - 1, cap])("passes boundary %s to the unchanged Excel parser", async (size) => {
    const { file, arrayBuffer } = fixtureFile(size);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "File Excel rỗng hoặc không hợp lệ." });
    expect(arrayBuffer).toHaveBeenCalledOnce();
    expect(mocks.readWorkbook).toHaveBeenCalledWith(expect.any(Buffer), { type: "buffer", dense: true });
    expectNoBusinessAccess();
  });

  it.each([undefined, "0", "true"])("preserves prior non-Vercel behavior for flag %s", async (flag) => {
    vi.stubEnv("VERCEL", flag);
    const { file, arrayBuffer } = fixtureFile(cap + 1);
    expect((await POST(requestFor(file).request)).status).toBe(400);
    expect(arrayBuffer).toHaveBeenCalledOnce();
    expect(mocks.readWorkbook).toHaveBeenCalledOnce();
    expectNoBusinessAccess();
  });

  it("keeps runtime enforcement independent from public cap0", async () => {
    vi.stubEnv("NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES", "0");
    const { file, arrayBuffer } = fixtureFile(cap + 1);
    expect((await POST(requestFor(file).request)).status).toBe(413);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([null, "MANAGER", "CTV"])("retains admin auth before reading body for role %s", async (role) => {
    mocks.auth.mockResolvedValue(role ? { user: { role } } : null);
    const { file, arrayBuffer } = fixtureFile(cap + 1);
    const { request, formData } = requestFor(file);
    expect((await POST(request)).status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it.each([null, "not a file"])("retains missing/wrong File400 for %s", async (file) => {
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Vui lòng chọn file để tải lên." });
    expect(mocks.readWorkbook).not.toHaveBeenCalled();
    expectNoBusinessAccess();
  });

  it("preserves the unsupported extension400 for an in-limit file", async () => {
    const { file } = fixtureFile(100, "txt");
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Chỉ hỗ trợ file KML, KMZ, XLSX hoặc XLS." });
    expectNoBusinessAccess();
  });

  it.each(["kml", "kmz"])("preserves a normal %s position import through real XML/ZIP parsing", async (extension) => {
    const archive = new AdmZip();
    archive.addFile("doc.kml", Buffer.from(kml));
    const { file } = fixtureFile(100, extension, extension === "kmz" ? archive.toBuffer() : Buffer.from(kml));
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mode: "NODE_POSITIONS", message: "Cập nhật vị trí node thành công.", totalRows: 1, created: 1, updated: 0 });
    expect(mocks.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ name: "fixture-node", latitude: 11.5, longitude: 107.9 })] });
    expect(mocks.nearest).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("nodes");
  });

  it("preserves successful efficiency mapping, write and invalidation", async () => {
    mocks.rows.mockReturnValue([["NODE_CODE", "TOTAL_INT_PORT", "USED_PORT", "PORT_EFFICIENCY"], ["fixture-node", "8", "2", "25"]]);
    mocks.nodes.mockResolvedValue([{ id: "fixture-node-id", name: "fixture-node" }]);
    const { file } = fixtureFile(100);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mode: "NODE_EFFICIENCY", message: "Import hiệu suất node thành công.", totalRows: 1, updated: 1, notMatched: 0, notMatchedSamples: [], errors: [] });
    expect(mocks.ensureEfficiency).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledWith(expect.any(String), 8, 2, 25, null, null, "fixture-node-id");
    expect(mocks.invalidate).toHaveBeenCalledWith("nodes");
  });

  it("preserves successful account-node mapping and customer sync", async () => {
    mocks.rows.mockReturnValue([["Account", "Node", "Address"], ["fixture-account", "fixture-node", "Fixture Address"]]);
    const { file } = fixtureFile(100);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mode: "ACCOUNT_NODE_MAP", message: "Cập nhật dữ liệu node thuê bao thành công.", totalRows: 1, imported: 1, inserted: 1, updated: 0, syncedCustomers: 1, errors: [] });
    expect(mocks.ensureMapping).toHaveBeenCalledOnce();
    expect(mocks.upsertMapping).toHaveBeenCalledWith([{ account: "fixture-account", nodeName: "fixture-node", accountAddress: "Fixture Address" }], expect.any(Function));
    expect(mocks.syncMapping).toHaveBeenCalledWith(["fixture-account"], expect.any(Function));
  });
});
