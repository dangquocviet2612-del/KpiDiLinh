const BIDV_BANK_CODE = "BIDV";
const BIDV_ACCOUNT_PREFIX = "VIETTEL001";
const VIETQR_TEMPLATE = "compact2";

export function sanitizeQrContractInput(value: string) {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

export function normalizeQrContractNumber(value: string) {
  return sanitizeQrContractInput(value);
}

export function isValidQrContractNumber(value: string) {
  const normalized = normalizeQrContractNumber(value);
  return /^\d+$/.test(normalized);
}

export function normalizeQrAmount(value: string) {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

export function formatQrAmountPreview(value: string) {
  const normalized = normalizeQrAmount(value);
  if (!normalized) return "";
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function buildBidvQrAccountNumber(contractNumber: string) {
  const normalized = normalizeQrContractNumber(contractNumber);
  if (!isValidQrContractNumber(normalized)) {
    throw new Error("So hop dong khong hop le");
  }
  return `${BIDV_ACCOUNT_PREFIX}${normalized}`;
}

export function buildQrTransferContent(addInfo: string, contractNumber: string) {
  const normalizedContract = normalizeQrContractNumber(contractNumber);
  if (!isValidQrContractNumber(normalizedContract)) {
    throw new Error("So hop dong khong hop le");
  }

  const normalizedInfo = String(addInfo || "").trim().replace(/\s+/g, " ");
  return normalizedInfo || normalizedContract;
}

export function buildBidvQrImageUrl(
  contractNumber: string,
  options?: { amount?: string; addInfo?: string }
) {
  const accountNumber = buildBidvQrAccountNumber(contractNumber);
  const params = new URLSearchParams();
  const amount = normalizeQrAmount(options?.amount || "");
  const addInfo = buildQrTransferContent(options?.addInfo || "", contractNumber);

  if (amount) {
    params.set("amount", amount);
  }
  params.set("addInfo", addInfo);

  const query = params.toString();
  const baseUrl = `https://img.vietqr.io/image/${BIDV_BANK_CODE}-${accountNumber}-${VIETQR_TEMPLATE}.png`;
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export function getBidvQrDefaults() {
  return {
    bankCode: BIDV_BANK_CODE,
    accountPrefix: BIDV_ACCOUNT_PREFIX,
  };
}
