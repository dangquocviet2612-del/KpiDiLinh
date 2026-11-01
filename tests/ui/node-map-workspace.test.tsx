// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeMapComponent from "@/app/(dashboard)/node-map/NodeMapComponent";

const mocks = vi.hoisted(() => ({
  role: "CTV", fetch: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: mocks.role } } }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useMapSearch", () => ({ useMapSearch: () => ({ items: [], loading: false }) }));
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="map-canvas" />,
  Marker: () => null, Popup: () => null, TileLayer: () => null, useMap: () => null,
}));
vi.mock("leaflet", () => ({ default: { icon: vi.fn(), divIcon: vi.fn(), Marker: { prototype: { options: {} } } } }));

const nodes = [
  { id: "zero", name: "ZERO", latitude: 0, longitude: 0, portEfficiency: 0.1 },
  { id: "normal", name: "NORMAL", latitude: 11, longitude: 107, portEfficiency: 0.5 },
];

beforeEach(() => {
  mocks.role = "CTV";
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: nodes }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function loaded() {
  render(<NodeMapComponent />);
  await waitFor(() => expect(screen.queryByText("Đang tải bản đồ hạ tầng")).not.toBeInTheDocument());
}

describe("Node map workspace", () => {
  it("provides a heading, four scoped metrics, labelled actions and collapsed filters", async () => {
    await loaded();
    expect(screen.getByRole("heading", { name: "Bản đồ Node" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Số liệu bản đồ Node" })).toBeInTheDocument();
    expect(screen.getByText("Đã tải").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Có tọa độ").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Qua bộ lọc").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Trong khung").parentElement).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Vị trí của tôi" })).toHaveTextContent("Vị trí");
    expect(screen.getByRole("button", { name: "Thao tác" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Dưới 13%:/ })).not.toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
  });

  it("keeps the selected filter while collapsed and search does not silently filter nodes", async () => {
    await loaded();
    const toggle = screen.getByRole("button", { name: "Bộ lọc" });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /Dưới 13%:/ }));
    expect(screen.getByText("Qua bộ lọc").parentElement).toHaveTextContent("1");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Đang lọc/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "no match" } });
    expect(screen.getByText("Qua bộ lọc").parentElement).toHaveTextContent("1");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Dưới 13%:/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Xóa toàn bộ bộ lọc bản đồ" }));
    expect(screen.getByText("Qua bộ lọc").parentElement).toHaveTextContent("2");
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("retains %s options permissions", async (role) => {
    mocks.role = role;
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Thao tác" }));
    expect(screen.getByRole("menuitem", { name: "Xuất Excel" })).toBeInTheDocument();
    expect(Boolean(screen.queryByRole("menuitem", { name: "Nhập vị trí KML/KMZ" }))).toBe(role === "ADMIN");
  });
});
