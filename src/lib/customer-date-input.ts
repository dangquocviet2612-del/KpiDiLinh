function createExactDate(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isCompletedDateText(text: string) {
  return /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(text) || /^(\d{4})-(\d{2})-(\d{2})$/.test(text);
}

export function parseCustomerDateInput(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text || /^invalid date$/i.test(text)) {
    return null;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dayText, monthText, yearText] = slashMatch;
    return createExactDate(Number(yearText), Number(monthText) - 1, Number(dayText));
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, yearText, monthText, dayText] = isoDateMatch;
    return createExactDate(Number(yearText), Number(monthText) - 1, Number(dayText));
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isCompletedCustomerDateInput(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  const text = String(value).trim();
  if (!text) {
    return false;
  }

  return isCompletedDateText(text);
}

export function getCustomerDateInputWarning(value: unknown) {
  if (!isCompletedCustomerDateInput(value)) {
    return null;
  }

  return parseCustomerDateInput(value) === null
    ? "Ngày gia hạn không hợp lệ. Kiểm tra lại định dạng dd/mm/yyyy."
    : null;
}

export function calculateCustomerExpirationDate(
  renewalMonth: Date | null,
  prepaidPeriod: number | null,
  subscriberType: string | null | undefined,
) {
  if (!renewalMonth || !prepaidPeriod || prepaidPeriod <= 0) {
    return null;
  }

  const expirationDate = new Date(renewalMonth.getTime());
  let addMonths = prepaidPeriod;
  if ((subscriberType || "FIXED") === "FIXED" && addMonths === 12) {
    addMonths += 1;
  }

  expirationDate.setMonth(expirationDate.getMonth() + addMonths);
  return expirationDate;
}
