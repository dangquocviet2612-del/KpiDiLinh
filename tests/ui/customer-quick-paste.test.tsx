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
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [{ username: "phuav_ldg_cnkd", name: "Phu" }] })));
});
const show = (customer: Customer | null = null) => render(<ConfirmDialogProvider><CustomerModalRefined customer={customer} onClose={vi.fn()} onRefresh={vi.fn()} /></ConfirmDialogProvider>);
describe("admin customer quick paste", () => {
    it("previews editable fields and saves only after explicit save", async () => {
        const user = userEvent.setup(); show();
        await waitFor(() => expect(screen.getByRole("option", { name: /phuav_ldg_cnkd/ })).toBeInTheDocument());
        await user.type(screen.getByLabelText("Thông tin 4 dòng"), "ldg_gftth_namnv14\nnguyễn văn nam\n107.95302872883524, 11.503610559826157\nPHUAV");
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
        await user.type(screen.getByLabelText("Tên khách hàng *"), "Giữ tên");
        await user.type(screen.getByLabelText("Thông tin 4 dòng"), "invalid");
        await user.click(screen.getByRole("button", { name: "Nhận diện" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByLabelText("Tên khách hàng *")).toHaveValue("Giữ tên");
    });
    it.each(["MANAGER", "CTV", undefined])("hides quick paste for %s", (role) => {
        state.role = role; show();
        expect(screen.queryByLabelText("Thông tin 4 dòng")).not.toBeInTheDocument();
    });
    it("hides quick paste when editing", () => {
        show({ id: "existing", name: "Existing" } as Customer);
        expect(screen.queryByLabelText("Thông tin 4 dòng")).not.toBeInTheDocument();
    });
});
