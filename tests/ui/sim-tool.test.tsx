// @vitest-environment jsdom

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SimToolClient from "@/app/(dashboard)/tools/sim/SimToolClient";

// Mock canvas render function to avoid real image loading in jsdom
vi.mock("@/lib/tools-sim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tools-sim")>();
  return {
    ...actual,
    renderSimCardCanvas: vi.fn().mockResolvedValue(undefined),
    downloadCanvasImage: vi.fn(),
    copyCanvasToClipboard: vi.fn().mockResolvedValue(true),
  };
});

describe("SimToolClient: UI Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page header and core controls correctly", () => {
    render(<SimToolClient />);

    expect(screen.getByRole("heading", { name: /Ghi Thẻ Sim Viettel/i })).toBeInTheDocument();
    expect(screen.getByText(/1\. Chọn Mẫu Phôi SIM/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Số Điện Thoại Cần Ghi/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Dòng Phụ Đề/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải Ảnh Xuống/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sao Chép Ảnh/i })).toBeInTheDocument();
  });

  it("allows entering a new phone number and toggling format pattern", async () => {
    const user = userEvent.setup();
    render(<SimToolClient />);

    const phoneInput = screen.getByPlaceholderText(/0378\.869\.567/i);
    expect(phoneInput).toBeInTheDocument();

    await user.clear(phoneInput);
    await user.type(phoneInput, "0988123456");

    expect(phoneInput).toHaveValue("0988123456");

    // Click 4.3.3 button
    const pill433dot = screen.getByRole("button", { name: /4\.3\.3/i });
    fireEvent.click(pill433dot);
    expect(phoneInput).toHaveValue("0988.123.456");

    // Click 3-3-4 button
    const pill334 = screen.getByRole("button", { name: /3 - 3 - 4/i });
    fireEvent.click(pill334);
    expect(phoneInput).toHaveValue("098 812 3456");
  });

  it("updates subtitle text when quick suggestion is clicked", async () => {
    render(<SimToolClient />);

    const suggestionBtn = screen.getByRole("button", { name: /SIM CHÍNH CHỦ VIETTEL 5G/i });
    fireEvent.click(suggestionBtn);

    const subtitleInput = screen.getByPlaceholderText(/SỐ ĐẸP LẶP/i);
    expect(subtitleInput).toHaveValue("SIM CHÍNH CHỦ VIETTEL 5G");
  });

  it("allows selecting the Viettel 4G Hand template", () => {
    render(<SimToolClient />);

    const template4G = screen.getByText(/Viettel 4G Cầm Tay/i);
    expect(template4G).toBeInTheDocument();

    fireEvent.click(template4G);
    expect(screen.getByText(/Mẫu này không dùng phụ đề/i)).toBeInTheDocument();
  });

  it("hides Vinaphone and MobiFone from non-admin users", () => {
    render(<SimToolClient isAdmin={false} />);

    // Brand pills
    expect(screen.queryByRole("button", { name: /^Vinaphone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^MobiFone/i })).not.toBeInTheDocument();

    // Vina / Mobi templates
    expect(screen.queryByText(/VinaPhone 5G Xanh Nước Biển/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MobiFone 5G Xanh Đỏ/i)).not.toBeInTheDocument();
  });

  it("exposes Vinaphone and MobiFone templates with Admin badges to admin users", () => {
    render(<SimToolClient isAdmin={true} />);

    // Brand pills are present
    const vinaPill = screen.getByRole("button", { name: /^Vinaphone/i });
    const mobiPill = screen.getByRole("button", { name: /^MobiFone/i });
    expect(vinaPill).toBeInTheDocument();
    expect(mobiPill).toBeInTheDocument();

    // Filter by Vinaphone
    fireEvent.click(vinaPill);
    expect(screen.getByText(/VinaPhone 5G Xanh Nước Biển/i)).toBeInTheDocument();

    // Filter by MobiFone
    fireEvent.click(mobiPill);
    expect(screen.getByText(/MobiFone 5G Xanh Đỏ/i)).toBeInTheDocument();

    // Admin tags are visible
    const adminBadges = screen.getAllByText("Admin");
    expect(adminBadges.length).toBeGreaterThan(0);
  });
});
