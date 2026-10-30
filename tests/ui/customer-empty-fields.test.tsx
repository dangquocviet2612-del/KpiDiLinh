// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomerTableRefined from "@/components/CustomerTableRefined";
import styles from "@/app/(dashboard)/customers/customers.module.css";
import { customerEmptyFieldsProps, customerFieldVariants } from "../fixtures/customer-empty-fields";
import { syntheticCustomer } from "../fixtures/customer-mobile-controls";

afterEach(cleanup);

describe("compact customer missing contact fields", () => {
  it.each(customerFieldVariants)("keeps only populated strips and explicit missing hints: %s", (variant) => {
    const props = customerEmptyFieldsProps(variant);
    const customer = props.customers[0];
    render(<CustomerTableRefined {...props} />);
    const card = screen.getByRole("article", { name: `Khách hàng ${customer.name}` });
    expect(card.querySelector(`.${styles.mobilePhoneRow}`) !== null).toBe(Boolean(customer.phone));
    expect(card.querySelector(`.${styles.mobileAccountStrip}`) !== null).toBe(Boolean(customer.account));
    expect(within(card).queryByText("Chưa có SĐT") !== null).toBe(!customer.phone);
    expect(within(card).queryByText("Chưa có account") !== null).toBe(!customer.account);
    expect(card.querySelectorAll(`.${styles.mobileMissingFields}`)).toHaveLength(customer.phone && customer.account ? 0 : 1);
    expect(within(card).queryByText("---")).not.toBeInTheDocument();
  });

  it("treats empty strings like existing falsy values without placeholder blocks", () => {
    const props = customerEmptyFieldsProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], phone: "", account: "" }]} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Chưa có SĐT")).toBeInTheDocument();
    expect(within(card).getByText("Chưa có account")).toBeInTheDocument();
    expect(card.querySelector(`.${styles.mobilePhoneRow}, .${styles.mobileAccountStrip}`)).toBeNull();
    expect(within(card).queryByRole("button", { name: /^Sao chép/ })).not.toBeInTheDocument();
    expect(within(card).queryAllByRole("link")).toHaveLength(0);
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("keeps missing data and role-gated actions independent: %s", async (role) => {
    const user = userEvent.setup();
    const props = customerEmptyFieldsProps("missing-both", role);
    const customer = { ...props.customers[0], nodeName: null };
    const onEdit = vi.fn(); const onDelete = vi.fn(); const onSelectIds = vi.fn();
    const submit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><CustomerTableRefined {...props} customers={[customer]} onEdit={onEdit} onDelete={onDelete} onSelectIds={onSelectIds} /></form>);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Chưa có SĐT")).toBeVisible();
    expect(within(card).getByText("Chưa có account")).toBeVisible();
    expect(within(card).queryAllByRole("checkbox")).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).queryAllByRole("button", { name: /^Xóa/ })).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).getByRole("button", { name: /^Xem node/ })).toBeDisabled();
    await user.click(within(card).getByRole("button", { name: /^Sửa/ }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(customer);
    expect(submit).not.toHaveBeenCalled(); expect(onDelete).not.toHaveBeenCalled(); expect(onSelectIds).not.toHaveBeenCalled();
  });

  it("preserves populated raw values, URLs, copying and acknowledgement", async () => {
    const user = userEvent.setup(); const props = customerEmptyFieldsProps(); const onCopyAccount = vi.fn();
    const view = render(<CustomerTableRefined {...props} onCopyAccount={onCopyAccount} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobileAccountValue}`)?.textContent).toBe(syntheticCustomer.account);
    expect(card.querySelector(`.${styles.mobileAccountValue}`)).toHaveAttribute("title", syntheticCustomer.account);
    expect(within(card).getByRole("link", { name: /^Gọi điện/ })).toHaveAttribute("href", `tel:${syntheticCustomer.phone}`);
    const zalo = within(card).getByRole("link", { name: /^Nhắn Zalo/ });
    expect(zalo).toHaveAttribute("href", `https://zalo.me/${syntheticCustomer.phone}`);
    expect(zalo).toHaveAttribute("target", "_blank"); expect(zalo).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(within(card).getByRole("button", { name: /^Sao chép/ }));
    expect(onCopyAccount).toHaveBeenCalledExactlyOnceWith(syntheticCustomer.account);
    view.rerender(<CustomerTableRefined {...props} onCopyAccount={onCopyAccount} copiedAccount={syntheticCustomer.account} />);
    expect(within(screen.getByRole("article")).getByRole("button", { name: /^Sao chép/ }).className).toContain(styles.copyActive);
  });

  it("does not trim whitespace-only fields or change existing truthiness", async () => {
    const user = userEvent.setup(); const props = customerEmptyFieldsProps(); const onCopyAccount = vi.fn();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], phone: "  ", account: "  " }]} onCopyAccount={onCopyAccount} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobileMissingFields}`)).toBeNull();
    expect(card.querySelector(`.${styles.mobileAccountValue}`)?.textContent).toBe("  ");
    expect(within(card).getAllByRole("link")).toHaveLength(2);
    await user.click(within(card).getByRole("button", { name: /^Sao chép/ }));
    expect(onCopyAccount).toHaveBeenCalledExactlyOnceWith("  ");
  });

  it("does not reinterpret literal placeholder-looking data as missing", () => {
    const props = customerEmptyFieldsProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], phone: "---", account: "---" }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobileMissingFields}`)).toBeNull();
    expect(within(card).getByRole("button", { name: /^Sao chép/ })).toBeInTheDocument();
    expect(within(card).getAllByRole("link")).toHaveLength(2);
  });

  it("reconciles complete, missing and restored fields without stale copy actions", () => {
    const full = customerEmptyFieldsProps(); const missing = customerEmptyFieldsProps("missing-both");
    const view = render(<CustomerTableRefined {...full} />);
    view.rerender(<CustomerTableRefined {...missing} copiedAccount={syntheticCustomer.account} />);
    const emptyCard = screen.getByRole("article");
    expect(within(emptyCard).getByText("Chưa có account")).toBeInTheDocument();
    expect(within(emptyCard).queryByRole("button", { name: /^Sao chép/ })).not.toBeInTheDocument();
    view.rerender(<CustomerTableRefined {...full} />);
    const restored = screen.getByRole("article");
    expect(restored.querySelector(`.${styles.mobileMissingFields}`)).toBeNull();
    expect(within(restored).getByRole("button", { name: /^Sao chép/ }).className).not.toContain(styles.copyActive);
  });

  it("keeps visibility options and unrelated metadata when contact fields are absent", () => {
    render(<CustomerTableRefined {...customerEmptyFieldsProps("missing-both")} visibleColumns={{ status: false, billingType: false, zaloButton: false }} />);
    const card = screen.getByRole("article");
    expect(within(card).queryByText("Hoạt động")).not.toBeInTheDocument();
    expect(within(card).queryByText("Hàng tháng")).not.toBeInTheDocument();
    for (const text of ["Cố định", "Chưa có", syntheticCustomer.package!, syntheticCustomer.ctvCode!, "Chưa có account", "Chưa có SĐT"]) {
      expect(within(card).getByText(text)).toBeInTheDocument();
    }
  });

  it("retains desktop missing-value labels and row expansion", async () => {
    const user = userEvent.setup(); render(<CustomerTableRefined {...customerEmptyFieldsProps("missing-both")} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Chưa có SĐT")).toBeInTheDocument();
    expect(table.querySelector(`.${styles.accountValue}`)).toHaveTextContent("Chưa có");
    expect(table.querySelector(`.${styles.mobileMissingFields}`)).toBeNull();
    await user.click(within(table).getByRole("button", { name: "Mở rộng chi tiết" }));
    expect(within(table).getByRole("button", { name: "Thu gọn chi tiết" })).toBeInTheDocument();
  });
});
