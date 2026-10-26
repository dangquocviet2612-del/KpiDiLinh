import * as xlsx from "xlsx";

export function normalizeHeaderKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeImportText(value: unknown) {
  return normalizeHeaderKey(String(value ?? ""));
}

export function toTrimmedString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseImportNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = toTrimmedString(value);
  if (!text) return null;

  const normalized = text
    .replace(/\s+/g, "")
    .replace(/đ/gi, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseImportInteger(value: unknown) {
  const parsed = parseImportNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function parseImportDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = toTrimmedString(value);
  if (!text) return null;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dayText, monthText, yearText] = slashMatch;
    const day = Number(dayText);
    const month = Number(monthText) - 1;
    const year = Number(yearText);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseImportDateToIsoDate(value: unknown) {
  const date = parseImportDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseImportTime(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    const hh = String(parsed.H || 0).padStart(2, "0");
    const mm = String(parsed.M || 0).padStart(2, "0");
    const ss = String(parsed.S || 0).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const raw = toTrimmedString(value);
  const matched = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(raw);
  if (matched) {
    const hh = String(Number(matched[1])).padStart(2, "0");
    const mm = String(Number(matched[2])).padStart(2, "0");
    const ss = String(Number(matched[3] || 0)).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function buildImportErrorCsv(errors: string[], header = "Chi tiết lỗi") {
  if (errors.length === 0) return undefined;
  return [header, ...errors.map((line) => `"${String(line).replace(/"/g, '""')}"`)].join("\n");
}

export function createRowLookup(row: Record<string, unknown>) {
  const normalized = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeaderKey(key);
    if (normalizedKey && !normalized.has(normalizedKey)) {
      normalized.set(normalizedKey, value);
    }
  }

  return (...keys: string[]) => {
    for (const key of keys) {
      if (key in row) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== "") {
          return value;
        }
      }
    }

    for (const key of keys) {
      const value = normalized.get(normalizeHeaderKey(key));
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return undefined;
  };
}
