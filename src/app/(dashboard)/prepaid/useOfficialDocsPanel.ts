"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import {
  appendOfficialDocImageUrl,
  buildDocFormFromDoc,
  createEmptyDocForm,
  getOfficialDocInlineImageWarnings,
  getDocAssetStats,
  parseOfficialDocContentBlocks,
  parseVnDateToIso,
  type DocAsset,
  type OfficialDoc,
  type OfficialDocForm,
} from "@/lib/official-docs";

type UseOfficialDocsPanelOptions = {
  canAdmin: boolean;
  enabled: boolean;
  hasSession: boolean;
};

export type OfficialDocsPanelController = {
  docItems: OfficialDoc[];
  docLoading: boolean;
  docBusy: string;
  docSearch: string;
  docCategoryFilter: string;
  docStatusFilter: string;
  docSelectedId: string;
  docIsCreating: boolean;
  docIsEditing: boolean;
  docForm: OfficialDocForm;
  selectedDoc: OfficialDoc | null;
  selectedDocAssetStats: ReturnType<typeof getDocAssetStats>;
  selectedDocContentBlocks: ReturnType<typeof parseOfficialDocContentBlocks>;
  docFormContentBlocks: ReturnType<typeof parseOfficialDocContentBlocks>;
  docInlineImageWarnings: string[];
  docPreviewMode: boolean;
  docEditorMode: boolean;
  showImageUrlModal: boolean;
  imageUrlInput: string;
  imageUrlModalError: string;
  setDocSearch: (value: string) => void;
  setDocCategoryFilter: (value: string) => void;
  setDocStatusFilter: (value: string) => void;
  setDocForm: Dispatch<SetStateAction<OfficialDocForm>>;
  setImageUrlInput: (value: string) => void;
  loadOfficialDocs: () => Promise<void>;
  selectDoc: (id: string) => void;
  beginCreateDoc: () => void;
  beginEditDoc: () => void;
  cancelDocEditing: () => void;
  uploadDocFiles: (fileList: FileList | null) => Promise<void>;
  addDocVideoLink: () => void;
  openImageUrlModal: () => void;
  closeImageUrlModal: () => void;
  confirmInsertImageUrl: () => void;
  saveOfficialDoc: () => Promise<void>;
  deleteOfficialDoc: () => Promise<void>;
};

export default function useOfficialDocsPanel({
  canAdmin,
  enabled,
  hasSession,
}: UseOfficialDocsPanelOptions): OfficialDocsPanelController {
  const confirm = useConfirmDialog();
  const [docItems, setDocItems] = useState<OfficialDoc[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docBusy, setDocBusy] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("");
  const [docSelectedId, setDocSelectedId] = useState("");
  const [docIsCreating, setDocIsCreating] = useState(false);
  const [docIsEditing, setDocIsEditing] = useState(false);
  const [docForm, setDocForm] = useState<OfficialDocForm>(createEmptyDocForm);
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");

  const selectedDoc = useMemo(
    () => docItems.find((d) => d.id === docSelectedId) || null,
    [docItems, docSelectedId]
  );
  const selectedDocAssetStats = useMemo(() => getDocAssetStats(selectedDoc?.assets), [selectedDoc]);
  const selectedDocContentBlocks = useMemo(
    () => parseOfficialDocContentBlocks(selectedDoc?.content),
    [selectedDoc?.content]
  );
  const docFormContentBlocks = useMemo(() => parseOfficialDocContentBlocks(docForm.content), [docForm.content]);
  const docInlineImageWarnings = useMemo(() => getOfficialDocInlineImageWarnings(docForm.content), [docForm.content]);
  const imageUrlModalError = useMemo(() => {
    const value = imageUrlInput.trim();
    if (!value) return "";
    if (!/^https?:\/\//i.test(value)) {
      return "URL ảnh phải bắt đầu bằng http hoặc https.";
    }
    return getOfficialDocInlineImageWarnings(value)[0] || "";
  }, [imageUrlInput]);

  const docPreviewMode = !!selectedDoc && !docIsCreating && !docIsEditing;
  const docEditorMode = canAdmin && (docIsCreating || docIsEditing);

  const loadOfficialDocs = useCallback(async () => {
    if (!hasSession || !enabled) return;
    setDocLoading(true);
    try {
      const params = new URLSearchParams();
      if (docSearch.trim()) params.set("q", docSearch.trim());
      if (docCategoryFilter) params.set("category", docCategoryFilter);
      if (canAdmin && docStatusFilter) params.set("status", docStatusFilter);
      const res = await fetch(`/api/official-documents?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Không tải được công văn");
      const items = Array.isArray(data.items) ? data.items : [];
      setDocItems(items);
      setDocSelectedId((prev) => (items.some((item: OfficialDoc) => item.id === prev) ? prev : items[0]?.id || ""));
    } catch (error: any) {
      toast.error(error?.message || "Không tải được công văn");
      setDocItems([]);
      setDocSelectedId("");
    } finally {
      setDocLoading(false);
    }
  }, [canAdmin, docCategoryFilter, docSearch, docStatusFilter, enabled, hasSession]);

  const selectDoc = useCallback((id: string) => {
    setDocSelectedId(id);
    setDocIsCreating(false);
    setDocIsEditing(false);
    setShowImageUrlModal(false);
    setImageUrlInput("");
  }, []);

  const beginCreateDoc = useCallback(() => {
    setDocIsCreating(true);
    setDocIsEditing(true);
    setDocSelectedId("");
    setDocForm(createEmptyDocForm());
    setShowImageUrlModal(false);
    setImageUrlInput("");
  }, []);

  const beginEditDoc = useCallback(() => {
    if (!canAdmin || !selectedDoc) return;
    setDocIsCreating(false);
    setDocIsEditing(true);
    setDocForm(buildDocFormFromDoc(selectedDoc));
  }, [canAdmin, selectedDoc]);

  const cancelDocEditing = useCallback(() => {
    setShowImageUrlModal(false);
    setImageUrlInput("");
    if (docIsCreating) {
      setDocIsCreating(false);
      setDocIsEditing(false);
      setDocForm(createEmptyDocForm());
      setDocSelectedId((prev) => prev || docItems[0]?.id || "");
      return;
    }
    setDocIsEditing(false);
    setDocForm(buildDocFormFromDoc(selectedDoc));
  }, [docIsCreating, docItems, selectedDoc]);

  const uploadDocFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setDocBusy("upload");
    try {
      const uploaded: DocAsset[] = [];
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/official-documents/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Upload thất bại: ${file.name}`);
        uploaded.push(data.item as DocAsset);
      }
      setDocForm((prev) => ({ ...prev, assets: [...prev.assets, ...uploaded] }));
      toast.success("Đã upload tệp");
    } catch (error: any) {
      toast.error(error?.message || "Upload thất bại");
    } finally {
      setDocBusy("");
    }
  }, []);

  const addDocVideoLink = useCallback(() => {
    const link = window.prompt("Nhập link video (YouTube hoặc link nội bộ):");
    if (!link) return;
    const value = link.trim();
    if (!/^https?:\/\//i.test(value)) {
      toast.error("Link video không hợp lệ");
      return;
    }
    setDocForm((prev) => ({
      ...prev,
      assets: [...prev.assets, { type: "VIDEO", fileUrl: value, fileName: "Video link", mimeType: "text/url", size: 0 }],
    }));
  }, []);

  const openImageUrlModal = useCallback(() => {
    if (!canAdmin) return;
    setImageUrlInput("");
    setShowImageUrlModal(true);
  }, [canAdmin]);

  const closeImageUrlModal = useCallback(() => {
    setShowImageUrlModal(false);
    setImageUrlInput("");
  }, []);

  const confirmInsertImageUrl = useCallback(() => {
    if (!canAdmin) return;
    const value = imageUrlInput.trim();
    if (!value) return;
    if (imageUrlModalError) {
      toast.error(imageUrlModalError);
      return;
    }
    setDocForm((prev) => ({ ...prev, content: appendOfficialDocImageUrl(prev.content, value) }));
    setShowImageUrlModal(false);
    setImageUrlInput("");
  }, [canAdmin, imageUrlInput, imageUrlModalError]);

  const saveOfficialDoc = useCallback(async () => {
    if (!canAdmin) return;
    if (!docForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    const parsedPublishedAt = parseVnDateToIso(docForm.publishedAt);
    const parsedExpiresAt = parseVnDateToIso(docForm.expiresAt);
    if (docForm.publishedAt && !parsedPublishedAt) {
      toast.error("Ngày phát hành phải có dạng dd/mm/yyyy");
      return;
    }
    if (docForm.expiresAt && !parsedExpiresAt) {
      toast.error("Ngày hết hạn phải có dạng dd/mm/yyyy");
      return;
    }
    setDocBusy("save");
    try {
      const payload = {
        title: docForm.title.trim(),
        category: docForm.category,
        summary: docForm.summary.trim(),
        content: docForm.content.trim(),
        status: docForm.status,
        publishedAt: parsedPublishedAt ? `${parsedPublishedAt}T00:00:00` : null,
        expiresAt: parsedExpiresAt ? `${parsedExpiresAt}T23:59:59` : null,
        isPinned: docForm.isPinned,
        assets: docForm.assets,
      };
      const isUpdate = !docIsCreating && !!docForm.id;
      const res = await fetch(isUpdate ? `/api/official-documents/${docForm.id}` : "/api/official-documents", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lưu công văn thất bại");
      toast.success("Đã lưu công văn");
      setDocIsCreating(false);
      setDocIsEditing(false);
      await loadOfficialDocs();
      if (!isUpdate && data?.id) setDocSelectedId(String(data.id));
      setShowImageUrlModal(false);
      setImageUrlInput("");
    } catch (error: any) {
      toast.error(error?.message || "Lưu công văn thất bại");
    } finally {
      setDocBusy("");
    }
  }, [canAdmin, docForm, docIsCreating, loadOfficialDocs]);

  const deleteOfficialDoc = useCallback(async () => {
    if (!canAdmin || !selectedDoc) return;
    const accepted = await confirm({
      title: "Xóa công văn?",
      description: `Công văn “${selectedDoc.title}” sẽ bị xóa vĩnh viễn.`,
      confirmLabel: "Xóa công văn",
      destructive: true,
    });
    if (!accepted) return;
    setDocBusy("delete");
    try {
      const res = await fetch(`/api/official-documents/${selectedDoc.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Xóa công văn thất bại");
      toast.success("Đã xóa công văn");
      setDocSelectedId("");
      setDocIsEditing(false);
      setDocForm(createEmptyDocForm());
      await loadOfficialDocs();
      setShowImageUrlModal(false);
      setImageUrlInput("");
    } catch (error: any) {
      toast.error(error?.message || "Xóa công văn thất bại");
    } finally {
      setDocBusy("");
    }
  }, [canAdmin, confirm, loadOfficialDocs, selectedDoc]);

  useEffect(() => {
    if (!hasSession || !enabled) return;
    loadOfficialDocs();
  }, [enabled, hasSession, loadOfficialDocs]);

  useEffect(() => {
    if (!selectedDoc || docIsCreating) return;
    setDocForm(buildDocFormFromDoc(selectedDoc));
  }, [docIsCreating, selectedDoc]);

  useEffect(() => {
    if (!docEditorMode) {
      setShowImageUrlModal(false);
      setImageUrlInput("");
    }
  }, [docEditorMode]);

  return {
    docItems,
    docLoading,
    docBusy,
    docSearch,
    docCategoryFilter,
    docStatusFilter,
    docSelectedId,
    docIsCreating,
    docIsEditing,
    docForm,
    selectedDoc,
    selectedDocAssetStats,
    selectedDocContentBlocks,
    docFormContentBlocks,
    docInlineImageWarnings,
    docPreviewMode,
    docEditorMode,
    showImageUrlModal,
    imageUrlInput,
    imageUrlModalError,
    setDocSearch,
    setDocCategoryFilter,
    setDocStatusFilter,
    setDocForm,
    setImageUrlInput,
    loadOfficialDocs,
    selectDoc,
    beginCreateDoc,
    beginEditDoc,
    cancelDocEditing,
    uploadDocFiles,
    addDocVideoLink,
    openImageUrlModal,
    closeImageUrlModal,
    confirmInsertImageUrl,
    saveOfficialDoc,
    deleteOfficialDoc,
  };
}
