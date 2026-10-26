// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";

function LegacyDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>({ onClose });

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Biểu mẫu thử nghiệm">
      <button type="button">Đóng</button>
      <input aria-label="Tên" />
      <button type="button">Lưu</button>
    </div>
  );
}

describe("useDialogAccessibility", () => {
  it("focuses, traps and dismisses a legacy dialog", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<LegacyDialog onClose={onClose} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Đóng" })).toHaveFocus());
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
