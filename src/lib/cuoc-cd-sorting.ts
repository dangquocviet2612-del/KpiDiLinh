export type CuocCdRow = {
  ctvUser: string;
  employeeCodeRaw: string;
  managerCodeRaw: string;
  dauKy: number;
  luyKe: number;
  thuaThieu: number;
  tonChuaThu: number;
};

export type CuocCdSummaryRow = {
  employeeCodeRaw: string;
  dauKy: number;
  luyKe: number;
  thuaThieu: number;
  tonChuaThu: number;
  isSummary: true;
};

export type CuocCdSortField =
  | "employeeCodeRaw"
  | "dauKy"
  | "luyKe"
  | "thuaThieu"
  | "tonChuaThu";

export type CuocCdSortDirection = "asc" | "desc";

export function sortCuocCdRows(
  rows: CuocCdRow[],
  field: CuocCdSortField | null,
  direction: CuocCdSortDirection = "asc"
): CuocCdRow[] {
  if (!field) return [...rows];

  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (field === "employeeCodeRaw") {
      cmp = (a.employeeCodeRaw || "").localeCompare(b.employeeCodeRaw || "", "vi", {
        numeric: true,
        sensitivity: "base",
      });
    } else {
      const aVal = a[field] ?? 0;
      const bVal = b[field] ?? 0;
      cmp = aVal - bVal;
    }

    if (direction === "desc") {
      cmp = -cmp;
    }

    // Secondary stable tie-breaker: employeeCodeRaw ascending
    if (cmp === 0 && field !== "employeeCodeRaw") {
      return (a.employeeCodeRaw || "").localeCompare(b.employeeCodeRaw || "", "vi", {
        numeric: true,
        sensitivity: "base",
      });
    }

    return cmp;
  });
}
