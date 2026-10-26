import * as xlsx from "xlsx";
import { normalizeHeaderKey, parseImportDate, toTrimmedString } from "./import-utils";

export const DISCONNECT_SOURCE_TV = "TH";
export const DISCONNECT_SOURCE_FTTH = "FTTH";
export const DISCONNECT_SOURCE_TYPES = [DISCONNECT_SOURCE_TV, DISCONNECT_SOURCE_FTTH] as const;
export type DisconnectSourceType = (typeof DISCONNECT_SOURCE_TYPES)[number];

export const DISCONNECT_TEMPLATE_HEADERS_BY_SOURCE: Record<DisconnectSourceType, readonly string[]> = {
  [DISCONNECT_SOURCE_TV]: ["THUE_BAO", "DICH_VU", "STAFF_CODE_THU_CUOC", "NGAY_CHAN_CHAR"],
  [DISCONNECT_SOURCE_FTTH]: ["THUE_BAO", "GOI_CUOC", "STAFF_CODE_THU_CUOC", "NGAY_CHAN_CHAR"],
};

export type DisconnectParsedRow = {
  account: string;
  serviceName: string | null;
  ctvCode: string;
  sourceLineNo: number;
  suspendedDateIso: string;
  suspendedDateText: string;
  cancelDateIso: string;
  cancelDateText: string;
  cancelMonth: string;
};

type DisconnectCtvUser = {
  username: string;
  secondaryCode?: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function readWorksheetCellValue(sheet: xlsx.WorkSheet, rowIndex: number, columnIndex: number): unknown {
  const denseSheet = sheet as unknown as Array<Array<{ v?: unknown } | undefined>>;
  const denseCell = denseSheet?.[rowIndex]?.[columnIndex];
  if (denseCell && typeof denseCell === "object" && "v" in denseCell) {
    return denseCell.v;
  }

  const encoded = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
  return (sheet as Record<string, { v?: unknown } | undefined>)[encoded]?.v;
}

function getWorksheetRange(sheet: xlsx.WorkSheet) {
  const fallback = xlsx.utils.decode_range("A1:A1");
  if (!sheet["!ref"]) return fallback;
  try {
    return xlsx.utils.decode_range(sheet["!ref"]);
  } catch {
    return fallback;
  }
}

function readWorksheetRow(sheet: xlsx.WorkSheet, rowIndex: number, startColumn: number, endColumn: number) {
  const row: unknown[] = [];
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    row.push(readWorksheetCellValue(sheet, rowIndex, columnIndex));
  }
  return row;
}

function hasMeaningfulDisconnectCell(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return toTrimmedString(value) !== "";
}

function getDisconnectServiceHeader(sourceType: DisconnectSourceType) {
  return sourceType === DISCONNECT_SOURCE_FTTH ? "goi cuoc" : "dich vu";
}

export function normalizeDisconnectSourceType(value: unknown): DisconnectSourceType | null {
  const normalized = toTrimmedString(value).trim().toUpperCase();
  if (normalized === DISCONNECT_SOURCE_TV) return DISCONNECT_SOURCE_TV;
  if (normalized === DISCONNECT_SOURCE_FTTH) return DISCONNECT_SOURCE_FTTH;
  return null;
}

export function getDisconnectSourceLabel(sourceType: unknown) {
  const normalized = normalizeDisconnectSourceType(sourceType);
  if (normalized === DISCONNECT_SOURCE_TV) return "Truyền hình";
  if (normalized === DISCONNECT_SOURCE_FTTH) return "FTTH";
  return "Chưa rõ";
}

export function getDisconnectTemplateHeaders(sourceType: DisconnectSourceType) {
  return DISCONNECT_TEMPLATE_HEADERS_BY_SOURCE[sourceType];
}

export function getDisconnectTemplateFileName(sourceType: DisconnectSourceType) {
  return sourceType === DISCONNECT_SOURCE_FTTH
    ? "mau-roi-mang-ftth.xlsx"
    : "mau-roi-mang-truyen-hinh.xlsx";
}

export function normalizeDisconnectCtvCode(value: unknown) {
  return toTrimmedString(value).trim().toLowerCase();
}

export function buildDisconnectCtvUsernameMaps(users: DisconnectCtvUser[]) {
  const byUsername = new Map<string, string>();
  const bySecondaryCode = new Map<string, string>();

  for (const user of users) {
    const username = toTrimmedString(user.username);
    const usernameKey = normalizeDisconnectCtvCode(username);
    const secondaryKey = normalizeDisconnectCtvCode(user.secondaryCode);

    if (username && usernameKey && !byUsername.has(usernameKey)) {
      byUsername.set(usernameKey, username);
    }
    if (username && secondaryKey && !bySecondaryCode.has(secondaryKey)) {
      bySecondaryCode.set(secondaryKey, username);
    }
  }

  return { byUsername, bySecondaryCode };
}

export function resolveDisconnectCtvUsername(
  rawCode: unknown,
  maps: ReturnType<typeof buildDisconnectCtvUsernameMaps>,
) {
  const codeKey = normalizeDisconnectCtvCode(rawCode);
  if (!codeKey) return "";
  return maps.bySecondaryCode.get(codeKey) || maps.byUsername.get(codeKey) || "";
}

export function normalizeDisconnectReportMonth(value: unknown) {
  const text = toTrimmedString(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}

export function formatDisconnectReportMonthLabel(reportMonth: string) {
  const normalized = normalizeDisconnectReportMonth(reportMonth);
  if (!normalized) return reportMonth;
  const [year, month] = normalized.split("-");
  return `Tháng ${month}/${year}`;
}

export function formatDisconnectCancelMonthLabel(cancelMonth: string) {
  const normalized = normalizeDisconnectReportMonth(cancelMonth);
  if (!normalized) return cancelMonth;
  const [year, month] = normalized.split("-");
  return `Tháng ${month}/${year}`;
}

export function formatDisconnectDateIso(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatDisconnectDateLabel(date: Date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function parseDisconnectDates(value: unknown) {
  const suspendedDate = parseImportDate(value);
  if (!suspendedDate) return null;
  const cancelDate = addDays(suspendedDate, 60);
  return {
    suspendedDateIso: formatDisconnectDateIso(suspendedDate),
    suspendedDateText: formatDisconnectDateLabel(suspendedDate),
    cancelDateIso: formatDisconnectDateIso(cancelDate),
    cancelDateText: formatDisconnectDateLabel(cancelDate),
  };
}

export function validateDisconnectHeaderRow(sourceType: DisconnectSourceType, row: unknown[]) {
  const actualHeaders = (Array.isArray(row) ? row : [])
    .map((cell) => normalizeHeaderKey(toTrimmedString(cell)))
    .filter(Boolean);
  const actualSet = new Set(actualHeaders);
  const expectedHeaders = getDisconnectTemplateHeaders(sourceType).map((header) => normalizeHeaderKey(header));
  const missingHeaders = expectedHeaders.filter((header) => !actualSet.has(header));

  return {
    matches: missingHeaders.length === 0,
    expectedHeaders,
    actualHeaders,
    missingHeaders,
  };
}

export function buildDisconnectHeaderIndexMap(row: unknown[]) {
  const indexes = new Map<string, number>();
  (Array.isArray(row) ? row : []).forEach((cell, index) => {
    const normalized = normalizeHeaderKey(toTrimmedString(cell));
    if (normalized && !indexes.has(normalized)) indexes.set(normalized, index);
  });
  return indexes;
}

export function parseDisconnectWorksheetRows(sheet: xlsx.WorkSheet, sourceType: DisconnectSourceType) {
  const range = getWorksheetRange(sheet);
  const headerRow = readWorksheetRow(sheet, range.s.r, range.s.c, range.e.c);
  const headerValidation = validateDisconnectHeaderRow(sourceType, headerRow);
  const headerMap = buildDisconnectHeaderIndexMap(headerRow);
  const errors: string[] = [];
  const deduped = new Map<string, DisconnectParsedRow>();
  let duplicateCount = 0;
  let totalRows = 0;

  const serviceHeader = getDisconnectServiceHeader(sourceType);
  const columnIndexes = [
    headerMap.get("thue bao"),
    headerMap.get(serviceHeader),
    headerMap.get("staff code thu cuoc"),
    headerMap.get("ngay chan char"),
  ].filter((value): value is number => typeof value === "number");

  if (!headerValidation.matches) {
    return {
      headerValidation,
      duplicateCount,
      errors,
      totalRows,
      rows: [] as DisconnectParsedRow[],
    };
  }

  const getCell = (rowIndex: number, header: string) => {
    const columnIndex = headerMap.get(header);
    return columnIndex === undefined ? "" : readWorksheetCellValue(sheet, rowIndex, columnIndex);
  };

  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const hasMeaningfulRow = columnIndexes.some((columnIndex) =>
      hasMeaningfulDisconnectCell(readWorksheetCellValue(sheet, rowIndex, columnIndex)),
    );
    if (!hasMeaningfulRow) continue;
    totalRows += 1;

    const lineNo = rowIndex + 1;
    const account = toTrimmedString(getCell(rowIndex, "thue bao"));
    const serviceName = toTrimmedString(getCell(rowIndex, serviceHeader)) || null;
    const ctvCode = toTrimmedString(getCell(rowIndex, "staff code thu cuoc"));
    const rawSuspendedDate = getCell(rowIndex, "ngay chan char");
    const parsedDates = parseDisconnectDates(rawSuspendedDate);

    if (!account) {
      errors.push(`Dòng ${lineNo}: thiếu THUE_BAO`);
      continue;
    }
    if (!ctvCode) {
      errors.push(`Dòng ${lineNo}: thiếu STAFF_CODE_THU_CUOC`);
      continue;
    }
    if (!parsedDates) {
      errors.push(`Dòng ${lineNo}: NGAY_CHAN_CHAR không hợp lệ`);
      continue;
    }

    const dedupeKey = account.trim().toLowerCase();
    if (deduped.has(dedupeKey)) duplicateCount += 1;
    deduped.set(dedupeKey, {
      account,
      serviceName,
      ctvCode,
      sourceLineNo: lineNo,
      suspendedDateIso: parsedDates.suspendedDateIso,
      suspendedDateText: parsedDates.suspendedDateText,
      cancelDateIso: parsedDates.cancelDateIso,
      cancelDateText: parsedDates.cancelDateText,
      cancelMonth: parsedDates.cancelDateIso.slice(0, 7),
    });
  }

  return {
    headerValidation,
    duplicateCount,
    errors,
    totalRows,
    rows: [...deduped.values()],
  };
}

export function buildDisconnectTemplateBuffer(sourceType: DisconnectSourceType) {
  const workbook = xlsx.utils.book_new();
  const rows =
    sourceType === DISCONNECT_SOURCE_FTTH
      ? [[...getDisconnectTemplateHeaders(sourceType)], ["l063_gftth_demo01", "HOME 2", "ANLT", "01/02/2026"]]
      : [[...getDisconnectTemplateHeaders(sourceType)], ["vt0982614739", "TV360_BoxTV trả sau", "ANLT", "01/02/2026"]];
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 22 },
    { wch: 16 },
  ];
  xlsx.utils.book_append_sheet(workbook, worksheet, sourceType === DISCONNECT_SOURCE_FTTH ? "Roi_mang_FTTH" : "Roi_mang_TH");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}
