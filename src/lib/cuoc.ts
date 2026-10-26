import * as xlsx from "xlsx";

export type ParsedCuocRow = {
  reportDate: string;
  employeeCodeRaw: string;
  managerCodeRaw: string;
  targetAmount: number;
  collectedAmount: number;
  completionPercent: number;
  missingAmount: number;
};

export type CuocSummarySourceRow = {
  ctvUser: string;
  targetAmount: number;
  collectedAmount: number;
  completionPercent: number;
  missingAmount: number;
};

export type CuocSummaryRow = CuocSummarySourceRow & {
  isSummary: true;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown): number {
  const raw = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/\s/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeCuocMissingAmount(
  targetAmount: number,
  collectedAmount: number,
  targetRatePercent: number
): number {
  const target = Number(targetAmount || 0);
  const collected = Number(collectedAmount || 0);
  const targetRate = Number(targetRatePercent || 0);
  const requiredAmount = target * (targetRate / 100);
  return Number((requiredAmount - collected).toFixed(2));
}

export function buildCuocSummaryRow(
  rows: CuocSummarySourceRow[],
  managerTargetRatePercent = 97.3
): CuocSummaryRow | null {
  if (!rows.length) return null;
  const totalTargetAmount = rows.reduce((sum, row) => sum + Number(row.targetAmount || 0), 0);
  const totalCollectedAmount = rows.reduce((sum, row) => sum + Number(row.collectedAmount || 0), 0);
  if (!Number.isFinite(totalTargetAmount) || totalTargetAmount <= 0) return null;

  const completionPercent = Number(((totalCollectedAmount / totalTargetAmount) * 100).toFixed(2));
  return {
    ctvUser: "T\u1ed5ng",
    targetAmount: Number(totalTargetAmount.toFixed(2)),
    collectedAmount: Number(totalCollectedAmount.toFixed(2)),
    completionPercent,
    missingAmount: computeCuocMissingAmount(totalTargetAmount, totalCollectedAmount, managerTargetRatePercent),
    isSummary: true,
  };
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseReportDate(rows: unknown[][]): string {
  for (const row of rows.slice(0, 6)) {
    for (const cell of row) {
      const text = normalizeText(cell);
      const m = text.match(/Ngày:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
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

export function parseCuocWorkbook(buffer: Buffer): ParsedCuocRow[] {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
  if (!rows.length) return [];

  const reportDate = parseReportDate(rows);

  // Actual data starts from line 7 in provided file format.
  const out: ParsedCuocRow[] = [];
  for (let i = 6; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const employeeCodeRaw = normalizeText(r[4]);
    if (!employeeCodeRaw) continue;

    const managerCodeRaw = normalizeText(r[3]);
    const targetAmount = parseNumber(r[11]); // Đầu kỳ phải thu (Tiền)
    const collectedAmount = parseNumber(r[15]); // Lũy kế thu (Tiền)
    // Column R in the provided report template: % Hoàn thành (Tiền)
    const completionPercentFromR = parseNumber(r[17]);
    const completionPercent = completionPercentFromR;
    const missingAmount = computeCuocMissingAmount(targetAmount, collectedAmount, 97.3);

    out.push({
      reportDate,
      employeeCodeRaw,
      managerCodeRaw,
      targetAmount,
      collectedAmount,
      completionPercent,
      missingAmount,
    });
  }
  return out;
}
