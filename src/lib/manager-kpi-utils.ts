export function normalizeManagerUser(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}
