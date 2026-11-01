// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { ComponentProps } from "react";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeMapComponent from "@/app/(dashboard)/node-map/NodeMapComponent";
import type NodeMapOptionsMenu from "@/app/(dashboard)/node-map/NodeMapOptionsMenu";

type OptionsMenuProps = ComponentProps<typeof NodeMapOptionsMenu>;
type UploadCase = {
  label: string;
  inputTestId: string;
  filename: string;
  mimeType: string;
  reportTitle: string | null;
  refreshesNodes: boolean;
};

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<(request: string, options?: RequestInit) => Promise<ReturnType<typeof reply>>>(),
  formDataCreated: vi.fn(),
  menuStates: [] as Array<{ open: boolean; busy: boolean }>,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "fixture-admin", role: "ADMIN" } },
    status: "authenticated",
  }),
}));

vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="node-map-canvas" />,
  Marker: () => null,
  Popup: () => null,
  TileLayer: () => null,
  useMap: () => null,
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(),
    divIcon: vi.fn(),
    Marker: { prototype: { options: {} } },
  },
}));

vi.mock("@/app/(dashboard)/node-map/NodeMapOptionsMenu", async () => {
  const { forwardRef, useRef } = await import("react");

  return {
    default: forwardRef<HTMLDivElement, OptionsMenuProps>(function UploadOptions(props, reference) {
      const nodeInputRef = useRef<HTMLInputElement>(null);
      const efficiencyInputRef = useRef<HTMLInputElement>(null);
      const accountMapInputRef = useRef<HTMLInputElement>(null);
      const controls = [
        { testId: "nodes-upload", accept: ".kmz,.kml", inputRef: nodeInputRef, onChange: props.onUploadNodes },
        { testId: "efficiency-upload", accept: ".xlsx,.xls", inputRef: efficiencyInputRef, onChange: props.onUploadEfficiency },
        { testId: "account-map-upload", accept: ".xlsx,.xls", inputRef: accountMapInputRef, onChange: props.onUploadCustomerNodeMap },
      ];

      mocks.menuStates.push({ open: props.open, busy: props.busy });

      return (
        <div ref={reference} data-testid="node-options" data-busy={String(props.busy)}>
          <button
            type="button"
            data-testid="node-options-toggle"
            aria-expanded={props.open}
            onClick={props.onToggle}
          >
            Node upload options
          </button>
          {props.canAdmin && controls.map((control) => (
            <input
              key={control.testId}
              ref={control.inputRef}
              type="file"
              accept={control.accept}
              data-testid={control.testId}
              onChange={control.onChange}
            />
          ))}
          {props.open && props.canAdmin && (
            <div role="menu" aria-label="Node upload options">
              {controls.map((control) => (
                <button
                  key={control.testId}
                  type="button"
                  data-testid={`${control.testId}-button`}
                  disabled={props.busy}
                  onClick={() => control.inputRef.current?.click()}
                >
                  {control.testId}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }),
  };
});

const sizeMessage = "File tối đa 4 MB cho mỗi lần import Node trên web. Hãy chia nhỏ file rồi thử lại.";
const successMessage = "Fixture node import completed.";
const uploadPayload = {
  message: successMessage,
  totalRows: 3,
  updated: 1,
  notMatched: 1,
  notMatchedSamples: ["NODE-FIXTURE-MISSING"],
  imported: 2,
  inserted: 1,
  syncedCustomers: 2,
  errors: ["Dòng 3: fixture parse warning"],
};
const uploadCases: UploadCase[] = [
  {
    label: "KMZ nodes",
    inputTestId: "nodes-upload",
    filename: "nodes.kmz",
    mimeType: "application/vnd.google-earth.kmz",
    reportTitle: null,
    refreshesNodes: true,
  },
  {
    label: "KML nodes",
    inputTestId: "nodes-upload",
    filename: "nodes.kml",
    mimeType: "application/vnd.google-earth.kml+xml",
    reportTitle: null,
    refreshesNodes: true,
  },
  {
    label: "XLSX efficiency",
    inputTestId: "efficiency-upload",
    filename: "efficiency.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    reportTitle: "Kết quả import hiệu suất node",
    refreshesNodes: true,
  },
  {
    label: "XLSX account mapping",
    inputTestId: "account-map-upload",
    filename: "account-map.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    reportTitle: "Kết quả import node thuê bao",
    refreshesNodes: false,
  },
];

function reply(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function fileWithSize(uploadCase: UploadCase, size: number) {
  const file = new File(["fixture"], uploadCase.filename, { type: uploadCase.mimeType });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function uploadRequests() {
  return mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST");
}

function openOptions() {
  fireEvent.click(screen.getByTestId("node-options-toggle"));
  expect(screen.getByTestId("node-options-toggle")).toHaveAttribute("aria-expanded", "true");
  mocks.menuStates.length = 0;
}

async function mount(uploadCase: UploadCase) {
  render(
    <SearchParamsContext.Provider value={new URLSearchParams()}>
      <NodeMapComponent />
    </SearchParamsContext.Provider>,
  );
  await waitFor(() => expect(screen.queryByText("Đang tải bản đồ hạ tầng")).not.toBeInTheDocument());
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
  expect(toast.error).not.toHaveBeenCalled();
  openOptions();
  return screen.getByTestId(uploadCase.inputTestId) as HTMLInputElement;
}

function expectOptionsUnchanged() {
  expect(screen.getByTestId("node-options-toggle")).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("node-options")).toHaveAttribute("data-busy", "false");
  expect(mocks.menuStates.every((state) => state.open && !state.busy)).toBe(true);
  for (const inputTestId of ["nodes-upload", "efficiency-upload", "account-map-upload"]) {
    expect(screen.getByTestId(`${inputTestId}-button`)).toBeEnabled();
  }
}

async function expectSuccessfulUpload(uploadCase: UploadCase, file: File) {
  if (uploadCase.reportTitle) {
    const report = await screen.findByRole("dialog", { name: uploadCase.reportTitle });
    expect(report).toHaveTextContent(successMessage);
    expect(report).toHaveTextContent("Tổng dòng: 3");
    expect(report).toHaveTextContent("Dòng 3: fixture parse warning");
  } else {
    await waitFor(() => expect(toast.success).toHaveBeenCalledExactlyOnceWith(successMessage));
  }

  await waitFor(() => {
    expect(screen.getByTestId("node-options")).toHaveAttribute("data-busy", "false");
    expect(screen.getByTestId<HTMLInputElement>(uploadCase.inputTestId).value).toBe("");
  });
  expect(screen.getByTestId("node-options-toggle")).toHaveAttribute("aria-expanded", "false");
  expect(uploadRequests()).toEqual([
    ["/api/nodes/upload", { method: "POST", body: expect.any(FormData) }],
  ]);
  const multipart = uploadRequests()[0][1]?.body as FormData;
  expect(multipart.get("file")).toBe(file);
  expect(Array.from(multipart.keys())).toEqual(["file"]);
  expect(mocks.formDataCreated).toHaveBeenCalledOnce();
  const nodeRequests = mocks.fetch.mock.calls.filter(([request]) => request === "/api/nodes");
  expect(nodeRequests).toHaveLength(uploadCase.refreshesNodes ? 2 : 1);
  expect(mocks.fetch).toHaveBeenCalledTimes(uploadCase.refreshesNodes ? 3 : 2);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.menuStates.length = 0;
  vi.stubEnv("NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES", "4000000");
  vi.spyOn(toast, "error");
  vi.spyOn(toast, "success");
  mocks.fetch.mockReset().mockImplementation(async (request, options) => {
    if (request === "/api/nodes" && !options?.method) return reply({ data: [] });
    if (request === "/api/nodes/upload" && options?.method === "POST") return reply(uploadPayload);
    throw new Error(`Unexpected fixture request: ${options?.method ?? "GET"} ${request}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
  const BrowserFormData = globalThis.FormData;
  vi.stubGlobal("FormData", class extends BrowserFormData {
    constructor(...parameters: ConstructorParameters<typeof BrowserFormData>) {
      super(...parameters);
      mocks.formDataCreated();
    }
  });
});

afterEach(() => {
  cleanup();
  toast.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(uploadCases)("$label client filesize preflight", (uploadCase) => {
  it.each(["4000000", undefined, "invalid"])("rejects 4,000,001 bytes with public cap %s before upload side effects", async (publicCap) => {
    vi.stubEnv("NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES", publicCap);
    const input = await mount(uploadCase);
    await userEvent.setup().upload(input, fileWithSize(uploadCase, 4_000_001));

    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(sizeMessage));
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
    expect(uploadRequests()).toEqual([]);
    expect(mocks.formDataCreated).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expectOptionsUnchanged();
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);
  });

  it.each([3_999_999, 4_000_000])("accepts %s bytes with the unchanged multipart transport and success UI", async (size) => {
    const input = await mount(uploadCase);
    const file = fileWithSize(uploadCase, size);
    await userEvent.setup().upload(input, file);

    await expectSuccessfulUpload(uploadCase, file);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("accepts an oversized local file when the public cap is explicitly zero", async () => {
    vi.stubEnv("NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES", "0");
    const input = await mount(uploadCase);
    const file = fileWithSize(uploadCase, 4_000_001);
    await userEvent.setup().upload(input, file);

    await expectSuccessfulUpload(uploadCase, file);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("clears the rejected picker so the same file can be reselected before a valid import succeeds", async () => {
    const input = await mount(uploadCase);
    const user = userEvent.setup();
    const oversizedFile = fileWithSize(uploadCase, 4_000_001);
    await user.upload(input, oversizedFile);
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(sizeMessage));
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);

    await user.upload(input, oversizedFile);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenNthCalledWith(2, sizeMessage);
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
    expect(mocks.formDataCreated).not.toHaveBeenCalled();
    expectOptionsUnchanged();

    const validFile = fileWithSize(uploadCase, 3_999_999);
    await user.upload(input, validFile);
    await expectSuccessfulUpload(uploadCase, validFile);
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it("leaves a no-file change unchanged", async () => {
    const input = await mount(uploadCase);
    fireEvent.change(input, { target: { files: [] } });

    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/nodes");
    expect(mocks.formDataCreated).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input.value).toBe("");
    expectOptionsUnchanged();
  });

  it("preserves the existing real import report when the next selection is oversized", async () => {
    const input = await mount(uploadCase);
    const user = userEvent.setup();
    const efficiencyUpload = uploadCases[2];
    const seedFile = fileWithSize(efficiencyUpload, 10);
    await user.upload(screen.getByTestId(efficiencyUpload.inputTestId), seedFile);
    await expectSuccessfulUpload(efficiencyUpload, seedFile);
    const report = screen.getByRole("dialog", { name: "Kết quả import hiệu suất node" });
    const reportText = report.textContent;
    expect(report).toHaveTextContent("NODE-FIXTURE-MISSING");
    openOptions();

    await user.upload(input, fileWithSize(uploadCase, 4_000_001));

    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(sizeMessage));
    expect(screen.getByRole("dialog", { name: "Kết quả import hiệu suất node" })).toBe(report);
    expect(report.textContent).toBe(reportText);
    expect(uploadRequests()).toHaveLength(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.formDataCreated).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);
    expectOptionsUnchanged();
  });
});
