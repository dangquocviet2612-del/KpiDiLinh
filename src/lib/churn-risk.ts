import * as xlsx from "xlsx";

export interface ChurnRiskRow {
  id?: number;
  reportMonth: string;
  ctvCode: string;
  customerName: string;
  phone: string;
  packageName: string;
  address: string;
  sourceFile?: string;
  createdAt?: string;
}

/**
 * Column indices from Excel:
 * F (index 5) = Mã nhân viên được giao
 * J (index 9) = Tên khách hàng
 * K (index 10) = SĐT khách hàng
 * L (index 11) = Gói cước
 * R (index 17) = Địa chỉ thu cước
 */
const COL_CTV_CODE = 5;
const COL_CUSTOMER_NAME = 9;
const COL_PHONE = 10;
const COL_PACKAGE = 11;
const COL_ADDRESS = 17;

export const CHURN_RISK_EXPECTED_HEADERS = [
  "Mã nhân viên được giao",
  "Tên khách hàng",
  "SĐT khách hàng",
  "Gói cước",
  "Địa chỉ thu cước",
];

function cellValue(row: any[], index: number): string {
  const val = row[index];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export function parseChurnRiskWorksheet(
  buffer: Buffer,
): {
  rows: Omit<ChurnRiskRow, "id" | "reportMonth" | "sourceFile" | "createdAt">[];
  totalRows: number;
  errors: string[];
  headerValidation: { matches: boolean; missingHeaders: string[] };
} {
  const workbook = xlsx.read(buffer, {
    type: "buffer",
    raw: true,
    dense: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    cellText: false,
    sheetStubs: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      totalRows: 0,
      errors: ["Không đọc được sheet dữ liệu"],
      headerValidation: { matches: false, missingHeaders: [] },
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      errors: ["File không có dữ liệu"],
      headerValidation: { matches: false, missingHeaders: [] },
    };
  }

  const headers = data[0] || [];
  const missingHeaders: string[] = [];
  const headerChecks = [
    { index: COL_CTV_CODE, name: "Mã nhân viên được giao" },
    { index: COL_CUSTOMER_NAME, name: "Tên khách hàng" },
    { index: COL_PHONE, name: "SĐT khách hàng" },
    { index: COL_PACKAGE, name: "Gói cước" },
    { index: COL_ADDRESS, name: "Địa chỉ thu cước" },
  ];

  for (const check of headerChecks) {
    const actual = String(headers[check.index] || "").trim();
    if (!actual.toLowerCase().includes(check.name.toLowerCase().slice(0, 6))) {
      missingHeaders.push(check.name);
    }
  }

  const headerMatches = missingHeaders.length === 0;

  const rows: Omit<ChurnRiskRow, "id" | "reportMonth" | "sourceFile" | "createdAt">[] = [];
  const errors: string[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const ctvCode = cellValue(row, COL_CTV_CODE);
    const customerName = cellValue(row, COL_CUSTOMER_NAME);
    const phone = cellValue(row, COL_PHONE);
    const packageName = cellValue(row, COL_PACKAGE);
    const address = cellValue(row, COL_ADDRESS);

    if (!ctvCode && !customerName && !phone) {
      continue; // skip empty rows
    }

    if (!ctvCode) {
      errors.push(`Dòng ${i + 1}: Thiếu mã nhân viên`);
      continue;
    }

    rows.push({
      ctvCode,
      customerName,
      phone,
      packageName,
      address,
    });
  }

  return {
    rows,
    totalRows: data.length - 1,
    errors,
    headerValidation: { matches: headerMatches, missingHeaders },
  };
}
