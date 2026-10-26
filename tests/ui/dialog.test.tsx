// @vitest-environment jsdom

import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ConfirmDialogProvider, useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

function DialogHarness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
        Mở hộp thoại
      </button>
      <Dialog
        open={isOpen}
        title="Xác nhận thao tác"
        description="Kiểm tra thông tin trước khi tiếp tục."
        returnFocusRef={triggerRef}
        onClose={() => {
          onClose();
          setIsOpen(false);
        }}
      >
        <button type="button">Hủy</button>
        <button type="button">Đồng ý</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("announces its title and keeps keyboard focus inside", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }));

    const dialog = screen.getByRole("dialog", { name: "Xác nhận thao tác" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Kiểm tra thông tin trước khi tiếp tục.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng hộp thoại" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Đồng ý" })).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DialogHarness onClose={onClose} />);

    const trigger = screen.getByRole("button", { name: "Mở hộp thoại" });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

function ConfirmHarness() {
  const confirm = useConfirmDialog();
  const [result, setResult] = useState("chưa chọn");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const accepted = await confirm({
            title: "Xóa dữ liệu",
            description: "Hành động này không thể hoàn tác.",
            destructive: true,
          });
          setResult(accepted ? "đã xác nhận" : "đã hủy");
        }}
      >
        Xóa
      </button>
      <output>{result}</output>
    </>
  );
}

describe("ConfirmDialogProvider", () => {
  it("resolves the confirmation decision", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialogProvider>
        <ConfirmHarness />
      </ConfirmDialogProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(screen.getByText("đã xác nhận")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("requires the exact confirmation text for high-risk actions", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="Khôi phục dữ liệu"
        description="Hành động không thể hoàn tác."
        confirmationText="KHOI PHUC"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Xác nhận" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /KHOI PHUC/ }), "KHOI PHUC");
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
