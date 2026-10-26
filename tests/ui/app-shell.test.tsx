// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("dashboard app shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens the mobile navigation as a keyboard-dismissable dialog", async () => {
    const user = userEvent.setup();
    render(<Sidebar userRole="ADMIN" userName="Quản trị viên" />);

    const trigger = screen.getByRole("button", { name: "Mở menu điều hướng" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Menu điều hướng" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Đóng menu điều hướng" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu điều hướng" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
