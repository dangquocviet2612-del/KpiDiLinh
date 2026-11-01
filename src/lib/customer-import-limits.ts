export const HOSTED_CUSTOMER_IMPORT_MAX_BYTES = 4_000_000;
export const CUSTOMER_IMPORT_SIZE_ERROR = "File Excel tối đa 4 MB cho mỗi lần import trên web. Hãy chia nhỏ file rồi thử lại.";

export function getCustomerImportMaxBytes(): number | null {
  return process.env.VERCEL === "1" ? HOSTED_CUSTOMER_IMPORT_MAX_BYTES : null;
}

export function getClientCustomerImportMaxBytes(): number | null {
  return process.env.NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES === "0" ? null : HOSTED_CUSTOMER_IMPORT_MAX_BYTES;
}
