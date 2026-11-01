import { BACKUP_RESTORE_SIZE_ERROR, getBackupRestoreMaxBytes } from "@/lib/backup-restore-limits";

export class BackupRestoreSizeError extends Error {
  constructor() {
    super(BACKUP_RESTORE_SIZE_ERROR);
    this.name = "BackupRestoreSizeError";
  }
}

export async function readBackupRestorePayload(request: Request): Promise<unknown> {
  const maxBytes = getBackupRestoreMaxBytes();
  if (maxBytes === null) return request.json();

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new BackupRestoreSizeError();
  }
  if (!request.body) throw new SyntaxError("Unexpected end of JSON input");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new BackupRestoreSizeError();
      }
      chunks.push(Uint8Array.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
