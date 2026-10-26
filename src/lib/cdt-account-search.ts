import { toTrimmedString } from "./import-utils";

export function normalizeCdtAccountSearch(value: unknown) {
  return toTrimmedString(value);
}

export function buildCdtAccountSearchPattern(value: unknown) {
  const normalized = normalizeCdtAccountSearch(value);
  if (!normalized) return null;
  return `%${normalized.toLowerCase()}%`;
}
