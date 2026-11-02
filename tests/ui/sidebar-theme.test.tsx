// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";
import RootLayout from "@/app/layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

describe("sidebar theme switch", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it.each([null, "invalid", "light", "dark"])("bootstraps %s before page content", (saved) => {
    if (saved) localStorage.setItem("theme", saved);
    const layout = RootLayout({ children: null });
    expect(layout.props["data-theme"]).toBe("dark");
    const script = layout.props.children[0].props.children;
    expect(script.type).toBe("script");
    new Function(script.props.dangerouslySetInnerHTML.__html)();
    expect(document.documentElement).toHaveAttribute("data-theme", saved === "light" ? "light" : "dark");
  });

  it.each(["light", "dark"])("restores saved %s", (theme) => {
    localStorage.setItem("theme", theme);
    render(<Sidebar userRole="ADMIN" userName="Admin" />);
    expect(screen.getByRole("switch", { name: "Giao diện tối" })).toHaveAttribute("aria-checked", String(theme === "dark"));
    expect(document.documentElement).toHaveAttribute("data-theme", theme);
  });

  it.each([false, true])("defaults to dark regardless of OS dark preference %s", (matches) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches })));
    render(<Sidebar userRole="ADMIN" userName="Admin" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("switch", { name: "Giao diện tối" })).toHaveAttribute("aria-checked", "true");
  });

  it("defaults invalid saved values to dark", () => {
    localStorage.setItem("theme", "invalid");
    render(<Sidebar userRole="ADMIN" userName="Admin" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("places visible labels between password and logout and persists click and keyboard changes", async () => {
    const user = userEvent.setup();
    render(<Sidebar userRole="ADMIN" userName="Admin" />);
    const control = screen.getByRole("switch", { name: "Giao diện tối" });
    expect(control.tagName).toBe("BUTTON");
    expect(screen.getByRole("link", { name: "Đổi mật khẩu" }).nextElementSibling).toBe(control);
    const install = screen.getByRole("button", { name: /^(Cài ứng dụng|Đã cài ứng dụng)$/ });
    expect(control.nextElementSibling).toBe(install);
    expect(install.nextElementSibling).toBe(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(screen.getByText("Sáng")).toBeVisible();
    expect(screen.getByText("Tối")).toBeVisible();
    for (const activate of [() => user.click(control), () => user.keyboard("{Enter}"), () => user.keyboard(" ")]) {
      const expected = control.getAttribute("aria-checked") === "true" ? "light" : "dark";
      await activate();
      expect(document.documentElement).toHaveAttribute("data-theme", expected);
      expect(localStorage.getItem("theme")).toBe(expected);
      expect(screen.getByRole("switch", { name: "Giao diện tối" })).toHaveAttribute("aria-checked", String(expected === "dark"));
    }
  });
});
