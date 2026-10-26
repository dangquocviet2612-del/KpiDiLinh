// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ActionMenu from "@/components/ui/ActionMenu";

describe("ActionMenu", () => {
  it("supports keyboard opening, navigation and Escape", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu label="Tùy chọn">
        <button type="button">Chỉnh sửa</button>
        <button type="button">Xóa</button>
      </ActionMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Tùy chọn" });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Chỉnh sửa" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Xóa" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("returns focus after selecting an action", async () => {
    const user = userEvent.setup();
    render(
      <ActionMenu label="Tùy chọn">
        <button type="button">Chỉnh sửa</button>
      </ActionMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Tùy chọn" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Chỉnh sửa" }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
