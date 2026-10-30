// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Node0TbMap from "@/app/(dashboard)/node-0tb/Node0TbMap";
import type { Node0TbItem } from "@/types";

type MapItem = Pick<Node0TbItem, "id" | "nodeCode" | "dateKdFormatted" | "totalPort" | "categoryKd" | "latitude" | "longitude" | "hasCoordinates">;
type FixtureMarker = {
  coordinates: number[];
  options: { title: string };
  popup?: () => string;
  bindTooltip: ReturnType<typeof vi.fn>;
  bindPopup: ReturnType<typeof vi.fn>;
  openPopup: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  role: "ADMIN",
  fetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  clipboard: vi.fn(),
  geolocation: vi.fn(),
  markers: [] as FixtureMarker[],
  cluster: { addLayers: vi.fn(), zoomToShowLayer: vi.fn() },
  map: { flyTo: vi.fn(), invalidateSize: vi.fn(), addLayer: vi.fn(), removeLayer: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), fitBounds: vi.fn() },
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: mocks.role } } }) }));
vi.mock("react-hot-toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map-canvas">{children}</div>,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => mocks.map,
}));
vi.mock("leaflet.markercluster", () => ({}));
vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(),
    divIcon: vi.fn(),
    Marker: { prototype: { options: {} } },
    latLngBounds: (coordinates: number[][]) => coordinates,
    markerClusterGroup: () => mocks.cluster,
    marker: (coordinates: number[], options: { title: string }) => {
      const marker: FixtureMarker = {
        coordinates,
        options,
        bindTooltip: vi.fn(),
        bindPopup: vi.fn((popup: () => string) => { marker.popup = popup; }),
        openPopup: vi.fn(),
      };
      mocks.markers.push(marker);
      return marker;
    },
  },
}));

const nodes: MapItem[] = [
  { id: "zero", nodeCode: "FIXTURE-<A>'\"&", dateKdFormatted: "28/10/<2026>", totalPort: 0, categoryKd: "Group <A> & \"0\"", latitude: 0, longitude: 0, hasCoordinates: true },
  { id: "normal", nodeCode: "FIXTURE-B", dateKdFormatted: null, totalPort: 16, categoryKd: "Group B", latitude: 11, longitude: 107, hasCoordinates: true },
  { id: "missing", nodeCode: "FIXTURE-MISSING", dateKdFormatted: null, totalPort: null, categoryKd: "Group B", latitude: null, longitude: null, hasCoordinates: false },
];
const payload = {
  nodes,
  stats: {
    total: 3, withCoords: 2, withoutCoords: 1,
    categories: [{ category: nodes[0].categoryKd, count: 1, withCoords: 1 }, { category: "Group B", count: 2, withCoords: 1 }],
  },
  categories: [nodes[0].categoryKd, "Group B"],
};
const projectedUrl = "/api/node-0tb?projection=map";

async function loaded() {
  render(<Node0TbMap />);
  await screen.findByText("Hiển thị 2 node trên bản đồ");
  await waitFor(() => expect(mocks.cluster.addLayers).toHaveBeenCalled());
}

function latestMarker(code: string) {
  const marker = mocks.markers.filter((entry) => entry.options.title === code).at(-1);
  if (!marker) throw new Error("Missing fixture marker");
  return marker;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "ADMIN";
  mocks.markers = [];
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => payload });
  mocks.clipboard.mockResolvedValue(undefined);
  mocks.cluster.zoomToShowLayer.mockImplementation((_marker, callback: () => void) => callback());
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), {
    clipboard: { writeText: mocks.clipboard },
    geolocation: { getCurrentPosition: mocks.geolocation },
  }));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Node0Tb map DTO consumer", () => {
  it("opts in with one projected GET and retains full category counts and mapped marker count", async () => {
    await loaded();
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(projectedUrl);
    expect(screen.getByRole("button", { name: "Tất cả3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: 'Group <A> & "0"1' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Group B2" })).toBeInTheDocument();
    expect(mocks.cluster.addLayers.mock.calls.at(-1)?.[0]).toHaveLength(2);
    expect(latestMarker(nodes[0].nodeCode).coordinates).toEqual([0, 0]);
    expect(mocks.markers.some((marker) => marker.options.title === "FIXTURE-MISSING")).toBe(false);
  });

  it("retains list fields, null fallbacks, zero ports and local code/category search without more requests", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Xem danh sách Node 0TB" }));
    const panel = screen.getByRole("dialog", { name: "Danh sách Node 0TB" });
    expect(within(panel).getByText("Tổng 3 node")).toBeInTheDocument();
    expect(within(panel).getByText("Ngày KD: 28/10/<2026> • 0 port")).toBeInTheDocument();
    expect(within(panel).getByText("Ngày KD: - • -")).toBeInTheDocument();
    expect(within(panel).getByText("⚠ Chưa có tọa độ")).toBeInTheDocument();
    const search = within(panel).getByRole("textbox", { name: "Lọc danh sách theo mã node hoặc phân loại" });
    fireEvent.change(search, { target: { value: "missing" } });
    expect(within(panel).getByText("FIXTURE-MISSING")).toBeInTheDocument();
    expect(within(panel).queryByText("FIXTURE-B")).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /FIXTURE-MISSING/ }));
    expect(mocks.error).toHaveBeenCalledWith("Node FIXTURE-MISSING chưa có tọa độ trên hệ thống.");
    fireEvent.change(search, { target: { value: "group b" } });
    expect(within(panel).getByText("Tổng 2 node")).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("retains local category filters and fit/zoom controls including zero coordinates", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: 'Group <A> & "0"1' }));
    expect(screen.getByText("Hiển thị 1 node trên bản đồ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hiện toàn bộ Node 0TB" }));
    expect(mocks.map.fitBounds).toHaveBeenCalledWith([[0, 0]], { padding: [48, 48], maxZoom: 16 });
    fireEvent.click(screen.getByRole("button", { name: "Phóng to bản đồ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thu nhỏ bản đồ" }));
    expect(mocks.map.zoomIn).toHaveBeenCalledOnce();
    expect(mocks.map.zoomOut).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Tất cả3" }));
    expect(screen.getByText("Hiển thị 2 node trên bản đồ")).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("retains escaped popup content, directions and clipboard actions with only eight fields", async () => {
    await loaded();
    const html = latestMarker(nodes[0].nodeCode).popup!();
    const popup = new DOMParser().parseFromString(html, "text/html");
    expect(popup.querySelector("h3")?.textContent).toBe(nodes[0].nodeCode);
    expect(popup.body.textContent).toContain("28/10/<2026>");
    expect(popup.body.textContent).toContain('Group <A> & "0"');
    expect(popup.body.textContent).toContain("0.000000, 0.000000");
    expect(popup.body.textContent).toContain("Tổng Port");
    expect(popup.querySelector("script")).toBeNull();
    expect(popup.querySelector("a")?.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=0,0");
    const copyAction = popup.querySelector("button")?.getAttribute("onclick");
    expect(copyAction).toContain("copyNode0TbCode");
    expect(copyAction).toContain(encodeURIComponent(nodes[0].nodeCode).replace(/'/g, "%27"));
    await act(async () => { window.dispatchEvent(new CustomEvent("copyNode0TbCode", { detail: nodes[0].nodeCode })); });
    expect(mocks.clipboard).toHaveBeenCalledExactlyOnceWith(nodes[0].nodeCode);
    expect(mocks.success).toHaveBeenCalledWith(`Đã sao chép: ${nodes[0].nodeCode}`);
  });

  it("retains name search, cross-category selection and popup opening", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: 'Group <A> & "0"1' }));
    const search = screen.getByRole("combobox", { name: "Tìm Node 0TB trên bản đồ" });
    fireEvent.change(search, { target: { value: "fixture-b" } });
    fireEvent.click(screen.getByRole("option", { name: /FIXTURE-B/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledWith([11, 107], 17, { duration: 0.9 }));
    await waitFor(() => expect(latestMarker("FIXTURE-B").openPopup).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Tất cả3" })).toHaveAttribute("aria-pressed", "true");
    expect(search).toHaveValue("");
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("retains coordinate search and GPS denied/success directions", async () => {
    await loaded();
    const search = screen.getByRole("combobox", { name: "Tìm Node 0TB trên bản đồ" });
    fireEvent.change(search, { target: { value: "0, 0" } });
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledWith([0, 0], 17, { duration: 0.9 }));
    mocks.geolocation.mockImplementationOnce((_success, failure: () => void) => failure());
    fireEvent.click(screen.getByRole("button", { name: "Vị trí của tôi" }));
    expect(mocks.error).toHaveBeenCalledWith("Không thể lấy vị trí hiện tại. Hãy kiểm tra quyền GPS của trình duyệt.");
    mocks.geolocation.mockImplementationOnce((success: (position: { coords: { latitude: number; longitude: number } }) => void) => success({ coords: { latitude: 1, longitude: 2 } }));
    fireEvent.click(screen.getByRole("button", { name: "Vị trí của tôi" }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledWith([1, 2], 16, { duration: 1.2 }));
    const popup = new DOMParser().parseFromString(latestMarker(nodes[0].nodeCode).popup!(), "text/html");
    expect(popup.querySelector("a")?.getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&origin=1,2&destination=0,0");
    expect(popup.body.textContent).toContain("km");
  });

  it.each(["ADMIN", "MANAGER", "CTV"])("retains %s admin-only upload/template controls and shared read UI", async (role) => {
    mocks.role = role;
    await loaded();
    const admin = screen.queryByRole("button", { name: "Quản trị dữ liệu Node 0TB" });
    if (role === "ADMIN") {
      fireEvent.click(admin!);
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Upload Excel (.xlsx, .xlsm)" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Tải file mẫu Excel" })).toHaveAttribute("href", "/api/node-0tb/template");
      expect(within(menu).getByRole("menuitem", { name: "Tải file mẫu Excel" })).toHaveAttribute("download", "Mau_Node_0TB.xlsx");
    } else {
      expect(admin).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Tải file mẫu Excel" })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Xem danh sách Node 0TB" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("refreshes through the same projected URL after a failed initial response", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false });
    render(<Node0TbMap />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được bản đồ Node 0TB");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Hiển thị 2 node trên bản đồ");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls).toEqual([[projectedUrl], [projectedUrl]]);
  });

  it("keeps explicit upload independent and refreshes using projection after success", async () => {
    await loaded();
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: "fixture upload accepted" }) });
    fireEvent.click(screen.getByRole("button", { name: "Quản trị dữ liệu Node 0TB" }));
    const input = screen.getByRole("menuitem", { name: "Upload Excel (.xlsx, .xlsm)" }).querySelector("input")!;
    const file = new File(["fixture-only"], "fixture.xlsx");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
    expect(mocks.fetch.mock.calls[0]).toEqual([projectedUrl]);
    expect(mocks.fetch.mock.calls[1][0]).toBe("/api/node-0tb/upload");
    expect(mocks.fetch.mock.calls[1][1].method).toBe("POST");
    expect(mocks.fetch.mock.calls[1][1].body.get("file")).toBe(file);
    expect(mocks.fetch.mock.calls[2]).toEqual([projectedUrl]);
    expect(mocks.success).toHaveBeenCalledWith("fixture upload accepted");
    await screen.findByText("Hiển thị 2 node trên bản đồ");
  });
});
