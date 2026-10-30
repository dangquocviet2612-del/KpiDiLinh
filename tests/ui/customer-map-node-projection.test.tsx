// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";
import MapComponent from "@/app/(dashboard)/map/MapComponent";

type FixtureMarker = {
  coordinates: number[];
  options: { title: string; customerId?: string };
  popup?: string;
  bindPopup: ReturnType<typeof vi.fn>;
  openPopup: ReturnType<typeof vi.fn<() => void>>;
  closePopup: ReturnType<typeof vi.fn>;
};
type ClusterEvent = { sourceTarget?: Pick<FixtureMarker, "options">; popup: { getLatLng: () => { lat: number; lng: number } } };
type FixtureCluster = { on: ReturnType<typeof vi.fn>; addLayers: ReturnType<typeof vi.fn>; zoomToShowLayer: ReturnType<typeof vi.fn> };
type ModalProps = { customer: unknown; defaultLocation: unknown; onClose: () => void; onRefresh: () => void };

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  geolocation: vi.fn(),
  clipboard: vi.fn(),
  search: vi.fn(),
  modal: vi.fn(),
  autoMoveEnd: true,
  stopMoveEnd: false,
  markers: [] as FixtureMarker[],
  clusterEvents: {} as Record<string, (event: ClusterEvent) => void>,
  mapClick: undefined as undefined | ((event: { latlng: { lat: number; lng: number } }) => void),
  cluster: { on: vi.fn(), addLayers: vi.fn(), zoomToShowLayer: vi.fn() },
  clusterFactory: vi.fn<() => FixtureCluster>(),
  map: { addLayer: vi.fn(), removeLayer: vi.fn(), flyTo: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), fitBounds: vi.fn(), stop: vi.fn(), once: vi.fn(), off: vi.fn(), fire: vi.fn<(name: string) => void>() },
}));

vi.mock("react-hot-toast", () => ({ toast: { success: mocks.success, error: mocks.error, loading: mocks.loading } }));
vi.mock("@/hooks/useMapSearch", () => ({ useMapSearch: mocks.search }));
vi.mock("@/components/CustomerModalRefined", () => ({ default: (props: ModalProps) => {
  mocks.modal(props);
  return <div role="dialog" aria-label="Customer form boundary">
    <button onClick={props.onClose}>Close form</button>
    <button onClick={props.onRefresh}>Refresh customers</button>
  </div>;
} }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map-canvas">{children}</div>,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Circle: ({ center, radius }: { center: number[]; radius: number }) => <output data-testid="nearest-circle">{JSON.stringify({ center, radius })}</output>,
  Polyline: ({ positions }: { positions: number[][] }) => <output data-testid="nearest-line">{JSON.stringify(positions)}</output>,
  useMap: () => mocks.map,
  useMapEvents: (handlers: { click: typeof mocks.mapClick }) => { mocks.mapClick = handlers.click; return mocks.map; },
}));
vi.mock("leaflet.markercluster", () => ({}));
vi.mock("leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("leaflet")>();
  return { default: {
    ...actual,
    icon: vi.fn(),
    divIcon: vi.fn(),
    Marker: { prototype: { options: {} } },
    markerClusterGroup: () => mocks.clusterFactory(),
    marker: (coordinates: number[], options: FixtureMarker["options"]) => {
      const marker: FixtureMarker = {
        coordinates,
        options,
        bindPopup: vi.fn((popup: string) => { marker.popup = popup; }),
        openPopup: vi.fn(() => mocks.clusterEvents.popupopen?.({
          sourceTarget: marker,
          popup: { getLatLng: () => ({ lat: coordinates[0], lng: coordinates[1] }) },
        })),
        closePopup: vi.fn(),
      };
      mocks.markers.push(marker);
      return marker;
    },
  } };
});

const customer = Object.freeze({
  id: "fixture-customer", name: "Fixture customer", account: "fixture-account", phone: "0900000000",
  address: "Fixture address", latitude: 11, longitude: 107, subscriberType: "FIXED", billingType: "MONTHLY",
  nodeName: "Old node", package: "Fixture package", ctvCode: "CTV_A",
});
const nodes = [
  { id: "far", name: "Far", latitude: 12, longitude: 107 },
  { id: "first", name: "First nearest <node>", latitude: 11, longitude: 107.001 },
  { id: "tie", name: "Equal-distance later", latitude: 11, longitude: 107.001 },
  { id: "zero", name: "Zero node", latitude: 0, longitude: 0 },
];
const nodeUrl = "/api/nodes?projection=coordinates";
const customerUrl = "/api/customers/map-data?hasCoordinates=true&includeDetails=true&take=10000";

function reply(data: unknown, ok = true) {
  return { ok, json: async () => data };
}

async function loaded(groups?: FixtureCluster[]) {
  render(<MapComponent />);
  await waitFor(() => expect(screen.queryByText("Đang tải bản đồ")).not.toBeInTheDocument());
  if (groups) await waitFor(() => expect(groups.at(-1)?.addLayers).toHaveBeenCalled());
  else await waitFor(() => expect(mocks.cluster.addLayers).toHaveBeenCalled());
}

async function dispatch(name: string, detail: unknown) {
  await act(async () => { window.dispatchEvent(new CustomEvent(name, { detail })); });
}

function writes() {
  return mocks.fetch.mock.calls.filter((call) => call[1]?.method === "PUT");
}

function latestMarker() {
  const marker = mocks.markers.at(-1);
  if (!marker) throw new Error("Missing customer marker");
  return marker;
}

function useDistinctClusters() {
  const groups: FixtureCluster[] = [];
  mocks.clusterFactory.mockImplementation(() => {
    const group = {
      on: vi.fn((name: string, callback: (event: ClusterEvent) => void) => { mocks.clusterEvents[name] = callback; }),
      addLayers: vi.fn(),
      zoomToShowLayer: vi.fn((_marker: FixtureMarker, callback: () => void) => callback()),
    };
    groups.push(group);
    return group;
  });
  return groups;
}

function groupForMarker(groups: FixtureCluster[], marker: FixtureMarker) {
  const group = groups.findLast((candidate) => candidate.addLayers.mock.calls.some(([markers]) => markers.includes(marker)));
  if (!group) throw new Error("Missing marker owner group");
  return group;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markers = [];
  mocks.clusterEvents = {};
  mocks.mapClick = undefined;
  mocks.autoMoveEnd = true;
  mocks.stopMoveEnd = false;
  const mapEvents = L.featureGroup();
  mocks.map.once.mockImplementation((name: string, callback: () => void) => mapEvents.once(name, callback));
  mocks.map.off.mockImplementation((name: string, callback: () => void) => mapEvents.off(name, callback));
  mocks.map.fire.mockImplementation((name: string) => { mapEvents.fire(name); });
  mocks.map.stop.mockImplementation(() => { if (mocks.stopMoveEnd) mocks.map.fire("moveend"); });
  mocks.map.flyTo.mockImplementation(() => { if (mocks.autoMoveEnd) mocks.map.fire("moveend"); });
  mocks.fetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === customerUrl) return reply({ data: [customer] });
    if (url.startsWith("/api/nodes")) return reply({ data: nodes });
    if (url === `/api/customers/${customer.id}` && options?.method === "PUT") {
      return reply({ ...customer, ...JSON.parse(options.body as string) });
    }
    throw new Error(`Unexpected fixture request ${url}`);
  });
  mocks.search.mockReturnValue({ items: [customer], loading: false });
  mocks.loading.mockReturnValue("fixture-toast");
  mocks.clipboard.mockResolvedValue(undefined);
  mocks.geolocation.mockReset();
  mocks.cluster.on.mockImplementation((name: string, callback: (event: ClusterEvent) => void) => { mocks.clusterEvents[name] = callback; });
  mocks.cluster.zoomToShowLayer.mockImplementation((_marker, callback: () => void) => callback());
  mocks.clusterFactory.mockReturnValue(mocks.cluster);
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

describe("customer map coordinates DTO consumer", () => {
  it("uses one projected node request alongside the unchanged customer and search URLs", async () => {
    await loaded();
    expect(mocks.fetch.mock.calls).toEqual([[customerUrl], [nodeUrl]]);
    expect(mocks.search).toHaveBeenLastCalledWith({ endpoint: "/api/customers/search-map", query: "", limit: 20 });
    expect(latestMarker().coordinates).toEqual([11, 107]);
    expect(latestMarker().popup).toContain("Fixture package");
    expect(latestMarker().popup).toContain("fixture-account");
    expect(latestMarker().popup).not.toContain("assignNode");
    expect(mocks.geolocation).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });

  it("uses the real nearest-distance loop and first equal-distance row for selection/polyline", async () => {
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Danh sách khách hàng" })).getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(latestMarker().openPopup).toHaveBeenCalled());
    expect(screen.getByTestId("nearest-line").textContent).toBe(JSON.stringify([[11, 107], [11, 107.001]]));
    expect(screen.getByTestId("nearest-circle").textContent).toBe(JSON.stringify({ center: [11, 107], radius: 150 }));
    await dispatch("assignNode", customer.id);
    const dialog = screen.getByRole("dialog", { name: "Gán Node gần nhất" });
    const distance = Math.round(L.latLng(11, 107).distanceTo(L.latLng(11, 107.001)));
    expect(dialog).toHaveTextContent(`Node gần nhất là First nearest <node> (cách ${distance}m)`);
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Đồng ý" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Gán node thành công!", { id: "fixture-toast" }));
    expect(writes()).toEqual([[`/api/customers/${customer.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeName: nodes[1].name }),
    }]]);
    expect(mocks.fetch.mock.calls.filter((call) => call[0].startsWith("/api/nodes"))).toEqual([[nodeUrl]]);
    await dispatch("customerSelected", null);
    expect(screen.queryByTestId("nearest-line")).not.toBeInTheDocument();
  });

  it.each(["cancel", "escape"])("keeps assignment confirmation %s free of writes", async (action) => {
    await loaded();
    await dispatch("assignNode", customer.id);
    const dialog = screen.getByRole("dialog", { name: "Gán Node gần nhất" });
    if (action === "cancel") fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    else fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("preserves first-row order when the equal-distance response order reverses", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ data: [customer] }))
      .mockResolvedValueOnce(reply({ data: [nodes[2], nodes[1]] }));
    await loaded();
    await dispatch("assignNode", customer.id);
    expect(screen.getByRole("dialog")).toHaveTextContent("Equal-distance later");
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(JSON.parse(writes()[0][1].body)).toEqual({ nodeName: "Equal-distance later" });
  });

  it("retains zero node coordinates without fixing the existing zero-customer assignment guard", async () => {
    const zeroCustomer = { ...customer, latitude: 0, longitude: 0 };
    mocks.fetch.mockResolvedValueOnce(reply({ data: [zeroCustomer] }))
      .mockResolvedValueOnce(reply({ data: [nodes[3]] }));
    await loaded();
    await dispatch("customerSelected", zeroCustomer);
    expect(screen.getByTestId("nearest-line").textContent).toBe("[[0,0],[0,0]]");
    await dispatch("assignNode", customer.id);
    expect(mocks.error).toHaveBeenCalledWith("Khách hàng này chưa có vị trí trên bản đồ.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("keeps empty-node selection and assignment boundaries", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ data: [customer] })).mockResolvedValueOnce(reply({ data: [] }));
    await loaded();
    await dispatch("customerSelected", customer);
    expect(screen.queryByTestId("nearest-line")).not.toBeInTheDocument();
    await dispatch("assignNode", customer.id);
    expect(mocks.error).toHaveBeenCalledWith("Chưa tải dữ liệu node hoặc danh sách node trống.");
    expect(writes()).toEqual([]);
  });

  it("retains assignment HTTP failure behavior and the same PUT payload", async () => {
    await loaded();
    mocks.fetch.mockResolvedValueOnce(reply({ error: "fixture rejected" }, false));
    await dispatch("assignNode", customer.id);
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Gán node thất bại.", { id: "fixture-toast" }));
    expect(JSON.parse(writes()[0][1].body)).toEqual({ nodeName: nodes[1].name });
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("retains local list/search selection and search-hook parameters without extra node requests", async () => {
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Lọc danh sách khách hàng" }), { target: { value: "no match" } });
    expect(screen.getByText("Không có khách hàng phù hợp.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fixture" } });
    expect(mocks.search).toHaveBeenLastCalledWith({ endpoint: "/api/customers/search-map", query: "Fixture", limit: 20 });
    fireEvent.click(screen.getByRole("option", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledWith([11, 107], 17, { duration: 1.2 }));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(mocks.fetch.mock.calls).toEqual([[customerUrl], [nodeUrl]]);
  });

  it("retains GPS denied/success boundaries and coordinate-only location PUT", async () => {
    await loaded();
    mocks.geolocation.mockImplementationOnce((_success, failure: () => void) => failure());
    fireEvent.click(screen.getByRole("button", { name: "Vị trí của tôi" }));
    expect(mocks.error).toHaveBeenCalledWith("Không thể lấy vị trí hiện tại. Hãy kiểm tra quyền GPS của trình duyệt.");
    expect(writes()).toEqual([]);
    mocks.geolocation.mockImplementationOnce((success: (position: { coords: { latitude: number; longitude: number } }) => void) => success({ coords: { latitude: 10, longitude: 106 } }));
    fireEvent.click(screen.getByRole("button", { name: "Vị trí của tôi" }));
    expect(mocks.geolocation.mock.calls[1][2]).toEqual({ enableHighAccuracy: true, timeout: 10000 });
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledWith([10, 106], 15, { duration: 1.2 }));
    await dispatch("updateCustomerLoc", customer.id);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Cập nhật tọa độ thành công!", { id: "fixture-toast" }));
    expect(writes()).toEqual([[`/api/customers/${customer.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: 10, longitude: 106 }),
    }]]);
  });

  it("keeps create/edit modal props and customer refresh separate from node bootstrap", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Thêm khách hàng" }));
    expect(mocks.modal.mock.lastCall?.[0]).toMatchObject({ customer: null, defaultLocation: null });
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    await dispatch("editCustomer", customer.id);
    expect(mocks.modal.mock.lastCall?.[0]).toMatchObject({ customer, defaultLocation: null });
    fireEvent.click(screen.getByRole("button", { name: "Refresh customers" }));
    await waitFor(() => expect(mocks.fetch.mock.calls.filter((call) => call[0] === customerUrl)).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    await act(async () => { mocks.mapClick?.({ latlng: { lat: 2, lng: 3 } }); });
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Thêm khách hàng tại vị trí này?");
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý" }));
    expect(mocks.modal.mock.lastCall?.[0]).toMatchObject({ customer: null, defaultLocation: { latitude: 2, longitude: 3 } });
    expect(mocks.fetch.mock.calls.filter((call) => call[0].startsWith("/api/nodes"))).toEqual([[nodeUrl]]);
    expect(writes()).toEqual([]);
  });

  it("retains customer failure/retry and empty-list states without refetching nodes", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ error: "fixture failure" }, false));
    render(<MapComponent />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được bản đồ khách hàng");
    mocks.fetch.mockResolvedValueOnce(reply({ data: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByTitle("Xem danh sách khách hàng trên bản đồ")).toHaveTextContent("0 khách hàng trên bản đồ");
    expect(mocks.fetch.mock.calls).toEqual([[customerUrl], [nodeUrl], [customerUrl]]);
    expect(writes()).toEqual([]);
  });

  it.each([0, 0.000004])("selects the opened marker ID instead of a customer within %s degrees", async (offset) => {
    const second = Object.freeze({ ...customer, id: "second-<id>'\"&", name: "Second customer", latitude: customer.latitude + offset });
    mocks.fetch.mockResolvedValueOnce(reply({ data: [customer, second] })).mockResolvedValueOnce(reply({ data: nodes }));
    await loaded();
    const selected = vi.fn();
    window.addEventListener("customerSelected", selected);
    try {
      await act(async () => { latestMarker().openPopup(); });
      expect(selected).toHaveBeenCalledOnce();
      expect(selected.mock.calls[0][0].detail).toBe(second);
      expect(latestMarker().options.customerId).toBe(second.id);
      expect(screen.getByTestId("nearest-circle").textContent).toBe(JSON.stringify({ center: [second.latitude, second.longitude], radius: 150 }));
      expect(mocks.fetch.mock.calls).toEqual([[customerUrl], [nodeUrl]]);
      expect(writes()).toEqual([]);
    } finally {
      window.removeEventListener("customerSelected", selected);
    }
  });

  it("uses the source customer coordinates when the popup moves during spiderfy", async () => {
    await loaded();
    const selected = vi.fn();
    const popupPosition = vi.fn(() => ({ lat: 12, lng: 108 }));
    window.addEventListener("customerSelected", selected);
    try {
      await act(async () => { mocks.clusterEvents.popupopen({ sourceTarget: latestMarker(), popup: { getLatLng: popupPosition } }); });
      expect(selected).toHaveBeenCalledOnce();
      expect(selected.mock.calls[0][0].detail).toBe(customer);
      expect(popupPosition).not.toHaveBeenCalled();
      expect(screen.getByTestId("nearest-line").textContent).toBe(JSON.stringify([[11, 107], [11, 107.001]]));
      expect(mocks.fetch.mock.calls).toEqual([[customerUrl], [nodeUrl]]);
      expect(writes()).toEqual([]);
    } finally {
      window.removeEventListener("customerSelected", selected);
    }
  });

  it.each(["missing-source", "missing-id", "unknown-id"])("does not fall back to coordinates for %s", async (mode) => {
    await loaded();
    const selected = vi.fn();
    const sourceTarget = mode === "missing-source" ? undefined : { options: { title: customer.name, customerId: mode === "missing-id" ? undefined : "not-in-current-customers" } };
    window.addEventListener("customerSelected", selected);
    try {
      await act(async () => { mocks.clusterEvents.popupopen({ sourceTarget, popup: { getLatLng: () => ({ lat: 11, lng: 107 }) } }); });
      expect(selected).not.toHaveBeenCalled();
      expect(screen.queryByTestId("nearest-line")).not.toBeInTheDocument();
      expect(writes()).toEqual([]);
    } finally {
      window.removeEventListener("customerSelected", selected);
    }
  });

  it("retains the originating marker through real nested Leaflet event parents", async () => {
    const leaflet = await vi.importActual<typeof import("leaflet")>("leaflet");
    const marker = leaflet.marker([11, 107]);
    leaflet.Util.setOptions(marker, { customerId: customer.id });
    const parent = leaflet.featureGroup([marker]);
    const ancestor = leaflet.featureGroup([parent]);
    const opened = vi.fn();
    ancestor.on("popupopen", opened);
    marker.fire("popupopen", { popup: leaflet.popup() }, true);
    expect(opened).toHaveBeenCalledOnce();
    expect(opened.mock.calls[0][0].target).toBe(ancestor);
    expect(opened.mock.calls[0][0].sourceTarget).toBe(marker);
    expect(opened.mock.calls[0][0].sourceTarget.options.customerId).toBe(customer.id);
  });

  it.each([false, true])("opens only after flyTo completion when stop emits moveend=%s", async (stopMoveEnd) => {
    mocks.autoMoveEnd = false;
    mocks.stopMoveEnd = stopMoveEnd;
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalled());
    expect(mocks.cluster.zoomToShowLayer).not.toHaveBeenCalled();
    expect(latestMarker().openPopup).not.toHaveBeenCalled();
    await act(async () => { mocks.map.fire("moveend"); });
    expect(latestMarker().openPopup).toHaveBeenCalledOnce();
    expect(mocks.map.stop.mock.invocationCallOrder[0]).toBeLessThan(mocks.map.once.mock.invocationCallOrder[0]);
    expect(mocks.map.once.mock.invocationCallOrder[0]).toBeLessThan(mocks.map.flyTo.mock.invocationCallOrder[0]);
    await act(async () => { mocks.map.fire("moveend"); });
    expect(latestMarker().openPopup).toHaveBeenCalledOnce();
    expect(writes()).toEqual([]);
  });

  it("keeps only the latest customer selection pending during a flight", async () => {
    mocks.autoMoveEnd = false;
    const second = { ...customer, id: "latest", name: "Latest customer", latitude: 12 };
    mocks.fetch.mockResolvedValueOnce(reply({ data: [customer, second] })).mockResolvedValueOnce(reply({ data: nodes }));
    await loaded();
    const firstMarker = mocks.markers[0];
    const secondMarker = mocks.markers[1];
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Latest customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(2));
    expect(mocks.cluster.zoomToShowLayer).not.toHaveBeenCalled();
    await act(async () => { mocks.map.fire("moveend"); });
    expect(firstMarker.openPopup).not.toHaveBeenCalled();
    expect(secondMarker.openPopup).toHaveBeenCalledOnce();
  });

  it("ignores an old cluster reveal callback after a newer selection", async () => {
    mocks.autoMoveEnd = false;
    const callbacks: Array<() => void> = [];
    mocks.cluster.zoomToShowLayer.mockImplementation((_marker, callback: () => void) => { callbacks.push(callback); });
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(1));
    await act(async () => { mocks.map.fire("moveend"); });
    expect(callbacks).toHaveLength(1);
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(2));
    await act(async () => { callbacks[0](); });
    expect(latestMarker().openPopup).not.toHaveBeenCalled();
    await act(async () => { mocks.map.fire("moveend"); });
    expect(callbacks).toHaveLength(2);
    await act(async () => { callbacks[1](); });
    expect(latestMarker().openPopup).toHaveBeenCalledOnce();
  });

  it("cancels pending popup work on unmount", async () => {
    mocks.autoMoveEnd = false;
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalled());
    const marker = latestMarker();
    cleanup();
    await act(async () => { mocks.map.fire("moveend"); });
    expect(marker.openPopup).not.toHaveBeenCalled();
    expect(mocks.map.off).toHaveBeenCalledWith("moveend", expect.any(Function));
  });

  it("cancels a pending customer popup when GPS navigation takes over", async () => {
    mocks.autoMoveEnd = false;
    await loaded();
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(1));
    mocks.geolocation.mockImplementationOnce((success: (position: { coords: { latitude: number; longitude: number } }) => void) => success({ coords: { latitude: 10, longitude: 106 } }));
    fireEvent.click(screen.getByRole("button", { name: "Vị trí của tôi" }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalledTimes(2));
    await act(async () => { mocks.map.fire("moveend"); });
    expect(latestMarker().openPopup).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });

  it("does not reveal through a removed group when a filter excludes the pending customer", async () => {
    mocks.autoMoveEnd = false;
    const groups = useDistinctClusters();
    const mobile = { ...customer, id: "mobile", name: "Mobile customer", subscriberType: "MOBILE" };
    mocks.fetch.mockResolvedValueOnce(reply({ data: [customer, mobile] })).mockResolvedValueOnce(reply({ data: nodes }));
    await loaded(groups);
    const marker = mocks.markers.find((item) => item.options.title === customer.name)!;
    const oldGroup = groupForMarker(groups, marker);
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Di động/ }));
    expect(mocks.map.removeLayer).toHaveBeenCalledWith(oldGroup);
    vi.useFakeTimers();
    try {
      await act(async () => { mocks.map.fire("moveend"); await vi.advanceTimersByTimeAsync(500); });
      expect(oldGroup.zoomToShowLayer).not.toHaveBeenCalled();
      expect(marker.openPopup).not.toHaveBeenCalled();
      expect(writes()).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it("rejects a delayed reveal callback when the same ID has a new marker owner", async () => {
    mocks.autoMoveEnd = false;
    const groups = useDistinctClusters();
    const callbacks: Array<() => void> = [];
    await loaded(groups);
    const oldMarker = latestMarker();
    const oldGroup = groupForMarker(groups, oldMarker);
    oldGroup.zoomToShowLayer.mockImplementation((_marker, callback: () => void) => { callbacks.push(callback); });
    fireEvent.click(screen.getByTitle("Xem danh sách khách hàng trên bản đồ"));
    fireEvent.click(screen.getByRole("button", { name: /Fixture customer/ }));
    await waitFor(() => expect(mocks.map.flyTo).toHaveBeenCalled());
    await act(async () => { mocks.map.fire("moveend"); });
    expect(callbacks).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Di động/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tất cả/ }));
    const newMarker = latestMarker();
    expect(newMarker).not.toBe(oldMarker);
    expect(groupForMarker(groups, newMarker)).not.toBe(oldGroup);
    await act(async () => { callbacks[0](); });
    expect(oldMarker.openPopup).not.toHaveBeenCalled();
    expect(newMarker.openPopup).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });
});
