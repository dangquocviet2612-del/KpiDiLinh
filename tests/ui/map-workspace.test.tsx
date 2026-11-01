// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapDataSummary from "@/components/map/MapDataSummary";
import MapHeading from "@/components/map/MapHeading";
import MapViewportObserver from "@/components/map/MapViewportObserver";

const fixture = vi.hoisted(() => ({
  south: -1, west: -1, north: 1, east: 1, zoom: 12,
  callbacks: new Map<string, () => void>(),
  ready: undefined as (() => void) | undefined,
  on: vi.fn(), off: vi.fn(),
}));

vi.mock("react-leaflet", () => ({
  useMap: () => ({
    getBounds: () => ({ getSouth: () => fixture.south, getWest: () => fixture.west, getNorth: () => fixture.north, getEast: () => fixture.east }),
    getZoom: () => fixture.zoom,
    whenReady: (callback: () => void) => { fixture.ready = callback; },
    on: fixture.on,
    off: fixture.off,
  }),
}));

beforeEach(() => {
  Object.assign(fixture, { south: -1, west: -1, north: 1, east: 1, zoom: 12, ready: undefined });
  fixture.callbacks.clear();
  fixture.on.mockImplementation((events: string, callback: () => void) => {
    for (const event of events.split(" ")) fixture.callbacks.set(event, callback);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("map workspace summary", () => {
  it("separates loaded, coordinate, filtered and visible data", () => {
    render(<MapDataSummary label="Số liệu khách hàng" totalCount={10000} coordinateCount={9998} matchedCount={32} inViewportCount={12} scopeNote="Tối đa 10.000 khách hàng có tọa độ theo quyền truy cập." />);
    const summary = screen.getByRole("region", { name: "Số liệu khách hàng" });
    expect(within(summary).getByText("Đã tải")).toBeInTheDocument();
    expect(within(summary).getByText("10.000")).toBeInTheDocument();
    expect(within(summary).getByText("Có tọa độ")).toBeInTheDocument();
    expect(within(summary).getByText("Qua bộ lọc")).toBeInTheDocument();
    expect(within(summary).getByText("Trong khung")).toBeInTheDocument();
    expect(within(summary).getByText("32")).toBeInTheDocument();
    expect(within(summary).getByText("12")).toBeInTheDocument();
    expect(within(summary).getByText(/2 bản ghi chưa có tọa độ hợp lệ/)).toBeInTheDocument();
    expect(within(summary).getByText(/theo quyền truy cập/)).toBeInTheDocument();
    expect(summary).not.toHaveAttribute("aria-live");
  });

  it("keeps zero distinct from loading or unknown bounds", () => {
    const view = render(<MapDataSummary label="Số liệu node" totalLabel="Tổng node" totalCount={0} coordinateCount={0} matchedCount={0} inViewportCount={null} />);
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.getAllByText("—")).toHaveLength(1);
    expect(screen.getByText("Tổng node")).toBeInTheDocument();
    view.rerender(<MapDataSummary label="Số liệu node" totalCount={3} coordinateCount={2} matchedCount={1} inViewportCount={1} loading />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText(/chưa có tọa độ/)).not.toBeInTheDocument();
  });

  it("does not display invalid numeric data as a count", () => {
    render(<MapDataSummary label="Số liệu node" totalCount={NaN} coordinateCount={-1} matchedCount={Infinity} inViewportCount={1.5} />);
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("renders a real heading and a restrained eyebrow", () => {
    render(<MapHeading title="Bản đồ Node 0TB" eyebrow="Hạ tầng mạng" />);
    expect(screen.getByRole("heading", { name: "Bản đồ Node 0TB" })).toBeInTheDocument();
    expect(screen.getByText("Hạ tầng mạng")).toBeInTheDocument();
  });
});

describe("read-only map viewport observer", () => {
  it("waits for readiness, observes map changes and avoids duplicate snapshots", () => {
    const onChange = vi.fn();
    render(<MapViewportObserver onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    act(() => fixture.ready?.());
    expect(onChange).toHaveBeenLastCalledWith({ south: -1, west: -1, north: 1, east: 1, zoom: 12 });
    act(() => fixture.callbacks.get("moveend")?.());
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => { fixture.east = 2; fixture.callbacks.get("moveend")?.(); });
    act(() => { fixture.zoom = 13; fixture.callbacks.get("zoomend")?.(); });
    act(() => { fixture.north = 2; fixture.callbacks.get("resize")?.(); });
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("removes listeners and ignores late readiness callbacks after unmount", () => {
    const onChange = vi.fn();
    const view = render(<MapViewportObserver onChange={onChange} />);
    const ready = fixture.ready;
    view.unmount();
    expect(fixture.off).toHaveBeenCalledWith("moveend zoomend resize", expect.any(Function));
    expect(fixture.off).toHaveBeenCalledWith("load", expect.any(Function));
    act(() => ready?.());
    expect(onChange).not.toHaveBeenCalled();
  });
});
