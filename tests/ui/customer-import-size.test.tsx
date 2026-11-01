// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/(dashboard)/customers/page";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "fixture-admin", role: "ADMIN" } }, status: "authenticated" }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success, error: mocks.error } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { id: "fixture-admin", role: "ADMIN", ctvList: [] } }) }));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [], total: 0, page: 1, totalPages: 1, limit: 20, loading: false, refreshing: false, hasData: true, error: undefined, selectedIds: [], setPage: vi.fn(), setLimit: vi.fn(), setSelectedIds: vi.fn(), setFilter: vi.fn(), fetchCustomers: mocks.refresh, filters: { search: "", subscriberType: "", billingType: "", prepaidPeriod: "", status: "", expirationFilter: "", ctvCode: "" } }) }));

const sizeMessage = "File Excel tối đa 4 MB cho mỗi lần import trên web. Hãy chia nhỏ file rồi thử lại.";
function reply(data: unknown = { added: 0, updated: 0 }) { return { status: 200, ok: true, json: vi.fn().mockResolvedValue(data) }; }
function fileWithSize(size: number) { const file = new File(["fixture"], "customers.xlsx"); Object.defineProperty(file, "size", { value: size }); return file; }
function mount() { render(<ConfirmDialogProvider><CustomersPage /></ConfirmDialogProvider>); return screen.getByLabelText("Chọn file Excel để import khách hàng") as HTMLInputElement; }

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES", "4000000");
  mocks.fetch.mockReset().mockResolvedValue(reply());
  mocks.refresh.mockReset().mockResolvedValue(undefined);
  mocks.createUrl.mockReset().mockReturnValue("blob:fixture-import-errors");
  mocks.revokeUrl.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  const BaseURL = URL;
  vi.stubGlobal("URL", class extends BaseURL { static createObjectURL = mocks.createUrl; static revokeObjectURL = mocks.revokeUrl; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("customer import client filesize preflight", () => {
  it.each(["4000000", undefined, "invalid"])("rejects oversized files before upload for publiccap%s", async (value) => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES", value);
    const input = mount();
    await userEvent.setup().upload(input, fileWithSize(4_000_001));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(sizeMessage));
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.createUrl).not.toHaveBeenCalled();
    expect(mocks.revokeUrl).not.toHaveBeenCalled();
    expect(input).toBeEnabled();
    expect(input.value).toBe("");
  });

  it.each([3_999_999, 4_000_000])("sends the same multipart file at filesize%s", async (size) => {
    const input = mount();
    const file = fileWithSize(size);
    await userEvent.setup().upload(input, file);
    await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/import", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    expect((mocks.fetch.mock.calls[0][1].body as FormData).get("file")).toBe(file);
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("keeps local cap0 behavior without adding a new4MB restriction", async () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES", "0");
    const input = mount();
    await userEvent.setup().upload(input, fileWithSize(6_000_000));
    await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("allows reselecting the same rejected file then importing a valid file without a stuck guard", async () => {
    const input = mount();
    const user = userEvent.setup();
    const file = fileWithSize(4_000_001);
    await user.upload(input, file);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    await user.upload(input, file);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(2));
    expect(mocks.fetch).not.toHaveBeenCalled();
    await user.upload(input, fileWithSize(10));
    await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(input).toBeEnabled();
  });

  it("preserves the existing report and CSV when the next file is rejected locally", async () => {
    mocks.fetch.mockResolvedValue(reply({ added: 1, updated: 0, errors: ["Dòng4"], errorCsv: "row errors" }));
    const input = mount();
    const user = userEvent.setup();
    await user.upload(input, fileWithSize(10));
    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    await user.upload(input, fileWithSize(4_000_001));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(sizeMessage));
    expect(within(report).getByRole("link", { name: "Tải báo cáo lỗi CSV" })).toHaveAttribute("href", "blob:fixture-import-errors");
    expect(mocks.revokeUrl).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("keeps the in-flight guard ahead of a queued oversized selection", async () => {
    let finish!: (value: ReturnType<typeof reply>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const input = mount();
    act(() => {
      fireEvent.change(input, { target: { files: [fileWithSize(10)] } });
      fireEvent.change(input, { target: { files: [fileWithSize(4_000_001)] } });
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
    await act(async () => { finish(reply()); });
    expect(input).toBeEnabled();
  });
});
