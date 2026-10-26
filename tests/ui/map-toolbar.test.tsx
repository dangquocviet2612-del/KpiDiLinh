// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MapLegend,
  MapPanel,
  MapStyleMenu,
  MapToolbar,
  MapViewportControls,
} from "@/components/map";

describe("shared map controls", () => {
  it("exposes labelled toolbar, legend and side panel regions", () => {
    render(
      <>
        <MapToolbar label="Công cụ bản đồ khách hàng"><button>Tìm kiếm</button></MapToolbar>
        <MapLegend label="Chú giải khách hàng"><span>Khách hàng di động</span></MapLegend>
        <MapPanel labelledBy="node-list-title">
          <h2 id="node-list-title">Danh sách node</h2>
        </MapPanel>
      </>,
    );

    expect(screen.getByRole("region", { name: "Công cụ bản đồ khách hàng" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Chú giải khách hàng" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Danh sách node" })).toHaveAttribute("aria-modal", "false");
  });

  it("selects a map style with menu radio semantics", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MapStyleMenu
        open
        id="map-style-menu"
        label="Chọn kiểu bản đồ"
        value="light"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("menuitemradio", { name: "Bản đồ sáng" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Bản đồ tối" }));
    expect(onSelect).toHaveBeenCalledWith("dark");
  });

  it("provides consistent viewport actions", async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFit = vi.fn();
    render(<MapViewportControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} fitLabel="Hiện toàn bộ node" />);

    await user.click(screen.getByRole("button", { name: "Phóng to bản đồ" }));
    await user.click(screen.getByRole("button", { name: "Thu nhỏ bản đồ" }));
    await user.click(screen.getByRole("button", { name: "Hiện toàn bộ node" }));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
    expect(onFit).toHaveBeenCalledOnce();
  });
});
