import * as xlsx from "xlsx";

export type ParsedKpiRow = {
  reportDate: string;
  ctvUser: string;
  kpiCode: string;
  kpiName: string;
  khThang: number | null;
  thNgay: number | null;
  thLuyKe: number | null;
  completionPercent: number | null;
  growthPercent: number | null;
  rawPayload: string;
};

const KPI_METRICS_PER_GROUP = 8;

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim().replace(/%/g, "").replace(/,/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseReportDate(lines: unknown[][]): string {
  for (const row of lines.slice(0, 10)) {
    for (let i = 0; i < row.length; i += 1) {
      const cell = normalizeText(row[i]);
      if (cell.toLowerCase().includes("ngày báo cáo")) {
        const rightValue = normalizeText(row[i + 1]);
        const match = rightValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const d = Number(match[1]);
          const m = Number(match[2]) - 1;
          const y = Number(match[3]);
          return toYmd(new Date(y, m, d));
        }
      }
    }
  }
  return toYmd(new Date());
}

function extractKpiCodeAndName(value: string): { code: string; name: string } {
  const text = normalizeText(value);
  if (!text) return { code: "", name: "" };
  const parts = text.split(" - ");
  if (parts.length >= 2) {
    return { code: normalizeText(parts[0]), name: normalizeText(parts.slice(1).join(" - ")) };
  }
  return { code: text, name: text };
}

export function parseGbocWorkbook(buffer: Buffer): ParsedKpiRow[] {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];

  if (!rows.length) return [];

  const reportDate = parseReportDate(rows);
  const headerIndex = rows.findIndex((row) => row.some((c) => normalizeText(c) === "Mã tỉnh") && row.some((c) => normalizeText(c) === "User HKD"));
  if (headerIndex <= 0) return [];

  const kpiNameRow = rows[headerIndex - 1] ?? [];
  const metricHeaderRow = rows[headerIndex] ?? [];
  const metricCols = new Map<number, { code: string; name: string }>();

  for (let col = 8; col < metricHeaderRow.length; col += KPI_METRICS_PER_GROUP) {
    const kpiInfo = extractKpiCodeAndName(normalizeText(kpiNameRow[col]));
    if (!kpiInfo.code) continue;
    metricCols.set(col, kpiInfo);
  }

  const output: ParsedKpiRow[] = [];
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const ctvUser = normalizeText(row[4]);
    if (!ctvUser) continue;

    for (const [startCol, kpiInfo] of metricCols.entries()) {
      const khThang = parseNumber(row[startCol + 1]);
      const thNgay = parseNumber(row[startCol + 2]);
      const thLuyKe = parseNumber(row[startCol + 3]);
      const completionPercent = parseNumber(row[startCol + 5]);
      const growthPercent = parseNumber(row[startCol + 7]);

      const hasValue = [khThang, thNgay, thLuyKe, completionPercent, growthPercent].some((n) => n !== null);
      if (!hasValue) continue;

      output.push({
        reportDate,
        ctvUser,
        kpiCode: kpiInfo.code,
        kpiName: kpiInfo.name || kpiInfo.code,
        khThang,
        thNgay,
        thLuyKe,
        completionPercent,
        growthPercent,
        rawPayload: JSON.stringify({
          maTinh: normalizeText(row[0]),
          maCumXa: normalizeText(row[1]),
          tenCumXa: normalizeText(row[2]),
          maXa: normalizeText(row[3]),
          tenHkd: normalizeText(row[5]),
        }),
      });
    }
  }

  return output;
}

