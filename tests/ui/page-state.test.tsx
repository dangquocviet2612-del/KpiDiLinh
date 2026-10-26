// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AsyncState from "@/components/ui/AsyncState";
import FormField from "@/components/ui/FormField";

describe("AsyncState", () => {
  it("exposes an error and a retry action", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncState
        status="error"
        title="Không thể tải dữ liệu"
        description="Kết nối máy chủ thất bại."
        actionLabel="Thử lại"
        onAction={retry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải dữ liệu");
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("announces a loading state without a destructive alert", () => {
    render(<AsyncState status="loading" title="Đang tải dữ liệu" />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải dữ liệu");
  });
});

describe("FormField", () => {
  it("connects label, hint and error text to its control", () => {
    render(
      <FormField
        id="customer-name"
        label="Tên khách hàng"
        hint="Nhập tên đầy đủ."
        error="Tên khách hàng là bắt buộc."
      >
        <input />
      </FormField>,
    );

    const input = screen.getByRole("textbox", { name: "Tên khách hàng" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Nhập tên đầy đủ. Tên khách hàng là bắt buộc.");
  });
});
