// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomerTableRefined from "@/components/CustomerTableRefined";
import styles from "@/app/(dashboard)/customers/customers.module.css";
import { customerMetadataProps, metadataVariants } from "../fixtures/customer-missing-metadata";

afterEach(cleanup);

describe("explicit customer missing package and CTV metadata", () => {
  it("allows only missing CTV text to wrap instead of clipping at large text sizes", () => {
    const view = render(<CustomerTableRefined {...customerMetadataProps("missing-ctv")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobileFooterValue}`)).toHaveStyle({ whiteSpace: "normal", overflowWrap: "anywhere" });
    view.rerender(<CustomerTableRefined {...customerMetadataProps()} />);
    const supplied = screen.getByRole("article").querySelector<HTMLElement>(`.${styles.mobileFooterValue}`);
    expect(supplied?.style.whiteSpace).toBe("");
    expect(supplied?.style.overflowWrap).toBe("");
  });

  it.each(metadataVariants)("renders truthful package/CTV metadata: %s", (variant) => {
    const props = customerMetadataProps(variant); const customer = props.customers[0];
    render(<CustomerTableRefined {...props} />); const card = screen.getByRole("article");
    const strip = card.querySelector(`.${styles.mobilePackageStrip}`);
    expect(Boolean(strip)).toBe(Boolean(customer.package || customer.price != null));
    if (strip) {
      expect(strip.querySelector(`.${styles.mobileStripLabel}`)).toHaveTextContent(customer.package ? "Gói cước" : "Chưa có tên gói");
      expect(Boolean(strip.querySelector(`.${styles.mobilePackageName}`))).toBe(Boolean(customer.package));
      if (customer.price != null) expect(strip.querySelector(`.${styles.mobilePackagePrice}`)).toHaveTextContent(`${customer.price.toLocaleString()}đ`);
    }
    const ctv = card.querySelector(`.${styles.mobileFooterValue}`);
    expect(ctv).toHaveTextContent(customer.ctvCode || "Chưa có");
    expect(ctv).toHaveAttribute("title", customer.ctvCode || "Chưa có mã CTV");
    expect(within(card).queryByText("---")).not.toBeInTheDocument();
  });

  it.each([null, ""])("shows an unnamed zero-price package without inventing a name: %s", (packageName) => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], package: packageName, price: 0 }]} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Chưa có tên gói")).toBeInTheDocument();
    expect(within(card).getByText("0đ")).toBeInTheDocument();
    expect(card.querySelector(`.${styles.mobilePackageName}`)).toBeNull();
  });

  it.each([null, ""])("labels missing CTV without implying an assignment status: %s", (ctvCode) => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], ctvCode }]} />);
    const value = screen.getByRole("article").querySelector(`.${styles.mobileFooterValue}`);
    expect(value).toHaveTextContent("Chưa có"); expect(value).toHaveAttribute("title", "Chưa có mã CTV");
  });

  it.each([0, -1200, 12.5])("preserves existing price formatting rather than treating %s as missing", (price) => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], package: null, price }]} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobilePackagePrice}`)).toHaveTextContent(`${price.toLocaleString()}đ`);
  });

  it("keeps a package name without fabricating a price when price is null", () => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], price: null }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobilePackageName}`)?.textContent).toBe(props.customers[0].package);
    expect(card.querySelector(`.${styles.mobilePackagePrice}`)).toBeNull();
    expect(within(card).queryByText("Chưa có tên gói")).not.toBeInTheDocument();
  });

  it("does not trim whitespace-only package and CTV fields", () => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], package: "  ", ctvCode: "  " }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobilePackageName}`)?.textContent).toBe("  ");
    expect(card.querySelector(`.${styles.mobileFooterValue}`)).toHaveAttribute("title", "  ");
    expect(within(card).queryByText("Chưa có tên gói")).not.toBeInTheDocument();
  });

  it("retains literal placeholder-looking values as supplied data", () => {
    const props = customerMetadataProps();
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], package: "---", ctvCode: "---" }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobilePackageName}`)?.textContent).toBe("---");
    expect(card.querySelector(`.${styles.mobileFooterValue}`)).toHaveAttribute("title", "---");
    expect(within(card).queryByText("Chưa có tên gói")).not.toBeInTheDocument();
  });

  it("preserves populated raw values, URLs, copy feedback and action arguments", async () => {
    const user = userEvent.setup(); const props = customerMetadataProps();
    const customer = { ...props.customers[0], package: "  SYNTHETIC GÓI  ", ctvCode: "  SYNTHETIC CTV  " };
    const onCopyAccount = vi.fn(); const onEdit = vi.fn(); const submit = vi.fn();
    const view = render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}><CustomerTableRefined {...props} customers={[customer]} onCopyAccount={onCopyAccount} onEdit={onEdit} /></form>);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobilePackageName}`)?.textContent).toBe(customer.package);
    expect(card.querySelector(`.${styles.mobileFooterValue}`)?.textContent).toBe(customer.ctvCode);
    expect(within(card).getByRole("link", { name: /^Gọi điện/ })).toHaveAttribute("href", `tel:${customer.phone}`);
    const zalo = within(card).getByRole("link", { name: /^Nhắn Zalo/ });
    expect(zalo).toHaveAttribute("href", `https://zalo.me/${customer.phone}`); expect(zalo).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(within(card).getByRole("button", { name: /^Sao chép/ }));
    await user.click(within(card).getByRole("button", { name: /^Sửa/ }));
    expect(onCopyAccount).toHaveBeenCalledExactlyOnceWith(customer.account); expect(onEdit).toHaveBeenCalledExactlyOnceWith(customer); expect(submit).not.toHaveBeenCalled();
    view.rerender(<CustomerTableRefined {...props} customers={[customer]} copiedAccount={customer.account} />);
    expect(within(screen.getByRole("article")).getByRole("button", { name: /^Sao chép/ }).className).toContain(styles.copyActive);
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("retains role/disabled boundaries for missing metadata: %s", (role) => {
    const props = customerMetadataProps("zero-price-no-ctv", role);
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], nodeName: null }]} />);
    const card = screen.getByRole("article");
    expect(card.querySelector(`.${styles.mobileFooterValue}`)).toHaveAttribute("title", "Chưa có mã CTV");
    expect(within(card).queryAllByRole("checkbox")).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).queryAllByRole("button", { name: /^Xóa/ })).toHaveLength(role === "ADMIN" ? 1 : 0);
    expect(within(card).getByRole("button", { name: /^Xem node/ })).toBeDisabled();
  });

  it("keeps visibility options and missing contact hints independent", () => {
    const props = customerMetadataProps("zero-price-no-ctv");
    render(<CustomerTableRefined {...props} customers={[{ ...props.customers[0], phone: null, account: null }]} visibleColumns={{ status: false, billingType: false, zaloButton: false }} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Chưa có SĐT")).toBeInTheDocument(); expect(within(card).getByText("Chưa có account")).toBeInTheDocument();
    expect(within(card).queryByText("Hoạt động")).not.toBeInTheDocument(); expect(within(card).queryByText("Hàng tháng")).not.toBeInTheDocument();
    expect(within(card).queryAllByRole("link")).toHaveLength(0);
  });

  it("reconciles missing and populated metadata without stale placeholders", () => {
    const view = render(<CustomerTableRefined {...customerMetadataProps("zero-price-no-ctv")} />);
    expect(within(screen.getByRole("article")).getByText("Chưa có tên gói")).toBeInTheDocument();
    view.rerender(<CustomerTableRefined {...customerMetadataProps()} />);
    expect(within(screen.getByRole("article")).queryByText("Chưa có tên gói")).not.toBeInTheDocument();
    view.rerender(<CustomerTableRefined {...customerMetadataProps("empty-metadata")} />);
    expect(screen.getByRole("article").querySelector(`.${styles.mobilePackageStrip}`)).toBeNull();
    expect(screen.getByRole("article").querySelector(`.${styles.mobileFooterValue}`)).toHaveAttribute("title", "Chưa có mã CTV");
  });

  it("retains desktop zero-price, missing CTV and row expansion semantics", async () => {
    const user = userEvent.setup(); render(<CustomerTableRefined {...customerMetadataProps("zero-price-no-ctv")} />);
    const table = screen.getByRole("table");
    expect(table.querySelector(`.${styles.packagePrimary}`)).toHaveTextContent("0đ");
    expect(table.querySelector(`.${styles.ctvValue}`)).toHaveAttribute("title", "Chưa có");
    expect(within(table).queryByText("Chưa có tên gói")).not.toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: "Mở rộng chi tiết" }));
    expect(within(table).getByRole("button", { name: "Thu gọn chi tiết" })).toBeInTheDocument();
  });
});
