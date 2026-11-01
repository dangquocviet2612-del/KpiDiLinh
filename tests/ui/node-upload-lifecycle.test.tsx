// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeMapComponent from "@/app/(dashboard)/node-map/NodeMapComponent";
import type NodeMapOptionsMenu from "@/app/(dashboard)/node-map/NodeMapOptionsMenu";
import { NODE_UPLOAD_SIZE_ERROR } from "@/lib/node-upload-limits";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<typeof fetch>(),
  error: vi.fn(),
  success: vi.fn(),
  multipart: vi.fn(),
  failure: null as "construct" | "append" | null,
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({
  data: { user: { id: "lifecycle-fixture-admin", role: "ADMIN" } }, status: "authenticated",
}) }));
vi.mock("react-hot-toast", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="fixture-map" />,
  Marker: () => null, Popup: () => null, TileLayer: () => null, useMap: () => null,
}));
vi.mock("leaflet", () => ({ default: {
  icon: vi.fn(), divIcon: vi.fn(), Marker: { prototype: { options: {} } },
} }));
vi.mock("@/app/(dashboard)/node-map/NodeMapOptionsMenu", async () => {
  const { forwardRef } = await import("react");
  return { default: forwardRef<HTMLDivElement, ComponentProps<typeof NodeMapOptionsMenu>>(function FixtureMenu(props, ref) {
    const controls = [
      { id: "positions", handler: props.onUploadNodes },
      { id: "efficiency", handler: props.onUploadEfficiency },
      { id: "mapping", handler: props.onUploadCustomerNodeMap },
    ];
    return <div ref={ref} data-testid="options" data-busy={String(props.busy)}>
      <button type="button" data-testid="toggle" aria-expanded={props.open} onClick={props.onToggle}>Tùy chọn fixture</button>
      {props.canAdmin && controls.map((control) => <input key={control.id} type="file" data-testid={control.id} onChange={control.handler} />)}
    </div>;
  }) };
});

const NativeFormData = globalThis.FormData;
const payload = {
  message: "Synthetic node import acknowledged.", totalRows: 3, created: 1, updated: 1,
  imported: 2, inserted: 1, syncedCustomers: 2, notMatched: 1,
  notMatchedSamples: ["SYNTHETIC-MISSING"], errors: ["Synthetic row warning"],
};
const modes = [
  { id: "positions", filename: "synthetic.kmz", report: null, refresh: true },
  { id: "efficiency", filename: "synthetic-efficiency.xlsx", report: "Kết quả import hiệu suất node", refresh: true },
  { id: "mapping", filename: "synthetic-mapping.xlsx", report: "Kết quả import node thuê bao", refresh: false },
] as const;
type Mode = typeof modes[number];
const crossModes = modes.flatMap((first) => modes.filter((other) => other.id !== first.id).map((second) => ({ first, second, label: `${first.id} → ${second.id}` })));
const preparationFailures = modes.flatMap((mode) => (["construct", "append"] as const).map((failure) => ({ mode, failure, label: `${mode.id}/${failure}` })));

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body), text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function posts() {
  return mocks.fetch.mock.calls.filter(([url, options]) => url === "/api/nodes/upload" && options?.method === "POST");
}

function inputFor(mode: Mode) {
  return screen.getByTestId<HTMLInputElement>(mode.id);
}

function choose(mode: Mode, files?: File[]) {
  const input = inputFor(mode);
  Object.defineProperty(input, "value", { configurable: true, writable: true, value: "synthetic-selection" });
  fireEvent.change(input, { target: { files: files ?? [new File(["synthetic"], mode.filename)] } });
  return input;
}

async function mount() {
  render(<SearchParamsContext.Provider value={new URLSearchParams()}><NodeMapComponent /></SearchParamsContext.Provider>);
  await waitFor(() => expect(screen.queryByText("Đang tải bản đồ hạ tầng")).not.toBeInTheDocument());
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
  fireEvent.click(screen.getByTestId("toggle"));
  expect(screen.getByTestId("toggle")).toHaveAttribute("aria-expanded", "true");
}

async function idle() {
  await waitFor(() => expect(screen.getByTestId("options")).toHaveAttribute("data-busy", "false"));
}

async function acknowledged(mode: Mode) {
  await idle();
  if (mode.report) {
    const report = screen.getByRole("dialog", { name: mode.report });
    expect(report).toHaveTextContent(payload.message);
    expect(report).toHaveTextContent("Tổng dòng: 3");
    expect(report).toHaveTextContent("Synthetic row warning");
  } else {
    expect(mocks.success).toHaveBeenLastCalledWith(payload.message);
  }
  expect(inputFor(mode)).toHaveValue("");
}

async function manualRetry(mode: Mode) {
  const count = posts().length;
  await idle();
  await act(async () => undefined);
  expect(posts()).toHaveLength(count);
  await act(async () => { choose(mode); });
  await acknowledged(mode);
  expect(posts()).toHaveLength(count + 1);
}

function expectTransport(file: File, index = 0) {
  const [url, options] = posts()[index];
  expect(url).toBe("/api/nodes/upload");
  expect(options).toEqual({ method: "POST", body: expect.any(NativeFormData) });
  const body = options?.body as FormData;
  expect(body.get("file")).toBe(file);
  expect([...body.keys()]).toEqual(["file"]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failure = null;
  vi.stubEnv("NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES", "4000000");
  mocks.fetch.mockReset().mockImplementation(async (url, options) => {
    if (url === "/api/nodes" && !options) return response({ data: [] });
    if (url === "/api/nodes/upload" && options?.method === "POST") return response(payload);
    throw new Error("Unexpected fixture request");
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("FormData", class extends NativeFormData {
    constructor() {
      if (mocks.failure === "construct") throw new Error("Synthetic multipart construction failed");
      super();
      mocks.multipart();
      if (mocks.failure === "append") vi.spyOn(this as FormData, "append").mockImplementation(() => { throw new Error("Synthetic multipart append failed"); });
    }
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Node import single-flight lifecycle", () => {
  it.each(modes)("locks $id before render and through fetch/JSON until explicit manual retry", async (mode) => {
    await mount();
    const post = deferred<Response>();
    const json = deferred<unknown>();
    const reply = response(payload);
    vi.mocked(reply.json).mockReturnValueOnce(json.promise);
    mocks.fetch.mockImplementationOnce(() => post.promise);
    const file = new File(["original"], mode.filename);
    await act(async () => { choose(mode, [file]); choose(mode); });
    expect(posts()).toHaveLength(1);
    expect(mocks.multipart).toHaveBeenCalledTimes(1);
    expectTransport(file);
    expect(screen.getByTestId("options")).toHaveAttribute("data-busy", "true");
    await act(async () => post.resolve(reply));
    expect(reply.json).toHaveBeenCalledTimes(1);
    await act(async () => { choose(mode); });
    expect(posts()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => json.resolve(payload));
    await acknowledged(mode);
    expect(mocks.error).not.toHaveBeenCalled();
    await manualRetry(mode);
  });

  it.each(crossModes)("blocks cross-import race $label without queuing the ignored file", async ({ first, second }) => {
    await mount();
    const post = deferred<Response>();
    mocks.fetch.mockImplementationOnce(() => post.promise);
    await act(async () => { choose(first); choose(second); });
    expect(posts()).toHaveLength(1);
    expect(mocks.multipart).toHaveBeenCalledTimes(1);
    expect(inputFor(second)).toHaveValue("");
    await act(async () => post.resolve(response(payload)));
    await acknowledged(first);
    expect(posts()).toHaveLength(1);
    await manualRetry(second);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(preparationFailures)("releases $label after multipart preparation throws and resets the captured picker", async ({ mode, failure }) => {
    await mount();
    mocks.failure = failure;
    await act(async () => { choose(mode); });
    await idle();
    expect(inputFor(mode)).toHaveValue("");
    expect(posts()).toHaveLength(0);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error.mock.calls[0][0]).toContain("Synthetic multipart");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mocks.failure = null;
    await manualRetry(mode);
  });

  it.each(modes)("keeps HTTP error feedback and permits a manual retry for $id", async (mode) => {
    await mount();
    mocks.fetch.mockResolvedValueOnce(response({ error: "Synthetic server rejection" }, 400));
    await act(async () => { choose(mode); });
    await idle();
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith("Synthetic server rejection");
    expect(inputFor(mode)).toHaveValue("");
    expect(posts()).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    await manualRetry(mode);
  });

  it.each(modes)("preserves the no-file gate for $id", async (mode) => {
    await mount();
    await act(async () => { choose(mode, []); });
    await idle();
    expect(posts()).toHaveLength(0);
    expect(mocks.multipart).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.getByTestId("toggle")).toHaveAttribute("aria-expanded", "true");
    await manualRetry(mode);
  });

  it.each(modes)("preserves the 4 MB preflight for $id before acquiring the import lock", async (mode) => {
    await mount();
    const file = new File(["oversized metadata only"], mode.filename);
    Object.defineProperty(file, "size", { value: 4_000_001 });
    await act(async () => { choose(mode, [file]); });
    await idle();
    expect(inputFor(mode)).toHaveValue("");
    expect(posts()).toHaveLength(0);
    expect(mocks.multipart).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(NODE_UPLOAD_SIZE_ERROR);
    expect(screen.getByTestId("toggle")).toHaveAttribute("aria-expanded", "true");
    await manualRetry(mode);
  });

  it.each(modes.filter((mode) => mode.refresh))("keeps the $id lock while its existing awaited map refresh is pending", async (mode) => {
    await mount();
    const refresh = deferred<Response>();
    mocks.fetch.mockResolvedValueOnce(response(payload)).mockReturnValueOnce(refresh.promise);
    await act(async () => { choose(mode); });
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/nodes");
    expect(screen.getByTestId("options")).toHaveAttribute("data-busy", "true");
    await act(async () => { choose(modes[2]); });
    expect(posts()).toHaveLength(1);
    expect(mocks.multipart).toHaveBeenCalledTimes(1);
    await act(async () => refresh.resolve(response({ data: [] })));
    await acknowledged(mode);
    await manualRetry(modes[2]);
  });
});
