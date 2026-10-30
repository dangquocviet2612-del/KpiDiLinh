// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "@/app/(dashboard)/customers/page";
import CustomerModalRefined from "@/components/CustomerModalRefined";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const mocks = vi.hoisted(() => ({
  setFilter: vi.fn(),
  setSelectedIds: vi.fn(),
  fetchCustomers: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "synthetic-admin", role: "ADMIN" } }, status: "authenticated" }),
}));

vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({
    customers: [],
    total: 0,
    page: 1,
    setPage: vi.fn(),
    totalPages: 1,
    limit: 20,
    setLimit: vi.fn(),
    loading: false,
    selectedIds: [],
    setSelectedIds: mocks.setSelectedIds,
    fetchCustomers: mocks.fetchCustomers,
    filters: {
      search: "Nguyễn Văn A",
      subscriberType: "",
      billingType: "",
      prepaidPeriod: "",
      status: "Hoat dong",
      expirationFilter: "",
      ctvCode: "",
    },
    setFilter: mocks.setFilter,
  }),
}));

describe("customer workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:customer-import-errors"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "synthetic-admin", role: "ADMIN", canUseGps: true, ctvList: [] }),
    })));
  });

  it("labels customer form fields and exposes validation help", () => {
    render(
      <ConfirmDialogProvider>
        <CustomerModalRefined customer={null} onClose={() => undefined} onRefresh={() => undefined} />
      </ConfirmDialogProvider>,
    );

    expect(screen.getByRole("textbox", { name: /Tên khách hàng/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Số điện thoại" })).toHaveAttribute("aria-describedby");
    expect(screen.getByRole("combobox", { name: "Trạng thái" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Vĩ độ (Latitude)" })).toBeInTheDocument();
  });

  it.each([
    { entryPoint: "customer list", defaultLocation: undefined },
    { entryPoint: "customer map", defaultLocation: { latitude: 11.535, longitude: 108.08 } },
  ])("keeps the node field DOM-safe and submits the typed node from $entryPoint", async ({ defaultLocation }) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRefresh = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => (input === "/api/users" ? [] : { customer: { id: "new-customer" } }),
    })));

    const { container } = render(
      <ConfirmDialogProvider>
        <CustomerModalRefined customer={null} onClose={onClose} onRefresh={onRefresh} defaultLocation={defaultLocation} />
      </ConfirmDialogProvider>,
    );

    const nameInput = container.querySelector<HTMLInputElement>("#customer-name")!;
    const nodeInput = container.querySelector<HTMLInputElement>("#customer-node")!;

    expect(nodeInput).toHaveAttribute("name", "customerNodeName");
    expect(nodeInput.form?.elements.namedItem("nodeName")).toBeNull();

    await waitFor(() => expect(container.querySelector('button[aria-label="Đóng"]')).toHaveFocus());

    await user.type(nameInput, "Nguyen Van A");
    await user.type(nodeInput, "NODE-01");

    expect(nodeInput).toHaveValue("NODE-01");

    expect(nameInput).toHaveValue("Nguyen Van A");

    await user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/customers",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"nodeName":"NODE-01"') }),
    );
  });

  it("provides labelled filters and a purposeful no-results action", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <CustomersPage />
      </ConfirmDialogProvider>,
    );

    expect(screen.getAllByRole("textbox", { name: "Tìm kiếm khách hàng" })).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Loại thuê bao" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Trạng thái khách hàng" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc khác" }));
    expect(mocks.setFilter).not.toHaveBeenCalledWith("search", "");
    expect(mocks.setFilter).toHaveBeenCalledWith("status", "");
  });

  it("opens the mobile filters as an accessible dialog", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <CustomersPage />
      </ConfirmDialogProvider>,
    );

    await user.click(screen.getByRole("button", { name: /^Bộ lọc/ }));
    expect(screen.getByRole("dialog", { name: "Bộ lọc khách hàng" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Loại cước" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Đóng bộ lọc" })).toHaveFocus();
    });
  });

  it("keeps the import error report available for download", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/import") {
        return {
          ok: true,
          json: async () => ({
            added: 2,
            updated: 1,
            errors: ["Dòng 4: thiếu số điện thoại"],
            errorCsv: "Chi tiết lỗi\nDòng 4: thiếu số điện thoại",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ id: "synthetic-admin", role: "ADMIN", canUseGps: true, ctvList: [] }),
      };
    }));

    const { container } = render(
      <ConfirmDialogProvider>
        <CustomersPage />
      </ConfirmDialogProvider>,
    );
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"][accept=".xlsx"]');
    expect(fileInput).not.toBeNull();

    await user.upload(fileInput!, new File(["workbook"], "customers.xlsx"));

    const report = await screen.findByRole("dialog", { name: "Kết quả import khách hàng" });
    expect(within(report).getByText("2")).toBeInTheDocument();
    expect(within(report).getByText("Dòng 4: thiếu số điện thoại")).toBeInTheDocument();
    expect(within(report).getByRole("link", { name: "Tải báo cáo lỗi CSV" })).toHaveAttribute(
      "href",
      "blob:customer-import-errors",
    );
  });
});
