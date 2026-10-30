// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToolPageFrameClean from "@/app/(dashboard)/tools/ToolPageFrameClean";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const excelSrc = "/tools/chia-file-son/index.html?view=excel&single=1&embedded=1";
const photoSrc = "/tools/chia-file-son/sua-anh/index.html?single=1&embedded=1";
const slowMessage = "Công cụ tải lâu hơn dự kiến. Nếu nội dung chưa xuất hiện, bạn có thể tải lại.";
const errorMessage = "Chưa tải được khung công cụ. Bạn có thể thử tải lại.";
const reloadWarning = "Tải lại sẽ làm mất tệp đang chọn và thay đổi chưa lưu trong công cụ.";
const toolCases = [
  { activeTool: "receipt" as const, title: "Phiếu thu", iframeSrc: "/tools/chia-file-son/index.html?view=receipt&single=1&embedded=1" },
  { activeTool: "excel" as const, title: "Excel", iframeSrc: excelSrc },
  { activeTool: "photo" as const, title: "Sửa ảnh", iframeSrc: photoSrc },
];

async function renderExcel() {
  return render(await ToolPageFrameClean({ activeTool: "excel", iframeSrc: excelSrc }));
}

function iframe(title = "Excel") {
  return screen.getByTitle<HTMLIFrameElement>(title);
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.auth.mockReset().mockResolvedValue({ user: { role: "ADMIN" } });
  mocks.redirect.mockReset().mockImplementation((destination: string) => { throw new Error(`redirect:${destination}`); });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("tool frame feedback and server access", () => {
  it.each(toolCases)("labels $activeTool in Vietnamese and retains its exact source", async ({ activeTool, title, iframeSrc }) => {
    render(await ToolPageFrameClean({ activeTool, iframeSrc }));
    const frame = iframe(title);
    expect(frame).toHaveAttribute("src", iframeSrc);
    expect(frame).toHaveAttribute("aria-busy", "true");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(`Đang tải công cụ ${title}…`);
    expect(frame).toHaveAttribute("aria-describedby", status.id);
    expect(screen.queryByRole("button", { name: "Tải lại công cụ" })).not.toBeInTheDocument();
  });

  it.each(["ADMIN", "MANAGER"])("preserves advanced tools access for %s", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    await renderExcel();
    expect(iframe()).toHaveAttribute("src", excelSrc);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["STAFF", "UNKNOWN", null, undefined])("redirects forbidden roles before returning a frame: %s", async (role) => {
    mocks.auth.mockResolvedValue({ user: { role } });
    await expect(ToolPageFrameClean({ activeTool: "excel", iframeSrc: excelSrc })).rejects.toThrow("redirect:/");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/");
    expect(document.querySelector("iframe")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([{ session: null }, { session: {} }])("redirects missing sessions before returning a frame: $session", async ({ session }) => {
    mocks.auth.mockResolvedValue(session);
    await expect(ToolPageFrameClean({ activeTool: "excel", iframeSrc: excelSrc })).rejects.toThrow("redirect:/login");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("awaits the server access guard before producing the client frame", async () => {
    let finish!: (value: { user: { role: string } }) => void;
    mocks.auth.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    let returned = false;
    const result = ToolPageFrameClean({ activeTool: "excel", iframeSrc: excelSrc }).then((element) => { returned = true; return element; });
    try {
      await Promise.resolve();
      expect(returned).toBe(false);
      expect(document.querySelector("iframe")).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally { finish({ user: { role: "ADMIN" } }); }
    render(await result);
    expect(iframe()).toBeInTheDocument();
  });

  it("removes the notice and timer after load without claiming the embedded app succeeded", async () => {
    await renderExcel(); const frame = iframe();
    fireEvent.load(frame);
    expect(frame).toHaveAttribute("aria-busy", "false");
    expect(frame).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(iframe()).toBe(frame);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps loading before the warning threshold", async () => {
    await renderExcel();
    act(() => { vi.advanceTimersByTime(14_999); });
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải công cụ Excel…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("warns after 15 seconds without cancelling, hiding, or automatically replacing the iframe", async () => {
    await renderExcel(); const frame = iframe();
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByRole("alert")).toHaveTextContent(slowMessage);
    expect(screen.getByText(reloadWarning)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lại công cụ" })).toHaveAttribute("type", "button");
    expect(frame).toHaveAttribute("aria-busy", "false");
    expect(frame).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(frame).not.toHaveAttribute("hidden"); expect(frame).not.toHaveAttribute("inert");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(iframe()).toBe(frame); expect(frame).toHaveAttribute("src", excelSrc);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("exposes a neutral error and manual reload when an error event is received", async () => {
    await renderExcel(); const frame = iframe();
    fireEvent.error(frame);
    expect(screen.getByRole("alert")).toHaveTextContent(errorMessage);
    expect(screen.getByText(reloadWarning)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lại công cụ" })).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByRole("alert")).toHaveTextContent(errorMessage);
    expect(iframe()).toBe(frame);
  });

  it("accepts a late load after the slow warning", async () => {
    await renderExcel(); const frame = iframe();
    act(() => { vi.advanceTimersByTime(15_000); });
    fireEvent.load(frame);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(iframe()).toBe(frame); expect(frame).toHaveAttribute("aria-busy", "false");
  });

  it("reloads only on a deliberate click, preserving src and resetting the attempt timer", async () => {
    await renderExcel(); const original = iframe();
    act(() => { vi.advanceTimersByTime(15_000); });
    fireEvent.click(screen.getByRole("button", { name: "Tải lại công cụ" }));
    const replacement = iframe();
    expect(replacement).not.toBe(original); expect(original).not.toBeInTheDocument();
    expect(replacement).toHaveFocus();
    expect(replacement).toHaveAttribute("src", excelSrc);
    expect(replacement).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải công cụ Excel…");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(14_999); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole("alert")).toHaveTextContent(slowMessage);
  });

  it("allows retry after error and ignores events from the detached previous frame", async () => {
    await renderExcel(); const original = iframe();
    fireEvent.error(original);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại công cụ" }));
    act(() => { vi.advanceTimersByTime(0); });
    const replacement = iframe();
    fireEvent.load(original); fireEvent.error(original);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải công cụ Excel…");
    expect(replacement).toHaveAttribute("aria-busy", "true");
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.load(replacement);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets feedback and timer when the source changes", async () => {
    const view = await renderExcel(); const original = iframe();
    act(() => { vi.advanceTimersByTime(10_000); });
    view.rerender(await ToolPageFrameClean({ activeTool: "photo", iframeSrc: photoSrc }));
    const replacement = iframe("Sửa ảnh");
    expect(replacement).not.toBe(original); expect(replacement).toHaveAttribute("src", photoSrc);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải công cụ Sửa ảnh…");
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent(slowMessage);
  });

  it("retains a loaded iframe across an unchanged parent render", async () => {
    const view = await renderExcel(); const original = iframe();
    fireEvent.load(original);
    view.rerender(await ToolPageFrameClean({ activeTool: "excel", iframeSrc: excelSrc }));
    expect(iframe()).toBe(original);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["loading", "slow", "error", "loaded"])("releases the attempt timer on unmount from %s", async (state) => {
    const view = await renderExcel();
    if (state === "slow") act(() => { vi.advanceTimersByTime(15_000); });
    if (state === "error") fireEvent.error(iframe());
    if (state === "loaded") fireEvent.load(iframe());
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(document.querySelector("iframe")).toBeNull();
  });
});
