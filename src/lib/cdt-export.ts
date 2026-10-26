function isValidMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function toMonthKeyFromIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : "";
}

function getMonthEndDay(year: number, monthIndexZeroBased: number) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

export function resolveCdtExportMonth(input: {
  month?: string;
  from?: string;
  to?: string;
  fallbackDate?: string;
}) {
  const month = String(input.month || "").trim();
  if (month) {
    if (!isValidMonthKey(month)) {
      throw new Error("Thang export khong hop le");
    }
    return month;
  }

  const fromMonth = toMonthKeyFromIsoDate(String(input.from || "").trim());
  const toMonth = toMonthKeyFromIsoDate(String(input.to || "").trim());
  if (fromMonth && toMonth) {
    if (fromMonth !== toMonth) {
      throw new Error("Vui long chon bo loc cung mot thang de tai file CDT");
    }
    return fromMonth;
  }

  if (fromMonth) return fromMonth;
  if (toMonth) return toMonth;

  const fallbackMonth = toMonthKeyFromIsoDate(String(input.fallbackDate || "").trim());
  if (fallbackMonth) return fallbackMonth;

  throw new Error("Khong xac dinh duoc thang export CDT");
}

export function buildCdtMonthRange(month: string) {
  if (!isValidMonthKey(month)) {
    throw new Error("Thang export khong hop le");
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const lastDay = getMonthEndDay(year, monthIndex);

  return {
    from: `${yearText}-${monthText}-01`,
    to: `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildCdtExportFileName(month: string) {
  if (!isValidMonthKey(month)) {
    throw new Error("Thang export khong hop le");
  }
  return `CDT_${month}.xlsx`;
}

export function buildCdtExportSuccessMessage(month: string) {
  return `Da tai xong ${buildCdtExportFileName(month)}`;
}

export type CdtExportSheetRow = {
  transactionDate: string;
  transactionTime?: string | null;
  ctvUser: string;
  subscriberType: string;
  account: string;
  months: number;
  amount: number;
};

export function buildCdtExportSheetRows(rows: CdtExportSheetRow[]) {
  const header = [
    "Ngày giao dịch",
    "Giờ giao dịch",
    "CTV",
    "Loại thuê bao",
    "Account",
    "Số tháng",
    "Số tiền",
  ];

  return [
    header,
    ...rows.map((row) => [
      row.transactionDate || "",
      row.transactionTime || "",
      row.ctvUser || "",
      row.subscriberType || "",
      row.account || "",
      Number(row.months || 0),
      Number(row.amount || 0),
    ]),
  ];
}

export type CdtExportWorkbookSheet = {
  name: string;
  rows: Array<Array<string | number>>;
};

function normalizeSubscriberType(value: string) {
  return String(value || "").trim().toUpperCase();
}

function buildCdtExportSummaryRows(rows: CdtExportSheetRow[]) {
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return [
    ["Tổng số giao dịch", rows.length],
    ["Tổng tiền", totalAmount],
    [],
  ];
}

function buildWorkbookSheet(name: string, rows: CdtExportSheetRow[]): CdtExportWorkbookSheet {
  return {
    name,
    rows: [...buildCdtExportSummaryRows(rows), ...buildCdtExportSheetRows(rows)],
  };
}

export function buildCdtExportWorkbookSheets(rows: CdtExportSheetRow[]) {
  const ftthRows = rows.filter((row) => normalizeSubscriberType(row.subscriberType) === "FTTH");
  const thsRows = rows.filter((row) => normalizeSubscriberType(row.subscriberType) === "THS");
  const cameraRows = rows.filter((row) => {
    const type = normalizeSubscriberType(row.subscriberType);
    return type !== "FTTH" && type !== "THS";
  });

  return [
    buildWorkbookSheet("Tong hop", rows),
    buildWorkbookSheet("FTTH", ftthRows),
    buildWorkbookSheet("THS", thsRows),
    buildWorkbookSheet("Camera", cameraRows),
  ];
}
