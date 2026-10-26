import * as xlsx from "xlsx";
import { normalizeManagerUser } from "@/lib/manager-kpi-utils";

const MANAGER_KPI_METRICS_PER_GROUP = 8;

export type ParsedManagerKpiRow = {
  reportDate: string;
  managerUser: string;
  managerName: string;
  jobTitle: string;
  metricCode: string;
  metricName: string;
  metricLabel: string;
  khToDate: number | null;
  khMonth: number | null;
  thDay: number | null;
  thLuyKe: number | null;
  percentToDate: number | null;
  percentMonth: number | null;
  samePeriodValue: number | null;
  growthPercent: number | null;
  rawPayload: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseNumber(value: unknown): number | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const normalized = raw.replace(/%/g, "").replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReportDate(rows: unknown[][]): string {
  for (const row of rows.slice(0, 8)) {
    for (const cell of row) {
      const text = normalizeText(cell);
      const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!match) continue;
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const year = Number(match[3]);
      return toYmd(new Date(year, month, day));
    }
  }
  return toYmd(new Date());
}

function splitMetricName(value: string) {
  const fullName = normalizeText(value);
  if (!fullName) return { metricCode: "", metricName: "", metricLabel: "" };
  const parts = fullName.split(" - ");
  if (parts.length >= 2) {
    const metricCode = normalizeText(parts[0]);
    const metricLabel = normalizeText(parts.slice(1).join(" - "));
    return {
      metricCode,
      metricName: fullName,
      metricLabel: metricLabel || metricCode,
    };
  }
  return {
    metricCode: fullName,
    metricName: fullName,
    metricLabel: fullName,
  };
}

export function parseManagerKpiWorkbook(buffer: Buffer): ParsedManagerKpiRow[] {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];

  if (!rows.length) return [];

  const reportDate = parseReportDate(rows);
  const metricNameRow = rows[5] ?? [];
  const metricHeaderRow = rows[6] ?? [];
  const dataRows = rows.slice(7);
  const metricCols = new Map<number, ReturnType<typeof splitMetricName>>();

  for (let col = 6; col < metricNameRow.length; col += MANAGER_KPI_METRICS_PER_GROUP) {
    const metricInfo = splitMetricName(normalizeText(metricNameRow[col]));
    if (!metricInfo.metricCode) continue;
    metricCols.set(col, metricInfo);
  }

  const output: ParsedManagerKpiRow[] = [];
  for (const row of dataRows) {
    const managerUser = normalizeManagerUser(row[3]);
    if (!managerUser) continue;

    const managerName = normalizeText(row[4]);
    const jobTitle = normalizeText(row[5]);

    for (const [startCol, metricInfo] of metricCols.entries()) {
      const rawSlice = row.slice(startCol, startCol + MANAGER_KPI_METRICS_PER_GROUP).map(normalizeText);
      if (rawSlice.every((value) => value === "")) continue;

      const record: ParsedManagerKpiRow = {
        reportDate,
        managerUser,
        managerName,
        jobTitle,
        metricCode: metricInfo.metricCode,
        metricName: metricInfo.metricName,
        metricLabel: metricInfo.metricLabel,
        khToDate: parseNumber(row[startCol]),
        khMonth: parseNumber(row[startCol + 1]),
        thDay: parseNumber(row[startCol + 2]),
        thLuyKe: parseNumber(row[startCol + 3]),
        percentToDate: parseNumber(row[startCol + 4]),
        percentMonth: parseNumber(row[startCol + 5]),
        samePeriodValue: parseNumber(row[startCol + 6]),
        growthPercent: parseNumber(row[startCol + 7]),
        rawPayload: JSON.stringify({
          provinceCode: normalizeText(row[0]),
          clusterCode: normalizeText(row[1]),
          clusterName: normalizeText(row[2]),
          managerUser,
          managerName,
          jobTitle,
          headers: metricHeaderRow.slice(startCol, startCol + MANAGER_KPI_METRICS_PER_GROUP).map(normalizeText),
        }),
      };

      output.push(record);
    }
  }

  return output;
}
