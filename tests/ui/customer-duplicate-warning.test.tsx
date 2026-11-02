// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CustomerModalRefined from "@/components/CustomerModalRefined";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: "ADMIN" } } }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { role: "ADMIN" }, scope: "admin" }) }));
const candidates = [{ id: "old", name: "Nguyễn Nam", account: "old_account", phone: "0912345678", ctvCode: "CNKD_A", distanceMeters: 123.4, matchReasons: ["name", "phone"] }, { id: "unknown", name: "Nguyễn Nam", account: "", phone: "", ctvCode: "", distanceMeters: null, matchReasons: ["name"] }];
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (_url, options) => options?.method === "POST" ? { ok: false, status: 409, json: async () => ({ code: "CUSTOMER_POSSIBLE_DUPLICATE", error: "Có thể trùng khách hàng", candidates }) } : { ok: true, json: async () => [] })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const posts = () => vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "POST");
it.each(["Hủy", "Đóng", "Escape"])("can discard the form after duplicate warning via %s", async (action) => {
    const { user, onClose } = await setup();
    await screen.findByRole("button", { name: "Vẫn thêm khách hàng riêng" });
    if (action === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: action }));
    const confirmation = await screen.findByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
    await user.click(within(confirmation).getByRole("button", { name: "Hủy" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Nguyễn Nam");
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    const retry = await screen.findByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
    await user.click(within(retry).getByRole("button", { name: "Bỏ thay đổi" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(posts()).toHaveLength(1);
});
async function setup(quick = false) {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialogProvider><CustomerModalRefined customer={null} onClose={onClose} onRefresh={vi.fn()} /></ConfirmDialogProvider>);
    if (quick) {
        await user.type(screen.getByLabelText("Thông tin khách hàng dán nhanh"), "new_account\nNguyễn Nam\n11.5, 107.9");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
    } else await user.type(screen.getByLabelText("Tên khách hàng *"), "Nguyễn Nam");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    return { user, onClose };
}
it.each([false, true])("requires explicit reason and confirmation without changing submitted fields (quick %s)", async (quick) => {
    const { user, onClose } = await setup(quick);
    const override = await screen.findByRole("button", { name: "Vẫn thêm khách hàng riêng" });
    expect(posts()).toHaveLength(1);
    expect(override).toBeDisabled();
    expect(screen.getByText(/123 m/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có tọa độ/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Xem khách hàng đã có" })[0]).toHaveAttribute("href", "/customers?q=old_account");
    await user.type(screen.getByLabelText("Lý do thêm khách hàng riêng"), "Đây là thuê bao riêng của người cùng tên");
    expect(posts()).toHaveLength(1);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "new" }) } as Response);
    await user.click(override);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const original = JSON.parse(posts()[0][1]!.body as string);
    expect(JSON.parse(posts()[1][1]!.body as string)).toEqual({ ...original, duplicateConfirmation: { reason: "Đây là thuê bao riêng của người cùng tên", candidateIds: ["old", "unknown"] } });
});
it("invalidates confirmation when form fields change and preserves values", async () => {
    const { user } = await setup();
    await screen.findByRole("button", { name: "Vẫn thêm khách hàng riêng" });
    await user.type(screen.getByLabelText("Lý do thêm khách hàng riêng"), "Khách riêng");
    await user.type(screen.getByLabelText("Tên khách hàng *"), " mới");
    expect(screen.queryByRole("button", { name: "Vẫn thêm khách hàng riêng" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Nguyễn Nam mới");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(JSON.parse(posts()[1][1]!.body as string)).not.toHaveProperty("duplicateConfirmation");
});
it("preserves ordinary validation failures", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, options) => (options?.method === "POST" ? { ok: false, status: 400, json: async () => ({ error: "Account đã tồn tại" }) } : { ok: true, json: async () => [] }) as Response);
    await setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Account đã tồn tại");
    expect(screen.queryByRole("button", { name: "Vẫn thêm khách hàng riêng" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Nguyễn Nam");
});
it("returns to review without losing the form or submitting", async () => {
    const { user } = await setup();
    await user.click(await screen.findByRole("button", { name: "Quay lại kiểm tra" }));
    expect(screen.queryByLabelText("Lý do thêm khách hàng riêng")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Nguyễn Nam");
    expect(posts()).toHaveLength(1);
});
it("blocks repeated confirmation while saving and retains input on rejection", async () => {
    const { user } = await setup();
    await screen.findByLabelText("Lý do thêm khách hàng riêng");
    await user.type(screen.getByLabelText("Lý do thêm khách hàng riêng"), "     ");
    expect(screen.getByRole("button", { name: "Vẫn thêm khách hàng riêng" })).toBeDisabled();
    await user.type(screen.getByLabelText("Lý do thêm khách hàng riêng"), "Thuê bao riêng");
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const button = screen.getByRole("button", { name: "Vẫn thêm khách hàng riêng" });
    await user.dblClick(button);
    expect(posts()).toHaveLength(2);
    expect(button).toBeDisabled();
    resolve({ ok: false, status: 422, json: async () => ({ error: "Lý do cần cụ thể hơn" }) } as Response);
    expect(await screen.findByRole("alert")).toHaveTextContent("Lý do cần cụ thể hơn");
    expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Nguyễn Nam");
    expect(screen.getByLabelText("Lý do thêm khách hàng riêng")).toHaveValue("     Thuê bao riêng");
});
