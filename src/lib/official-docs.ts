export const DOC_CATEGORIES = [
  "STIMULATION_PROGRAM",
  "VIDEO_GUIDE",
  "COMMUNICATION_CONTENT",
] as const;

export const DOC_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const DOC_ASSET_TYPES = ["VIDEO", "IMAGE", "FILE"] as const;
export const DOC_ASSET_STORAGE_KINDS = ["EXTERNAL", "INLINE"] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];
export type DocStatus = (typeof DOC_STATUSES)[number];
export type DocAssetType = (typeof DOC_ASSET_TYPES)[number];
export type DocAssetStorageKind = (typeof DOC_ASSET_STORAGE_KINDS)[number];

export type DocAsset = {
  id?: number;
  tempId?: string;
  type: DocAssetType;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  storageKind?: DocAssetStorageKind;
};

export type DocRevision = {
  id: number;
  documentId: string;
  changeType: "CREATED" | "UPDATED";
  changedBy: string | null;
  changedAt: string;
  title: string;
  summary: string | null;
  content: string | null;
  status: DocStatus;
  category: DocCategory;
  isPinned: boolean;
};

export type OfficialDoc = {
  id: string;
  title: string;
  category: DocCategory;
  summary: string | null;
  content: string | null;
  status: DocStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  isPinned: boolean;
  assets: DocAsset[];
  revisions: DocRevision[];
};

export type OfficialDocForm = {
  id: string;
  title: string;
  category: DocCategory;
  summary: string;
  content: string;
  status: DocStatus;
  publishedAt: string;
  expiresAt: string;
  isPinned: boolean;
  assets: DocAsset[];
};

export type OfficialDocContentBlock =
  | { type: "text"; content: string }
  | { type: "image"; url: string };

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  STIMULATION_PROGRAM: "Chương trình kích thích",
  VIDEO_GUIDE: "Video hướng dẫn nghiệp vụ",
  COMMUNICATION_CONTENT: "Nội dung truyền thông",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã phát hành",
};

export const DOC_ASSET_TYPE_LABEL: Record<DocAssetType, string> = {
  VIDEO: "Video",
  IMAGE: "Hình ảnh",
  FILE: "Tệp",
};

export function createEmptyDocForm(): OfficialDocForm {
  return {
    id: "",
    title: "",
    category: "COMMUNICATION_CONTENT",
    summary: "",
    content: "",
    status: "PUBLISHED",
    publishedAt: "",
    expiresAt: "",
    isPinned: false,
    assets: [],
  };
}

export function buildDocFormFromDoc(doc: OfficialDoc | null): OfficialDocForm {
  if (!doc) return createEmptyDocForm();
  return {
    id: doc.id,
    title: doc.title || "",
    category: doc.category,
    summary: doc.summary || "",
    content: doc.content || "",
    status: doc.status,
    publishedAt: formatIsoToVnDate(doc.publishedAt),
    expiresAt: formatIsoToVnDate(doc.expiresAt),
    isPinned: !!doc.isPinned,
    assets: Array.isArray(doc.assets) ? doc.assets : [],
  };
}

export function getDocAssetStats(assets: DocAsset[] | undefined) {
  const list = Array.isArray(assets) ? assets : [];
  return {
    total: list.length,
    videos: list.filter((asset) => asset.type === "VIDEO").length,
    files: list.filter((asset) => asset.type !== "VIDEO").length,
  };
}

export function canViewOfficialDocRevisionHistory(role?: string | null): boolean {
  return String(role || "").toUpperCase() === "ADMIN";
}

function isImageUrlLine(value: string) {
  return /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?\S*)?$/i.test(value);
}

function isStandaloneHttpLine(value: string) {
  return /^https?:\/\/\S+$/i.test(value);
}

export function getOfficialDocInlineImageWarnings(content: string | null | undefined): string[] {
  const source = String(content || "").replace(/\r\n/g, "\n");
  if (!source.trim()) return [];

  const warnings: string[] = [];
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() || "";
    if (!line) continue;
    if (isStandaloneHttpLine(line) && !isImageUrlLine(line)) {
      warnings.push(`Dòng ${index + 1}: URL này sẽ không hiển thị thành ảnh inline.`);
    }
  }

  return warnings;
}

export function appendOfficialDocImageUrl(content: string | null | undefined, imageUrl: string): string {
  const current = String(content || "").replace(/\r\n/g, "\n").trimEnd();
  const nextUrl = String(imageUrl || "").trim();
  if (!nextUrl) return current;
  if (!current) return nextUrl;
  return `${current}\n\n${nextUrl}`;
}

export function parseOfficialDocContentBlocks(content: string | null | undefined): OfficialDocContentBlock[] {
  const source = String(content || "").replace(/\r\n/g, "\n");
  if (!source.trim()) return [];

  const lines = source.split("\n");
  const blocks: OfficialDocContentBlock[] = [];
  let textBuffer: string[] = [];

  const flushText = () => {
    const normalized = textBuffer.join("\n").trim();
    if (normalized) {
      blocks.push({ type: "text", content: normalized });
    }
    textBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushText();
      continue;
    }

    if (isImageUrlLine(line)) {
      flushText();
      blocks.push({ type: "image", url: line });
      continue;
    }

    textBuffer.push(line);
  }

  flushText();
  return blocks;
}

export function formatIsoToVnDate(value?: string | null): string {
  if (!value) return "";
  const datePart = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseVnDateToIso(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  ) {
    return null;
  }
  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
