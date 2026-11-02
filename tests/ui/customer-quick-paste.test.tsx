// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerModalRefined from "@/components/CustomerModalRefined";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import type { Customer } from "@/types";

const state = vi.hoisted(() => ({ role: "ADMIN" as string | undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: state.role ? { user: { role: state.role } } : null }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ data: { role: state.role }, scope: "test-admin" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
    state.role = "ADMIN";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [{ id: "phu", username: "phuav_ldg_cnkd", name: "Phu" }] })));
});
const show = (customer: Customer | null = null) => render(<ConfirmDialogProvider><CustomerModalRefined customer={customer} onClose={vi.fn()} onRefresh={vi.fn()} /></ConfirmDialogProvider>);
describe("admin customer quick paste", () => {
    it.each([true, false])("clears map defaults and gates save until explicit GPS succeeds (%s)", async (succeeds) => {
        const user = userEvent.setup();
        const gps = vi.fn((success, failure) => succeeds ? success({ coords: { latitude: 11.5, longitude: 107.9 } }) : failure({ message: "Permission denied" }));
        Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
        render(<ConfirmDialogProvider><CustomerModalRefined customer={null} defaultLocation={{ latitude: 10, longitude: 106 }} onClose={vi.fn()} onRefresh={vi.fn()} /></ConfirmDialogProvider>);
        await user.type(screen.getByLabelText("Thông tin khách hàng dán nhanh"), "ldg_gftth_namnv14\nNguyễn Văn Nam");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
        expect(gps).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Vĩ độ (Latitude)")).toHaveValue(null);
        expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Lấy tọa độ hiện tại" }));
        if (succeeds) {
            expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
            expect(screen.getByLabelText("Vĩ độ (Latitude)")).toHaveValue(11.5);
        } else {
            expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
            expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
        }
        expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    });
    it("preserves optional fields and retains the form on a duplicate server rejection", async () => {
        const user = userEvent.setup(); show();
        await waitFor(() => expect(screen.getByRole("option", { name: /phuav_ldg_cnkd/ })).toBeInTheDocument());
        await user.type(screen.getByLabelText("Số điện thoại"), "0912345678");
        await user.selectOptions(screen.getByLabelText("Mã CTV (giao khách)"), "phuav_ldg_cnkd");
        await user.type(screen.getByLabelText("Thông tin khách hàng dán nhanh"), "ldg_gftth_namnv14\nNguyễn Văn Nam\n11.5, 107.9");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
        expect(screen.getByLabelText("Số điện thoại")).toHaveValue("0912345678");
        expect(screen.getByLabelText("Mã CTV (giao khách)")).toHaveValue("phuav_ldg_cnkd");
        vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Account đã tồn tại" }) } as Response);
        await user.click(screen.getByRole("button", { name: "Lưu" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Account đã tồn tại");
        expect(screen.getByLabelText("Account")).toHaveValue("ldg_gftth_namnv14");
        expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
        await user.clear(screen.getByLabelText("Account"));
        expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
        await user.type(screen.getByLabelText("Account"), "another_account");
        await user.clear(screen.getByLabelText("Vĩ độ (Latitude)"));
        expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    });
    it("previews editable fields and saves only after explicit save", async () => {
        const user = userEvent.setup(); show();
        await waitFor(() => expect(screen.getByRole("option", { name: /phuav_ldg_cnkd/ })).toBeInTheDocument());
        await user.type(screen.getByLabelText("Thông tin khách hàng dán nhanh"), "ldg_gftth_namnv14\nnguyễn văn nam\n107.95302872883524, 11.503610559826157\nPHUAV");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
        expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("nguyễn văn nam");
        expect(screen.getByLabelText("Account")).toHaveValue("ldg_gftth_namnv14");
        expect(screen.getByLabelText("Vĩ độ (Latitude)")).toHaveValue(11.503610559826157);
        expect(screen.getByLabelText("Kinh độ (Longitude)")).toHaveValue(107.95302872883524);
        expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
        await user.clear(screen.getByLabelText("Tên khách hàng *"));
        await user.type(screen.getByLabelText("Tên khách hàng *"), "Tên đã sửa");
        await user.click(screen.getByRole("button", { name: "Lưu" }));
        expect(fetch).toHaveBeenCalledWith("/api/customers", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"Tên đã sửa"') }));
    });
    it("leaves existing form values intact on recognition errors", async () => {
        const user = userEvent.setup(); show();
        // Wait for the dialog's initial RAF autofocus before simulating typing.
        await waitFor(() => expect(screen.getByRole("button", { name: "Đóng" })).toHaveFocus());
        await user.type(screen.getByLabelText("Tên khách hàng *"), "Giữ tên");
        await user.type(screen.getByLabelText("Thông tin khách hàng dán nhanh"), "invalid");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Giữ tên");
    });
    it.each(["MANAGER", "CTV", undefined])("hides quick paste for %s", (role) => {
        state.role = role; show();
        expect(screen.queryByLabelText("Thông tin khách hàng dán nhanh")).not.toBeInTheDocument();
    });
    it("hides quick paste when editing", () => {
        show({ id: "existing", name: "Existing" } as Customer);
        expect(screen.queryByLabelText("Thông tin khách hàng dán nhanh")).not.toBeInTheDocument();
    });
});
