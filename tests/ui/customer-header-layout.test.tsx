// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomerTableRefined from "@/components/CustomerTableRefined";
import styles from "@/app/(dashboard)/customers/customers.module.css";
import { customerHeaderProps, headerVariants, longCustomerName, longCustomerStatus } from "../fixtures/customer-header-layout";

afterEach(cleanup);

describe("customer card header data and interaction preservation", () => {
  it.each(headerVariants)("keeps full raw name/status and titles: %s", (variant) => {
    const props = customerHeaderProps(variant); const customer = props.customers[0];
    render(<CustomerTableRefined {...props} />);
    const card = screen.getByRole("article", { name: `Khách hàng ${customer.name}` });
    const name = card.querySelector(`.${styles.mobileCardName}`);
    expect(name?.textContent).toBe(customer.name); expect(name).toHaveAttribute("title", customer.name);
    const status = card.querySelector(`.${styles.mobileCardStatus}`);
    expect(Boolean(status)).toBe(variant !== "status-hidden");
    if (status) expect(status.textContent).toBe(customer.status);
    expect(longCustomerName.length).toBeLessThanOrEqual(200); expect(longCustomerStatus.length).toBeLessThanOrEqual(50);
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("preserves role-gated controls for long header: %s", (role) => {
    const props = customerHeaderProps("long-name", role);
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], nodeName: null }]} />);
    const card = screen.getByRole("article");
    expect(within(card).queryAllByRole("checkbox")).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).queryAllByRole("button", { name: /^Xóa/ })).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).getByRole("button", { name: /^Xem node/ })).toBeDisabled();
    expect(within(card).getByRole("button", { name: /^Sửa/ })).toBeEnabled();
  });

  it("retains label selection, copy/edit/delete arguments and non-submit buttons", async () => {
    const user = userEvent.setup(); const props = customerHeaderProps("long-name"); const customer = props.customers[0];
    const onSelectIds = vi.fn(); const onCopyAccount = vi.fn(); const onEdit = vi.fn(); const onDelete = vi.fn(); const submit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><CustomerTableRefined {...props} onSelectIds={onSelectIds} onCopyAccount={onCopyAccount} onEdit={onEdit} onDelete={onDelete} /></form>);
    const card = screen.getByRole("article"); const label = within(card).getByRole("checkbox").closest("label");
    expect(label).not.toBeNull(); if (!label) throw new Error("Missing native checkbox label");
    await user.click(label); expect(onSelectIds).toHaveBeenCalledExactlyOnceWith([customer.id]);
    await user.click(within(card).getByRole("button", { name: /^Sao chép/ })); expect(onCopyAccount).toHaveBeenCalledExactlyOnceWith(customer.account);
    await user.click(within(card).getByRole("button", { name: /^Sửa/ })); expect(onEdit).toHaveBeenCalledExactlyOnceWith(customer);
    await user.click(within(card).getByRole("button", { name: /^Xóa/ })); expect(onDelete).toHaveBeenCalledExactlyOnceWith(customer.id);
    expect(submit).not.toHaveBeenCalled(); for (const button of within(card).getAllByRole("button")) expect(button).toHaveAttribute("type", "button");
  });

  it("keeps existing active/inactive color classification rather than changing status semantics", () => {
    const view = render(<CustomerTableRefined {...customerHeaderProps()} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardStatus}`)?.className).toContain(styles.statusActive);
    view.rerender(<CustomerTableRefined {...customerHeaderProps("long-status")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardStatus}`)?.className).toContain(styles.statusInactive);
  });

  it("retains visibility options and missing contact hints", () => {
    const props = customerHeaderProps("long-name");
    render(<CustomerTableRefined {...props} visibleColumns={{ status: false, billingType: false, zaloButton: false }} customers={[{ ...props.customers[0], phone: null, account: null }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobileCardStatus}`)).toBeNull();
    expect(within(card).queryByText("Hàng tháng")).not.toBeInTheDocument(); expect(within(card).queryAllByRole("link")).toHaveLength(0);
    expect(within(card).getByText("Chưa có SĐT")).toBeInTheDocument(); expect(within(card).getByText("Chưa có account")).toBeInTheDocument();
  });

  it("keeps full secondary fallback in text and title when node/address are absent", () => {
    const props = customerHeaderProps("long-name");
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], nodeName: null, address: null }]} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardSecondary}`)).toHaveAttribute("title", "Chưa có node hoặc địa chỉ");
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardSecondary}`)).toHaveTextContent("Chưa có node hoặc địa chỉ");
  });

  it("updates hidden/visible status and raw name on rerender", () => {
    const view = render(<CustomerTableRefined {...customerHeaderProps("status-hidden")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardStatus}`)).toBeNull();
    view.rerender(<CustomerTableRefined {...customerHeaderProps("long-status")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardStatus}`)?.textContent).toBe(longCustomerStatus);
    view.rerender(<CustomerTableRefined {...customerHeaderProps("long-name")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileCardName}`)?.textContent).toBe(longCustomerName);
  });

  it("retains desktop full name/title and expansion", async () => {
    const user = userEvent.setup(); render(<CustomerTableRefined {...customerHeaderProps("long-name")} />);
    const table = screen.getByRole("table");
    expect(table.querySelector(`.${styles.customerName}`)?.textContent).toBe(longCustomerName);
    expect(table.querySelector(`.${styles.customerName}`)).toHaveAttribute("title", longCustomerName);
    await user.click(within(table).getByRole("button", { name: "Mở rộng chi tiết" }));
    expect(within(table).getByRole("button", { name: "Thu gọn chi tiết" })).toBeInTheDocument();
  });
});
