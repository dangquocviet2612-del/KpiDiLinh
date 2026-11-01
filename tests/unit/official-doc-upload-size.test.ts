import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/official-documents/upload/route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), createAsset: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/official-doc-assets", () => ({ createTempOfficialDocAsset: mocks.createAsset }));

const cap = 4_000_000;
const message = "Tệp đính kèm tối đa 4 MB trên web. Vui lòng chọn tệp nhỏ hơn; với video, hãy dùng chức năng thêm link video.";
const item = { tempId: "fixture-asset", type: "FILE", fileUrl: "/api/official-documents/assets/temp/fixture-asset", fileName: "fixture.pdf", mimeType: "application/pdf", size: 100, storageKind: "INLINE" };
const fileTypes = ["application/pdf", "image/png", "video/mp4"];

function fixtureFile(size: number, type = "application/pdf") {
  const file = new File(["fixture"], "fixture-attachment", { type });
  Object.defineProperty(file, "size", { value: size });
  const arrayBuffer = vi.spyOn(file, "arrayBuffer");
  return { file, arrayBuffer };
}

function requestFor(file: File | string | null) {
  const formData = vi.fn().mockResolvedValue({ get: () => file });
  return { request: { formData } as unknown as Request, formData };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL", "1");
  mocks.auth.mockResolvedValue({ user: { id: "fixture-admin", role: "ADMIN" } });
  mocks.createAsset.mockReset().mockResolvedValue(item);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("official document hosted upload size", () => {
  it.each([...fileTypes, ""])("rejects oversized MIME %s before invoking asset storage", async (type) => {
    const { file, arrayBuffer } = fixtureFile(cap + 1, type);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: message });
    expect(mocks.createAsset).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  describe.each(fileTypes)("MIME %s", (type) => {
    it.each([cap - 1, cap])("delegates allowed boundary %s with the existing response shape", async (size) => {
      const { file } = fixtureFile(size, type);
      const response = await POST(requestFor(file).request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ item });
      expect(mocks.createAsset).toHaveBeenCalledExactlyOnceWith(file);
    });
  });

  describe.each([undefined, "0", "true"])("non-Vercel flag %s", (flag) => {
    it.each(["application/pdf", "video/mp4"])("keeps files above4MB allowed by the old %s policy", async (type) => {
      vi.stubEnv("VERCEL", flag);
      const { file } = fixtureFile(cap + 1, type);
      expect((await POST(requestFor(file).request)).status).toBe(200);
      expect(mocks.createAsset).toHaveBeenCalledExactlyOnceWith(file);
    });
  });

  describe.each([{ type: "application/pdf", megabytes: 20 }, { type: "video/mp4", megabytes: 200 }])("local $type legacy cap", ({ type, megabytes }) => {
    it("still accepts exactly the previous binary-byte boundary", async () => {
      vi.stubEnv("VERCEL", undefined);
      const { file } = fixtureFile(megabytes * 1024 * 1024, type);
      expect((await POST(requestFor(file).request)).status).toBe(200);
      expect(mocks.createAsset).toHaveBeenCalledExactlyOnceWith(file);
    });

    it("retains the old400 and message above that boundary", async () => {
      vi.stubEnv("VERCEL", undefined);
      const { file, arrayBuffer } = fixtureFile(megabytes * 1024 * 1024 + 1, type);
      const response = await POST(requestFor(file).request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: `File vượt quá ${megabytes}MB` });
      expect(mocks.createAsset).not.toHaveBeenCalled();
      expect(arrayBuffer).not.toHaveBeenCalled();
    });
  });

  it("does not trust the public local cap0 on the hosted server", async () => {
    vi.stubEnv("NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES", "0");
    const { file } = fixtureFile(cap + 1);
    expect((await POST(requestFor(file).request)).status).toBe(413);
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it("keeps anonymous401 before multipart parsing", async () => {
    mocks.auth.mockResolvedValue(null);
    const { request, formData } = requestFor(fixtureFile(cap + 1).file);
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Bạn không có quyền thực hiện thao tác này" });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it.each(["MANAGER", "CTV"])("keeps role%s403 before multipart parsing", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    const { request, formData } = requestFor(fixtureFile(cap + 1).file);
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Chỉ ADMIN mới được tải tệp công văn" });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it.each([null, "not a file"])("preserves missing/wrong File400 for%s", async (file) => {
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Vui lòng chọn file để tải lên" });
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it("preserves an asset-service failure without returning a success item", async () => {
    mocks.createAsset.mockRejectedValue(new Error("Fixture storage failure"));
    const { file } = fixtureFile(100);
    const response = await POST(requestFor(file).request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Fixture storage failure" });
    expect(mocks.createAsset).toHaveBeenCalledExactlyOnceWith(file);
  });
});
