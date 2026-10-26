// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CtvClient from "@/app/(dashboard)/ctv/CtvClient";
import CtvModal from "@/components/CtvModal";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const kpiRows = [
  {
    kpiCode: "KPI01",
    displayName: "Thuê bao",
    mergeGroup: "",
    baseScore: 10,
    maxPercent: 120,
    isEnabled: 1,
    isNegative: 0,
  },
  {
    kpiCode: "KPI02",
    displayName: "Doanh thu",
    mergeGroup: "",
    baseScore: 20,
    maxPercent: 110,
    isEnabled: 1,
    isNegative: 0,
  },
];

function renderKpiConfig() {
  return render(
    <ConfirmDialogProvider>
      <CtvClient view="kpi-config" />
    </ConfirmDialogProvider>,
  );
}

describe("CTV management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => kpiRows,
    })));
  });

  it("tracks dirty KPI rows and exposes labelled fields", async () => {
    const user = userEvent.setup();
    renderKpiConfig();

    const row = await screen.findByRole("group", { name: "KPI01" });
    const displayName = within(row).getByRole("textbox", { name: "Tên hiển thị" });
    await user.clear(displayName);
    await user.type(displayName, "Thuê bao mới");

    expect(screen.getByText("1 dòng chưa lưu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lưu tất cả/ })).toBeEnabled();
  });

  it("shows row validation and blocks saving invalid numeric values", async () => {
    const user = userEvent.setup();
    renderKpiConfig();

    const row = await screen.findByRole("group", { name: "KPI01" });
    await user.clear(within(row).getByRole("spinbutton", { name: "Điểm chuẩn" }));

    expect(within(row).getByRole("alert")).toHaveTextContent("Điểm chuẩn là bắt buộc");
    expect(screen.getByRole("button", { name: /Lưu tất cả/ })).toBeDisabled();
  });

  it("keeps failed rows dirty after a partial save", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/kpi/config" && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        if (payload.kpiCode === "KPI02") {
          return { ok: false, json: async () => ({ error: "Không lưu được KPI02" }) };
        }
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => kpiRows };
    }));
    renderKpiConfig();

    const firstRow = await screen.findByRole("group", { name: "KPI01" });
    const secondRow = screen.getByRole("group", { name: "KPI02" });
    await user.clear(within(firstRow).getByRole("textbox", { name: "Tên hiển thị" }));
    await user.type(within(firstRow).getByRole("textbox", { name: "Tên hiển thị" }), "KPI một");
    await user.clear(within(secondRow).getByRole("textbox", { name: "Tên hiển thị" }));
    await user.type(within(secondRow).getByRole("textbox", { name: "Tên hiển thị" }), "KPI hai");
    await user.click(screen.getByRole("button", { name: /Lưu tất cả/ }));

    await waitFor(() => expect(within(firstRow).getByText("Đã lưu")).toBeInTheDocument());
    expect(within(secondRow).getByRole("alert")).toHaveTextContent("Không lưu được KPI02");
    expect(screen.getByText("1 dòng chưa lưu")).toBeInTheDocument();
  });

  it("shows account impact before deleting a CTV", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ([{
        id: 7,
        username: "ctv01",
        role: "CTV",
        secondaryCode: "CTV01",
        managerCode: "manager01",
        canUseGps: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      }]),
    })));
    render(
      <ConfirmDialogProvider>
        <CtvClient />
      </ConfirmDialogProvider>,
    );

    await screen.findAllByText("ctv01");
    await user.click(screen.getAllByRole("button", { name: "Xóa" })[0]);

    const dialog = screen.getByRole("dialog", { name: /Xóa CTV/ });
    expect(within(dialog).getByText("Vai trò: CTV")).toBeInTheDocument();
    expect(within(dialog).getByText("Quản lý trực tiếp: manager01")).toBeInTheDocument();
    expect(within(dialog).getByText("Quyền GPS: đang bật")).toBeInTheDocument();
  });

  it("supports password visibility and inline validation in the CTV modal", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <CtvModal user={null} onClose={() => undefined} onRefresh={() => undefined} />
      </ConfirmDialogProvider>,
    );

    const password = screen.getByLabelText("Mật khẩu");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.submit(password.closest("form")!);
    expect(await screen.findByText("Vui lòng nhập tài khoản.")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Tài khoản")).toHaveAttribute("aria-invalid", "true");
  });
});
