export const HOSTED_NODE_UPLOAD_MAX_BYTES = 4_000_000;
export const NODE_UPLOAD_SIZE_ERROR = "File tối đa 4 MB cho mỗi lần import Node trên web. Hãy chia nhỏ file rồi thử lại.";

export function getNodeUploadMaxBytes(): number | null {
  return process.env.VERCEL === "1" ? HOSTED_NODE_UPLOAD_MAX_BYTES : null;
}

export function getClientNodeUploadMaxBytes(): number | null {
  return process.env.NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES === "0" ? null : HOSTED_NODE_UPLOAD_MAX_BYTES;
}
