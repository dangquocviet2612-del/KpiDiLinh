// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfficialDocsPanelController } from "@/app/(dashboard)/prepaid/useOfficialDocsPanel";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({ default: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/ui/ConfirmDialogProvider", () => ({ useConfirmDialog: () => mocks.confirm }));

const MAX_BYTES = 4_000_000;
const SIZE_MESSAGE = "Tệp đính kèm tối đa 4 MB trên web. Vui lòng chọn tệp nhỏ hơn; với video, hãy dùng chức năng thêm link video.";
const UPLOAD_URL = "/api/official-documents/upload";
const NativeFormData = globalThis.FormData;
const fetchMock = vi.fn<typeof fetch>();
const formDataConstructor = vi.fn(function createFormData() {
  return new NativeFormData();
});

type DocAsset = OfficialDocsPanelController["docForm"]["assets"][number];

const retainedAsset: DocAsset = {
  type: "FILE",
  fileUrl: "/uploads/official-documents/retained.pdf",
  fileName: "retained.pdf",
  mimeType: "application/pdf",
  size: 123,
};

function metadataFile(name: string, type: string, size: number): File {
  const file = new File(["metadata-only"], name, { type });
  Object.defineProperty(file, "size", { configurable: true, value: size });
  return file;
}

function fileList(files: File[]): FileList {
  return Object.assign(files, { item: (index: number) => files[index] ?? null }) as unknown as FileList;
}

function uploadedAsset(file: File): DocAsset {
  return {
    type: file.type.startsWith("image/") ? "IMAGE" : file.type.startsWith("video/") ? "VIDEO" : "FILE",
    fileUrl: `/uploads/official-documents/${file.name}`,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

function uploadResponse(file: File): Response {
  return { ok: true, json: async () => ({ item: uploadedAsset(file) }) } as Response;
}

function deferredResponse() {
  let resolveResponse!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  return { promise, resolve: resolveResponse };
}

function seedDraft(panel: OfficialDocsPanelController) {
  panel.setDocForm((previous) => ({
    ...previous,
    title: "Báo cáo tháng 10",
    category: "COMMUNICATION_CONTENT",
    summary: "Tóm tắt đang soạn",
    content: "Nội dung đang soạn\nDòng thứ hai",
    status: "DRAFT",
    publishedAt: "30/10/2026",
    expiresAt: "30/11/2026",
    isPinned: true,
    assets: [{ ...retainedAsset }],
  }));
}

async function mountHook() {
  const { default: useOfficialDocsPanel } = await import("@/app/(dashboard)/prepaid/useOfficialDocsPanel");
  const busyHistory: string[] = [];
  const view = renderHook(() => {
    const panel = useOfficialDocsPanel({ canAdmin: true, enabled: false, hasSession: true });
    busyHistory.push(panel.docBusy);
    return panel;
  });
  act(() => {
    view.result.current.beginCreateDoc();
    seedDraft(view.result.current);
  });
  return { ...view, busyHistory, initialForm: view.result.current.docForm };
}

type HookHarness = Awaited<ReturnType<typeof mountHook>>;

function startUpload(harness: HookHarness, selection: FileList | null): Promise<void> {
  let pendingUpload = Promise.resolve();
  act(() => {
    pendingUpload = harness.result.current.uploadDocFiles(selection);
  });
  return pendingUpload;
}

async function upload(harness: HookHarness, selection: FileList | null) {
  const pendingUpload = startUpload(harness, selection);
  await act(async () => {
    await pendingUpload;
  });
}

async function mountPanel() {
  const { default: useOfficialDocsPanel } = await import("@/app/(dashboard)/prepaid/useOfficialDocsPanel");
  const { default: OfficialDocsPanel } = await import("@/app/(dashboard)/prepaid/OfficialDocsPanel");
  let currentPanel!: OfficialDocsPanelController;
  function Harness() {
    const panel = useOfficialDocsPanel({ canAdmin: true, enabled: false, hasSession: true });
    currentPanel = panel;
    return <OfficialDocsPanel role="ADMIN" onBack={() => undefined} panel={panel} />;
  }
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Tạo công văn" }));
  act(() => seedDraft(currentPanel));
  return {
    ...view,
    get panel() { return currentPanel; },
    initialForm: currentPanel.docForm,
    input: screen.getByLabelText(/Upload file/) as HTMLInputElement,
  };
}

function chooseFile(input: HTMLInputElement, file: File) {
  const pickerValue = `C:\\fakepath\\${file.name}`;
  if (input.value === pickerValue) return;
  Object.defineProperty(input, "value", { configurable: true, writable: true, value: pickerValue });
  fireEvent.change(input, { target: { files: fileList([file]) } });
}

function expectFilePost(index: number, file: File) {
  const [request, options] = fetchMock.mock.calls[index];
  expect(request).toBe(UPLOAD_URL);
  expect(options?.method).toBe("POST");
  expect(options?.body).toBeInstanceOf(NativeFormData);
  const body = options?.body as FormData;
  expect(Array.from(body.keys())).toEqual(["file"]);
  expect(body.get("file")).toBe(file);
}

function expectRejectedSelection(harness: HookHarness) {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(formDataConstructor).not.toHaveBeenCalled();
  expect(harness.busyHistory).not.toContain("upload");
  expect(harness.result.current.docBusy).toBe("");
  expect(harness.result.current.docForm).toEqual(harness.initialForm);
  expect(harness.result.current.docForm.assets).toBe(harness.initialForm.assets);
  expect(harness.result.current.docEditorMode).toBe(true);
  expect(mocks.error).toHaveBeenCalledTimes(1);
  expect(mocks.error).toHaveBeenCalledWith(SIZE_MESSAGE);
  expect(mocks.success).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock("react", () => React);
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES", "4000000");
  mocks.confirm.mockResolvedValue(true);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_request, options) => {
    const body = options?.body;
    if (!(body instanceof NativeFormData)) throw new Error("Expected a file upload FormData body");
    const file = body.get("file");
    if (!(file instanceof File)) throw new Error("Expected a file field");
    return uploadResponse(file);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", formDataConstructor);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock("react");
});

describe("official document upload size preflight", () => {
  it.each([
    { name: "oversize.png", type: "image/png" },
    { name: "oversize.mp4", type: "video/mp4" },
    { name: "oversize.pdf", type: "application/pdf" },
  ])("rejects $type above 4,000,000 bytes with the exact web message", async ({ name, type }) => {
    const harness = await mountHook();
    await upload(harness, fileList([metadataFile(name, type, MAX_BYTES + 1)]));
    expectRejectedSelection(harness);
  });

  it.each([MAX_BYTES - 1, MAX_BYTES])("allows a file of %i bytes through the existing upload transport", async (size) => {
    const harness = await mountHook();
    const file = metadataFile("accepted.pdf", "application/pdf", size);
    await upload(harness, fileList([file]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(formDataConstructor).toHaveBeenCalledTimes(1);
    expectFilePost(0, file);
    expect(harness.result.current.docForm.assets).toEqual([retainedAsset, uploadedAsset(file)]);
    expect(harness.result.current.docBusy).toBe("");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Đã upload tệp");
  });

  it.each([
    { label: "absent", value: undefined },
    { label: "empty", value: "" },
    { label: "invalid", value: "not-a-number" },
  ])("falls back to the web cap for an $label public setting", async ({ value }) => {
    vi.stubEnv("NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES", value);
    const harness = await mountHook();
    await upload(harness, fileList([metadataFile("fallback.pdf", "application/pdf", MAX_BYTES + 1)]));
    expectRejectedSelection(harness);
  });

  it.each(["valid-first", "oversize-first"])("rejects the whole %s selection before FormData, HTTP, or observable busy state", async (order) => {
    const harness = await mountHook();
    const valid = metadataFile("valid.png", "image/png", 100);
    const oversize = metadataFile("too-large.pdf", "application/pdf", MAX_BYTES + 1);
    const files = order === "valid-first" ? [valid, oversize] : [oversize, valid];
    await upload(harness, fileList(files));
    expectRejectedSelection(harness);
  });

  it("accepts a total above the cap with sequential one-file POSTs and appends all assets only at completion", async () => {
    const harness = await mountHook();
    const firstFile = metadataFile("first.png", "image/png", 3_000_000);
    const secondFile = metadataFile("second.mp4", "video/mp4", 3_000_000);
    const firstResponse = deferredResponse();
    const secondResponse = deferredResponse();
    fetchMock.mockReturnValueOnce(firstResponse.promise).mockReturnValueOnce(secondResponse.promise);
    const pendingUpload = startUpload(harness, fileList([firstFile, secondFile]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(formDataConstructor).toHaveBeenCalledTimes(1);
    expectFilePost(0, firstFile);
    expect(harness.result.current.docBusy).toBe("upload");
    expect(harness.result.current.docForm).toEqual(harness.initialForm);
    await act(async () => {
      firstResponse.resolve(uploadResponse(firstFile));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(formDataConstructor).toHaveBeenCalledTimes(2);
    expectFilePost(1, secondFile);
    expect(harness.result.current.docForm.assets).toEqual([retainedAsset]);
    expect(harness.result.current.docBusy).toBe("upload");
    await act(async () => {
      secondResponse.resolve(uploadResponse(secondFile));
      await pendingUpload;
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(harness.result.current.docForm).toEqual({
      ...harness.initialForm,
      assets: [retainedAsset, uploadedAsset(firstFile), uploadedAsset(secondFile)],
    });
    expect(harness.result.current.docBusy).toBe("");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });

  it("snapshots the live selection before size inspection and retains it across awaited POSTs", async () => {
    const harness = await mountHook();
    const firstFile = metadataFile("snapshot-first.pdf", "application/pdf", 100);
    const secondFile = metadataFile("snapshot-second.pdf", "application/pdf", 100);
    const replacement = metadataFile("not-selected.pdf", "application/pdf", MAX_BYTES + 1);
    const liveFiles = [firstFile, secondFile];
    Object.defineProperty(firstFile, "size", {
      configurable: true,
      get: () => {
        liveFiles.splice(1, 1, replacement);
        return 100;
      },
    });
    const firstResponse = deferredResponse();
    fetchMock.mockReturnValueOnce(firstResponse.promise);
    const pendingUpload = startUpload(harness, fileList(liveFiles));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    liveFiles.splice(0, liveFiles.length);
    await act(async () => {
      firstResponse.resolve(uploadResponse(firstFile));
      await pendingUpload;
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectFilePost(0, firstFile);
    expectFilePost(1, secondFile);
    expect(harness.result.current.docForm.assets).toEqual([
      retainedAsset, uploadedAsset(firstFile), uploadedAsset(secondFile),
    ]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([
    { name: "local.pdf", type: "application/pdf", size: 20 * 1024 * 1024 },
    { name: "local.mp4", type: "video/mp4", size: 200 * 1024 * 1024 },
  ])("public 0 leaves large $type files on the old local transport", async ({ name, type, size }) => {
    vi.stubEnv("NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES", "0");
    const harness = await mountHook();
    const file = metadataFile(name, type, size);
    await upload(harness, fileList([file]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(formDataConstructor).toHaveBeenCalledTimes(1);
    expectFilePost(0, file);
    expect(harness.result.current.docForm.assets).toEqual([retainedAsset, uploadedAsset(file)]);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Đã upload tệp");
  });

  it("preserves the draft report, attachments, editor modes, and pending image URL on rejection", async () => {
    const harness = await mountHook();
    act(() => {
      harness.result.current.openImageUrlModal();
      harness.result.current.setImageUrlInput("https://example.com/pending.png");
    });
    const initialPanel = harness.result.current;
    await upload(harness, fileList([metadataFile("rejected.pdf", "application/pdf", MAX_BYTES + 1)]));
    expectRejectedSelection(harness);
    expect(harness.result.current.docForm).toBe(initialPanel.docForm);
    expect(harness.result.current.docIsCreating).toBe(initialPanel.docIsCreating);
    expect(harness.result.current.docIsEditing).toBe(initialPanel.docIsEditing);
    expect(harness.result.current.docSelectedId).toBe(initialPanel.docSelectedId);
    expect(harness.result.current.showImageUrlModal).toBe(true);
    expect(harness.result.current.imageUrlInput).toBe("https://example.com/pending.png");
  });

  it.each(["null", "empty"])("ignores a %s selection without changing state or creating transport work", async (kind) => {
    const harness = await mountHook();
    await upload(harness, kind === "null" ? null : fileList([]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(formDataConstructor).not.toHaveBeenCalled();
    expect(harness.busyHistory).not.toContain("upload");
    expect(harness.result.current.docForm).toBe(harness.initialForm);
    expect(harness.result.current.docBusy).toBe("");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});

describe("actual OfficialDocsPanel picker", () => {
  it("resets rejected selections, permits same-file rejection again, then accepts a valid selection", async () => {
    const harness = await mountPanel();
    const oversize = metadataFile("picker-large.pdf", "application/pdf", MAX_BYTES + 1);
    const valid = metadataFile("picker-valid.pdf", "application/pdf", MAX_BYTES);
    chooseFile(harness.input, oversize);
    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledTimes(1);
      expect(harness.input.value).toBe("");
    });
    expect(mocks.error).toHaveBeenLastCalledWith(SIZE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(formDataConstructor).not.toHaveBeenCalled();
    expect(harness.panel.docForm).toEqual(harness.initialForm);
    chooseFile(harness.input, oversize);
    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledTimes(2);
      expect(harness.input.value).toBe("");
    });
    expect(fetchMock).not.toHaveBeenCalled();
    chooseFile(harness.input, valid);
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledTimes(1);
      expect(harness.input.value).toBe("");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectFilePost(0, valid);
    expect(mocks.error).toHaveBeenCalledTimes(2);
    expect(harness.panel.docForm).toEqual({
      ...harness.initialForm, assets: [retainedAsset, uploadedAsset(valid)],
    });
    expect(harness.panel.docEditorMode).toBe(true);
  });

  it("resets the captured input only after awaited success and allows the same valid file again", async () => {
    const harness = await mountPanel();
    const file = metadataFile("picker-repeat.pdf", "application/pdf", 100);
    const response = deferredResponse();
    fetchMock.mockReturnValueOnce(response.promise);
    chooseFile(harness.input, file);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.input.value).toBe(`C:\\fakepath\\${file.name}`);
    expect(harness.panel.docBusy).toBe("upload");
    expect(harness.panel.docForm.assets).toEqual([retainedAsset]);
    await act(async () => {
      response.resolve(uploadResponse(file));
    });
    await waitFor(() => {
      expect(harness.input.value).toBe("");
      expect(mocks.success).toHaveBeenCalledTimes(1);
    });
    chooseFile(harness.input, file);
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledTimes(2);
      expect(harness.input.value).toBe("");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectFilePost(0, file);
    expectFilePost(1, file);
    expect(harness.panel.docForm.assets).toEqual([retainedAsset, uploadedAsset(file), uploadedAsset(file)]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("keeps adding a prompted video link local without HTTP or file upload work", async () => {
    const harness = await mountPanel();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("  https://example.com/video  ");
    fireEvent.click(screen.getByRole("button", { name: "Thêm link video" }));
    expect(prompt).toHaveBeenCalledWith("Nhập link video (YouTube hoặc link nội bộ):");
    expect(harness.panel.docForm).toEqual({
      ...harness.initialForm,
      assets: [retainedAsset, {
        type: "VIDEO", fileUrl: "https://example.com/video", fileName: "Video link", mimeType: "text/url", size: 0,
      }],
    });
    expect(screen.getByRole("link", { name: "Video link" })).toHaveAttribute("href", "https://example.com/video");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(formDataConstructor).not.toHaveBeenCalled();
    expect(harness.panel.docBusy).toBe("");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
