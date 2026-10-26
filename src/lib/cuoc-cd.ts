import * as xlsx from "xlsx";
import fs from "fs";

export type ParsedCuocCdRow = {
  reportDate: string;
  employeeCodeRaw: string;
  managerCodeRaw: string;
  dauKy: number;
  luyKe: number;
  thuaThieu: number;
  tonChuaThu: number;
};

import type { CuocCdRow, CuocCdSummaryRow } from "./cuoc-cd-sorting";
export * from "./cuoc-cd-sorting";

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/\s/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseReportDate(rows: unknown[][]): string {
  for (const row of rows.slice(0, 10)) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const text = normalizeText(cell);
      const m = text.match(/(?:Ngày|ngày)?\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
      if (m) {
        const d = Number(m[1]);
        const mon = Number(m[2]) - 1;
        const y = Number(m[3]);
        return toYmd(new Date(y, mon, d));
      }
    }
  }
  return toYmd(new Date());
}

function ceilRound(val: number): number {
  const rounded = Math.ceil(val);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseCuocCdWorkbook(buffer: Buffer, targetRatePercent: number = 99.5): ParsedCuocCdRow[] {
  const wb = xlsx.read(buffer, { type: "buffer", cellFormula: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  if (!rows.length) return [];

  const reportDate = parseReportDate(rows);
  const out: ParsedCuocCdRow[] = [];
  const rateFactor = targetRatePercent / 100;

  // Actual data starts at row 6 (0-indexed)
  for (let i = 6; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const employeeCodeRaw = normalizeText(r[4]); // Cột E: User CNKD (Nhân viên)
    if (!employeeCodeRaw) continue;

    const managerCodeRaw = normalizeText(r[3]); // Cột D: Nhân viên quản lý
    const dauKy = parseNumber(r[10]); // Cột K: Đầu kỳ phải thu (KH)
    const luyKe = parseNumber(r[14]); // Cột O: Lũy kế thu (KH)

    // Cột T: Thuê bao thừa / thiếu (Công thức: K * (rate / 100) - O, làm tròn lên)
    const rawThuaThieu = dauKy * rateFactor - luyKe;
    const thuaThieu = ceilRound(rawThuaThieu);

    // Cột U: Còn tồn chưa thu (Công thức: K - O)
    const tonChuaThu = Number((dauKy - luyKe).toFixed(2));

    out.push({
      reportDate,
      employeeCodeRaw,
      managerCodeRaw,
      dauKy,
      luyKe,
      thuaThieu,
      tonChuaThu,
    });
  }

  return out;
}

export function buildCuocCdSummaryRow(rows: CuocCdRow[]): CuocCdSummaryRow | null {
  if (!rows.length) return null;

  const totalDauKy = rows.reduce((sum, r) => sum + Number(r.dauKy || 0), 0);
  const totalLuyKe = rows.reduce((sum, r) => sum + Number(r.luyKe || 0), 0);
  const totalThuaThieu = rows.reduce((sum, r) => sum + Number(r.thuaThieu || 0), 0);
  const totalTonChuaThu = rows.reduce((sum, r) => sum + Number(r.tonChuaThu || 0), 0);

  return {
    employeeCodeRaw: "Tổng",
    dauKy: Math.round(totalDauKy),
    luyKe: Math.round(totalLuyKe),
    thuaThieu: Math.round(totalThuaThieu),
    tonChuaThu: Math.round(totalTonChuaThu),
    isSummary: true,
  };
}

export function getDefaultCuocCdFilePath(): string {
  return process.env.CUOC_CD_DEFAULT_FILE_PATH || "";
}

export function loadDefaultCuocCdWorkbook(): ParsedCuocCdRow[] | null {
  const filePath = getDefaultCuocCdFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const buffer = fs.readFileSync(filePath);
      return parseCuocCdWorkbook(buffer);
    } catch (err) {
      console.error("Error reading default Cước CD file:", err);
    }
  }
  return null;
}
