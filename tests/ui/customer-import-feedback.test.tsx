// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/(dashboard)/customers/page";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "fixture-admin", role: "ADMIN" } }, status: "authenticated" }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success, error: mocks.error } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { id: "fixture-admin", role: "ADMIN", ctvList: [] } }) }));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({
  customers: [], total: 0, page: 1, totalPages: 1, limit: 20, loading: false, refreshing: false, hasData: true,
  error: undefined, selectedIds: [], setPage: vi.fn(), setLimit: vi.fn(), setSelectedIds: vi.fn(), setFilter: vi.fn(),
  fetchCustomers: mocks.refresh,
  filters: { search: "", subscriberType: "", billingType: "", prepaidPeriod: "", status: "", expirationFilter: "", ctvCode: "" },
}) }));

const unknownMessage = "Chưa xác nhận được kết quả import. Hãy tải lại danh sách để kiểm tra trước khi thử lại.";
const sizeMessage = "File tải lên vượt giới hạn cho phép. Hãy chia nhỏ file Excel rồi thử lại.";
const refreshMessage = "Import đã hoàn tất nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.";
const csvMessage = "Import đã hoàn tất nhưng chưa tạo được file báo cáo lỗi. Bạn vẫn có thể xem lỗi trong bảng kết quả.";

function reply(status: number, data: unknown) {
  return { status, ok: status >= 200 && status < 300, json: vi.fn().mockResolvedValue(data) };
}

function mount() {
  render(<ConfirmDialogProvider><CustomersPage /></ConfirmDialogProvider>);
  return screen.getByLabelText("Chọn file Excel để import khách hàng") as HTMLInputElement;
}

function workbook(name = "customers.xlsx") { return new File(["synthetic workbook"], name); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockReset();
  mocks.refresh.mockReset().mockResolvedValue(undefined);
  mocks.createUrl.mockReset().mockReturnValue("blob:fixture-import-errors");
  mocks.revokeUrl.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  const BaseURL = URL;
  vi.stubGlobal("URL", class extends BaseURL {
    static createObjectURL = mocks.createUrl;
    static revokeObjectURL = mocks.revokeUrl;
  });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("customer import response feedback", () => {
  it("handles gateway413 before reading a non-JSON body and permits selecting the same file again", async () => {
    const blocked = reply(413, undefined);
    blocked.json.mockRejectedValue(new SyntaxError("gateway plain text, not JSON"));
    mocks.fetch.mockResolvedValueOnce(blocked).mockResolvedValueOnce(reply(200, { added: 0, updated: 0 }));
    const input = mount();
    const user = userEvent.setup();
    const file = workbook();
    await user.upload(input, file);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(sizeMessage));
    expect(blocked.json).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(input).toBeEnabled();
    expect(input.value).toBe("");
    await user.upload(input, file);
    await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "missing counts", data: {} },
    { label: "one missing count", data: { added: 1 } },
    { label: "string count", data: { added: "2", updated: 0 } },
    { label: "negative count", data: { added: -1, updated: 0 } },
    { label: "fraction count", data: { added: 1.5, updated: 0 } },
    { label: "unsafe count", data: { added: Number.MAX_SAFE_INTEGER + 1, updated: 0 } },
    { label: "invalid row errors", data: { added: 1, updated: 0, errors: ["row4", 5] } },
    { label: "invalid csv", data: { added: 1, updated: 0, errorCsv: { raw: "private backend detail" } } },
    { label: "array body", data: [] },
    { label: "null body", data: null },
  ])("does not announce success for $label", async ({ data }) => {
    mocks.fetch.mockResolvedValue(reply(200, data));
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(unknownMessage));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.createUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Kết quả import khách hàng" })).not.toBeInTheDocument();
    expect(input).toBeEnabled();
    expect(input.value).toBe("");
  });

  it.each(["network", "invalid JSON", "server JSON", "server HTML"])("reports an unconfirmed outcome on %s without raw details or automatic retry", async (mode) => {
    const response = reply(mode.startsWith("server") ? 500 : 200, { error: "SQL: private backend detail" });
    if (mode === "invalid JSON" || mode === "server HTML") response.json.mockRejectedValue(new SyntaxError("private parser details"));
    if (mode === "network") mocks.fetch.mockRejectedValue(new Error("private network details"));
    else mocks.fetch.mockResolvedValue(response);
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(unknownMessage));
    expect(mocks.error.mock.calls.flat().join(" ")).not.toContain("private");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(input).toBeEnabled();
    expect(input.value).toBe("");
  });

  it.each([400, 401])("preserves a structured rejection at HTTP%s", async (status) => {
    mocks.fetch.mockResolvedValue(reply(status, { error: "Vui lòng kiểm tra file hoặc quyền truy cập." }));
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Lỗi: Vui lòng kiểm tra file hoặc quyền truy cập."));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("uses the unknown-outcome fallback instead of Lỗi: undefined for malformed rejection", async () => {
    mocks.fetch.mockResolvedValue(reply(400, { reason: "not an error contract" }));
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(unknownMessage));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it.each([
    { added: 0, updated: 0 },
    { added: 2, updated: 1, errors: [], errorCsv: "" },
    { added: 3, updated: 0, errors: ["Dòng4: thiếu Account"], errorCsv: "Chi tiết lỗi\nDòng4: thiếu Account" },
  ])("preserves a confirmed import report %# and the multipart request", async (data) => {
    mocks.fetch.mockResolvedValue(reply(200, data));
    const input = mount();
    const file = workbook();
    await userEvent.setup().upload(input, file);
    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(report).getAllByText(String(data.added)).length).toBeGreaterThan(0);
    expect(mocks.success).toHaveBeenCalledWith("Import khách hàng đã hoàn tất.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.fetch).toHaveBeenCalledWith("/api/import", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    const options = mocks.fetch.mock.calls[0][1] as RequestInit;
    expect((options.body as FormData).get("file")).toBe(file);
    expect(options.headers).toBeUndefined();
    if (data.errorCsv) expect(within(report).getByRole("link", { name: "Tải báo cáo lỗi CSV" })).toHaveAttribute("href", "blob:fixture-import-errors");
    expect(input).toBeEnabled();
    expect(input.value).toBe("");
  });
});

describe("customer import attempt and post-success ownership", () => {
  it("allows only one POST when two change events arrive in the same batch", async () => {
    let resolveImport!: (response: ReturnType<typeof reply>) => void;
    mocks.fetch.mockImplementation(() => new Promise((resolve) => { resolveImport = resolve; }));
    const input = mount();
    const file = workbook("first.xlsx");
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(input, { target: { files: [workbook("second.xlsx")] } });
    });
    const requestsWhilePending = mocks.fetch.mock.calls.length;
    expect(input).toBeDisabled();
    await act(async () => { resolveImport(reply(200, { added: 1, updated: 0 })); });
    expect(requestsWhilePending).toBe(1);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(input).toBeEnabled();
  });

  it("does nothing when the picker returns no file", () => {
    const input = mount();
    fireEvent.change(input, { target: { files: [] } });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("keeps the previous CSV/report when the next response is unconfirmed and revokes on confirmed replacement only", async () => {
    mocks.fetch.mockResolvedValueOnce(reply(200, { added: 1, updated: 0, errors: ["Dòng4"], errorCsv: "row errors" }))
      .mockResolvedValueOnce(reply(200, {}))
      .mockResolvedValueOnce(reply(200, { added: 2, updated: 0 }));
    const input = mount();
    const user = userEvent.setup();
    await user.upload(input, workbook("one.xlsx"));
    await screen.findByRole("link", { name: "Tải báo cáo lỗi CSV" });
    await user.upload(input, workbook("two.xlsx"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(unknownMessage));
    expect(screen.getByRole("link", { name: "Tải báo cáo lỗi CSV" })).toHaveAttribute("href", "blob:fixture-import-errors");
    expect(mocks.revokeUrl).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    await user.upload(input, workbook("three.xlsx"));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(2));
    expect(mocks.revokeUrl).toHaveBeenCalledWith("blob:fixture-import-errors");
    expect(screen.queryByRole("link", { name: "Tải báo cáo lỗi CSV" })).not.toBeInTheDocument();
  });

  it("still displays a confirmed report when local CSV allocation fails", async () => {
    mocks.fetch.mockResolvedValue(reply(200, { added: 2, updated: 1, errors: ["Dòng4: thiếu Account"], errorCsv: "row errors" }));
    mocks.createUrl.mockImplementationOnce(() => { throw new Error("local blob allocation failed"); });
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(report).getByText("Dòng4: thiếu Account")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith(csvMessage);
    expect(mocks.error).not.toHaveBeenCalledWith(unknownMessage);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(within(report).queryByRole("link", { name: "Tải báo cáo lỗi CSV" })).not.toBeInTheDocument();
  });

  it.each(["synchronous", "asynchronous"])("does not confuse %s refresh failure with import failure", async (mode) => {
    mocks.fetch.mockResolvedValue(reply(200, { added: 1, updated: 2 }));
    if (mode === "synchronous") mocks.refresh.mockImplementationOnce(() => { throw new Error("read failed"); });
    else mocks.refresh.mockRejectedValueOnce(new Error("read failed"));
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(refreshMessage));
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalledWith(unknownMessage);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(input).toBeEnabled();
  });

  it.each(["allocation failure", "CSV omitted"])("exposes all row errors incrementally with %s and resets the next report preview", async (mode) => {
    const errors = Array.from({ length: 8 }, (_, index) => `Dòng ${index + 2}: lỗi fixture ${index + 1}`);
    mocks.fetch.mockResolvedValueOnce(reply(200, { added: 0, updated: 1, errors, ...(mode === "allocation failure" ? { errorCsv: "row errors" } : {}) }))
      .mockResolvedValueOnce(reply(200, { added: 0, updated: 0, errors }));
    if (mode === "allocation failure") mocks.createUrl.mockImplementationOnce(() => { throw new Error("local CSV failure"); });
    const input = mount();
    const user = userEvent.setup();
    await user.upload(input, workbook("first.xlsx"));
    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(report).getAllByRole("listitem")).toHaveLength(5);
    expect(within(report).queryByText(errors[7])).not.toBeInTheDocument();
    const more = within(report).getByRole("button", { name: "Hiện thêm lỗi" });
    expect(more).toHaveAttribute("type", "button");
    expect(more).toHaveAttribute("aria-controls", "customer-import-row-errors");
    expect(document.getElementById("customer-import-row-errors")).toBeInTheDocument();
    await user.click(more);
    expect(within(report).getAllByRole("listitem")).toHaveLength(8);
    expect(within(report).getByText(errors[7])).toBeInTheDocument();
    expect(within(report).queryByRole("button", { name: "Hiện thêm lỗi" })).not.toBeInTheDocument();
    expect(within(report).queryByText(/trong báo cáo CSV/)).not.toBeInTheDocument();
    expect(within(report).queryByRole("link", { name: "Tải báo cáo lỗi CSV" })).not.toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledOnce();
    await user.click(within(report).getByRole("button", { name: "Hoàn tất" }));
    await user.upload(input, workbook("second.xlsx"));
    const nextReport = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(nextReport).getAllByRole("listitem")).toHaveLength(5);
    expect(within(nextReport).getByRole("button", { name: "Hiện thêm lỗi" })).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledTimes(2);
  });

  it("keeps the five-row preview and download link when CSV is available", async () => {
    const errors = Array.from({ length: 8 }, (_, index) => `Dòng ${index + 2}: lỗi fixture ${index + 1}`);
    mocks.fetch.mockResolvedValue(reply(200, { added: 1, updated: 0, errors, errorCsv: "all row errors" }));
    const input = mount();
    await userEvent.setup().upload(input, workbook());
    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(report).getAllByRole("listitem")).toHaveLength(5);
    expect(within(report).getByText("Còn 3 lỗi khác trong báo cáo CSV.")).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "Tải báo cáo lỗi CSV" })).toHaveAttribute("href", "blob:fixture-import-errors");
    expect(within(report).queryByRole("button", { name: "Hiện thêm lỗi" })).not.toBeInTheDocument();
  });
});
