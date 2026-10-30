// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomerTableRefined from "@/components/CustomerTableRefined";
import { customerControlsProps, syntheticCustomer } from "../fixtures/customer-mobile-controls";

afterEach(cleanup);

function setup(role = "ADMIN", selectedIds: string[] = []) {
  const callbacks = { onSelectIds: vi.fn(), onCopyAccount: vi.fn(), onEdit: vi.fn(), onViewNode: vi.fn(), onDelete: vi.fn() };
  const submit = vi.fn();
  const view = render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><CustomerTableRefined {...customerControlsProps(role)} {...callbacks} selectedIds={selectedIds} /></form>);
  return { ...view, callbacks, submit, card: screen.getByRole("article") };
}

describe("customer mobile control contract", () => {
  it.each([
    { label: /Copy Account|Sao chép account/, callback: "onCopyAccount" as const, argument: syntheticCustomer.account },
    { label: /^Xem node/, callback: "onViewNode" as const, argument: syntheticCustomer },
    { label: /^Sửa/, callback: "onEdit" as const, argument: syntheticCustomer },
    { label: /^Xóa/, callback: "onDelete" as const, argument: syntheticCustomer.id },
  ])("delegates $callback once without submitting a surrounding form", async ({ label, callback, argument }) => {
    const user = userEvent.setup(); const { card, callbacks, submit } = setup();
    const button = within(card).getByRole("button", { name: label });
    await user.click(button);
    expect(callbacks[callback]).toHaveBeenCalledExactlyOnceWith(argument);
    expect(submit).not.toHaveBeenCalled(); expect(button).toHaveAttribute("type", "button");
  });

  it("names the card and its mobile actions for the customer", () => {
    setup(); const card = screen.getByRole("article", { name: `Khách hàng ${syntheticCustomer.name}` });
    for (const name of [`Sao chép account của ${syntheticCustomer.name}`, `Xem node của ${syntheticCustomer.name}`, `Sửa khách hàng ${syntheticCustomer.name}`, `Xóa khách hàng ${syntheticCustomer.name}`]) {
      expect(within(card).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("uses a native label as the checkbox hit target without double selection", async () => {
    const user = userEvent.setup(); const { card, callbacks, submit } = setup();
    const input = within(card).getByRole("checkbox", { name: `Chọn khách hàng ${syntheticCustomer.name}` });
    const label = input.closest("label"); expect(label).not.toBeNull();
    if (!label) throw new Error("Missing native label hit target");
    expect(label.className).toContain("mobileSelectionControl");
    await user.click(label);
    expect(callbacks.onSelectIds).toHaveBeenCalledExactlyOnceWith([syntheticCustomer.id]);
    expect(submit).not.toHaveBeenCalled(); expect(callbacks.onEdit).not.toHaveBeenCalled();
  });

  it("retains native checkbox Space activation", async () => {
    const user = userEvent.setup(); const { card, callbacks, submit } = setup();
    const input = within(card).getByRole("checkbox"); input.focus(); await user.keyboard(" ");
    expect(callbacks.onSelectIds).toHaveBeenCalledExactlyOnceWith([syntheticCustomer.id]);
    expect(submit).not.toHaveBeenCalled(); expect(input).toHaveFocus();
  });

  it("preserves deselection semantics for an already selected customer", async () => {
    const user = userEvent.setup(); const { card, callbacks } = setup("ADMIN", [syntheticCustomer.id]);
    await user.click(within(card).getByRole("checkbox"));
    expect(callbacks.onSelectIds).toHaveBeenCalledExactlyOnceWith([]);
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("keeps selection and deletion restricted to ADMIN: %s", (role) => {
    const { card } = setup(role);
    expect(within(card).queryAllByRole("checkbox")).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).queryAllByRole("button", { name: /^Xóa/ })).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).getByRole("button", { name: /^Sửa/ })).toBeEnabled();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("retains tel/Zalo URLs and safe new-tab attributes: %s", (role) => {
    const { card } = setup(role);
    expect(within(card).getByRole("link", { name: /^Gọi điện/ })).toHaveAttribute("href", `tel:${syntheticCustomer.phone}`);
    const zalo = within(card).getByRole("link", { name: /^Nhắn Zalo/ });
    expect(zalo).toHaveAttribute("href", `https://zalo.me/${syntheticCustomer.phone}`);
    expect(zalo).toHaveAttribute("target", "_blank"); expect(zalo).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps missing account/phone hidden and missing node disabled", () => {
    render(<CustomerTableRefined {...customerControlsProps()} customers={[{ ...syntheticCustomer, account: null, phone: null, nodeName: " " }]} />);
    const card = screen.getByRole("article");
    expect(within(card).queryByRole("button", { name: /Copy Account|Sao chép account/ })).not.toBeInTheDocument();
    expect(within(card).queryAllByRole("link")).toHaveLength(0);
    expect(within(card).getByRole("button", { name: /^Xem node/ })).toBeDisabled();
  });

  it("continues to honor the Zalo visibility option", () => {
    render(<CustomerTableRefined {...customerControlsProps()} visibleColumns={{ zaloButton: false }} />);
    expect(within(screen.getByRole("article")).queryByRole("link", { name: /^Nhắn Zalo/ })).not.toBeInTheDocument();
  });

  it("preserves copy acknowledgement state without changing the account", () => {
    const props = customerControlsProps(); const view = render(<CustomerTableRefined {...props} />);
    view.rerender(<CustomerTableRefined {...props} copiedAccount={syntheticCustomer.account} />);
    const button = within(screen.getByRole("article")).getByRole("button", { name: /Copy Account|Sao chép account/ });
    expect(button.className).toContain("copyActive");
    expect(within(screen.getByRole("article")).getByText(syntheticCustomer.account!.trim())).toHaveAttribute("title", syntheticCustomer.account);
  });

  it("retains desktop labels, non-submit actions and row expansion boundaries", async () => {
    const user = userEvent.setup(); const { callbacks, submit } = setup(); const table = screen.getByRole("table");
    const edit = within(table).getByRole("button", { name: "Sửa" }); expect(edit).toHaveAttribute("type", "button");
    await user.click(edit); expect(callbacks.onEdit).toHaveBeenCalledExactlyOnceWith(syntheticCustomer);
    await user.click(within(table).getByRole("button", { name: "Copy Account" }));
    expect(callbacks.onCopyAccount).toHaveBeenCalledExactlyOnceWith(syntheticCustomer.account);
    expect(within(table).queryByRole("button", { name: "Thu gọn chi tiết" })).not.toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: "Mở rộng chi tiết" }));
    expect(within(table).getByRole("button", { name: "Thu gọn chi tiết" })).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("disambiguates mobile actions for multiple customers", async () => {
    const user = userEvent.setup(); const second = { ...syntheticCustomer, id: "synthetic-customer-02", name: "Khách giả lập 02" };
    const onEdit = vi.fn(); render(<CustomerTableRefined {...customerControlsProps()} customers={[syntheticCustomer, second]} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: `Sửa khách hàng ${second.name}` }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(second);
  });
});
