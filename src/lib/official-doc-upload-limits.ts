export const HOSTED_OFFICIAL_DOC_UPLOAD_MAX_BYTES = 4_000_000;
export const OFFICIAL_DOC_UPLOAD_SIZE_ERROR = "Tệp đính kèm tối đa 4 MB trên web. Vui lòng chọn tệp nhỏ hơn; với video, hãy dùng chức năng thêm link video.";

export function getOfficialDocUploadMaxBytes(): number | null {
  return process.env.VERCEL === "1" ? HOSTED_OFFICIAL_DOC_UPLOAD_MAX_BYTES : null;
}

export function getClientOfficialDocUploadMaxBytes(): number | null {
  return process.env.NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES === "0" ? null : HOSTED_OFFICIAL_DOC_UPLOAD_MAX_BYTES;
}
