import * as xlsx from "xlsx";
import { normalizeHeaderKey, toTrimmedString } from "./import-utils";

export const OUTSTANDING_STATUS_PENDING = "Ch\u01b0a thu";
export const OUTSTANDING_STATUS_COLLECTED = "\u0110\u00e3 thu";
export const OUTSTANDING_STATUS_UNKNOWN = "Ch\u01b0a r\u00f5";

export const CDT_OUTSTANDING_TEMPLATE_HEADERS = [
  "S\u1ed1 thu\u00ea bao",
  "T\u00ean Kh\u00e1ch",
  "SDT",
  "\u0110\u1ecba ch\u1ec9",
  "M\u00e3 CTV",
  "D\u1ecbch v\u1ee5",
  "Ng\u00e0y h\u1ebft h\u1ea1n cdt",
  "Th\u00e1ng h\u1ebft h\u1ea1n",
] as const;

export type CdtOutstandingSubscriberType = "FTTH" | "THS" | "Camera" | "Kh\u00e1c";

export function normalizeOutstandingReportMonth(value: unknown) {
  const text = toTrimmedString(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}

export function normalizeOutstandingExpiryMonth(value: unknown) {
  const text = toTrimmedString(value);
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  const month = Math.trunc(numeric);
  if (month < 1 || month > 12) return null;
  return String(month).padStart(2, "0");
}

export function normalizeOutstandingStatus(value: unknown) {
  const text = toTrimmedString(value);
  const normalized = normalizeHeaderKey(text);
  if (!normalized) return OUTSTANDING_STATUS_UNKNOWN;
  if (normalized.includes("chua thu")) return OUTSTANDING_STATUS_PENDING;
  if (normalized.includes("da thu")) return OUTSTANDING_STATUS_COLLECTED;
  return text;
}

export function detectOutstandingSubscriberType(
  serviceName: unknown,
  account: unknown,
): CdtOutstandingSubscriberType {
  const service = normalizeHeaderKey(toTrimmedString(serviceName));
  if (service.includes("camera")) return "Camera";
  if (service.includes("ftth") || service.includes("gpon")) return "FTTH";
  if (service.includes("ths") || service.includes("truyen hinh")) return "THS";

  const normalizedAccount = toTrimmedString(account).toLowerCase();
  if (normalizedAccount.startsWith("c")) return "Camera";
  if (normalizedAccount.startsWith("vt") || normalizedAccount.startsWith("l063_gmts")) return "THS";
  if (normalizedAccount.startsWith("ldg_gftth") || normalizedAccount.startsWith("l063_gftth")) return "FTTH";
  return "Kh\u00e1c";
}

export function validateCdtOutstandingHeaderRow(row: unknown[]) {
  const actualHeaders = (Array.isArray(row) ? row : []).map((cell) => normalizeHeaderKey(toTrimmedString(cell)));
  const expectedHeaders = CDT_OUTSTANDING_TEMPLATE_HEADERS.map((header) => normalizeHeaderKey(header));
  const matches =
    actualHeaders.length >= expectedHeaders.length &&
    expectedHeaders.every((header, index) => actualHeaders[index] === header);

  return {
    matches,
    expectedHeaders,
    actualHeaders: actualHeaders.slice(0, expectedHeaders.length),
  };
}

export function buildCdtOutstandingTemplateBuffer() {
  const sampleRows = [
    [...CDT_OUTSTANDING_TEMPLATE_HEADERS],
    [
      "l063_gftth_demo01",
      "Nguy\u1ec5n Van Demo",
      "0912345678",
      "Thon 1, Di Linh, Lam Dong",
      "DEMOCTV_LDG_CNKD",
      "DV FTTH - FTTH_GPON",
      "28/02",
      "02",
    ],
  ];

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet(sampleRows);
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 44 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
  ];
  xlsx.utils.book_append_sheet(workbook, worksheet, "Ton_CDT");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function formatOutstandingReportMonthLabel(reportMonth: string) {
  const normalized = normalizeOutstandingReportMonth(reportMonth);
  if (!normalized) return reportMonth;
  const [year, month] = normalized.split("-");
  return `Tháng ${month}/${year}`;
}
