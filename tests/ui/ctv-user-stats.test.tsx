// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CtvClient from "@/app/(dashboard)/ctv/CtvClient";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialogProvider";
import { syntheticCtvUsers, syntheticCtvKpis, expectedCtvStatValues, ctvStatHints } from "../fixtures/ctv-user-stats";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
const fetchMock = vi.fn();
const usersResponse = () => ({ ok: true, json: async () => syntheticCtvUsers });

function renderClient(view = "") { return render(<ConfirmDialogProvider><CtvClient view={view} /></ConfirmDialogProvider>); }
function statsSection() {
  const section = screen.getByText("Tổng tài khoản").closest("section");
  if (!section) throw new Error("Missing stats section");
  return section;
}
function statValues() { return [...statsSection().querySelectorAll("article strong")].map((element) => element.textContent); }
async function loadedUsers() { await screen.findAllByText("synthetic_ctv_a"); }

beforeEach(() => {
  mocks.push.mockReset();
  fetchMock.mockReset().mockImplementation(async (input: RequestInfo | URL) => String(input) === "/api/users" ? usersResponse() : { ok: true, json: async () => syntheticCtvKpis });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("CTV user summary presentation", () => {
  it("names and scopes the account statistics without adding another summary", async () => {
    renderClient(); await loadedUsers();
    const section = screen.getByRole("region", { name: "Thống kê tài khoản CTV" });
    expect(section).toBe(statsSection()); expect(section.className).toContain("userStatsCompact");
    expect(within(section).getAllByRole("article")).toHaveLength(4);
  });

  it("provides an explicit accessible search name while retaining its placeholder", async () => {
    renderClient(); await loadedUsers();
    expect(screen.getByRole("textbox", { name: "Tìm tài khoản CTV" })).toHaveAttribute("placeholder", "Tìm theo tên đăng nhập...");
  });

  it("keeps role/GPS totals and excludes ADMIN from the existing user scope", async () => {
    renderClient(); await loadedUsers();
    expect(statValues()).toEqual(expectedCtvStatValues);
    expect(screen.queryByText("synthetic_admin")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/users");
  });

  it("retains every label and full explanatory hint", async () => {
    renderClient(); await loadedUsers(); const section = statsSection();
    for (const label of ["Tổng tài khoản", "CTV", "Quản lý", "GPS bật"]) expect(within(section).getByText(label, { exact: true })).toBeInTheDocument();
    for (const hint of ctvStatHints) expect(within(section).getByText(hint)).toBeInTheDocument();
    expect(section.querySelector("[hidden], [aria-hidden='true']")).toBeNull();
  });

  it("filters and clears the username search without changing totals or re-fetching", async () => {
    const user = userEvent.setup(); renderClient(); await loadedUsers();
    const search = screen.getByPlaceholderText("Tìm theo tên đăng nhập...");
    await user.type(search, "CTV_B");
    expect(screen.queryByText("synthetic_ctv_a")).not.toBeInTheDocument();
    expect(screen.getAllByText("synthetic_ctv_b").length).toBeGreaterThan(0); expect(statValues()).toEqual(expectedCtvStatValues);
    await user.clear(search); await loadedUsers(); expect(statValues()).toEqual(expectedCtvStatValues);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/users");
  });

  it("keeps four zero totals for an empty user response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] }); renderClient();
    await screen.findByText("Chưa có tài khoản CTV"); expect(statValues()).toEqual(["0", "0", "0", "0"]);
  });

  it("preserves the loading-to-loaded transition and editable search", async () => {
    let finish!: (value: ReturnType<typeof usersResponse>) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderClient();
    try {
      expect(screen.getByText("Đang tải danh sách CTV")).toBeInTheDocument();
      expect(statValues()).toEqual(["0", "0", "0", "0"]);
      expect(screen.getByPlaceholderText("Tìm theo tên đăng nhập...")).toBeEnabled();
    } finally { await act(async () => { finish(usersResponse()); }); }
    await loadedUsers(); expect(statValues()).toEqual(expectedCtvStatValues);
  });

  it("keeps the existing read-error retry flow and recomputes totals", async () => {
    const user = userEvent.setup(); fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Lỗi giả lập" }) });
    renderClient(); await screen.findByText("Không thể tải danh sách CTV");
    expect(statValues()).toEqual(["0", "0", "0", "0"]);
    await user.click(screen.getByRole("button", { name: "Thử lại" })); await loadedUsers();
    expect(statValues()).toEqual(expectedCtvStatValues); expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/users");
  });

  it("does not add account-summary scope or search to the KPI config view", async () => {
    const view = renderClient("kpi-config"); await screen.findByRole("group", { name: "SYNTH_KPI_01" });
    expect(screen.queryByRole("region", { name: "Thống kê tài khoản CTV" })).not.toBeInTheDocument();
    expect(view.container.querySelector('[class*="userStatsCompact"]')).toBeNull();
    expect(screen.queryByPlaceholderText("Tìm theo tên đăng nhập...")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/kpi/config");
  });

  it("retains global totals when a search has no results", async () => {
    const user = userEvent.setup(); renderClient(); await loadedUsers();
    await user.type(screen.getByPlaceholderText("Tìm theo tên đăng nhập..."), "no_synthetic_match");
    expect(screen.getByText("Không có CTV phù hợp")).toBeInTheDocument();
    expect(statValues()).toEqual(expectedCtvStatValues); expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/users");
  });
});
