export const HOSTED_BACKUP_RESTORE_MAX_BYTES = 4_000_000;
export const BACKUP_RESTORE_SIZE_ERROR = "Khôi phục trên web chỉ nhận file JSON tối đa 4 MB. Không chia nhỏ hoặc sửa file backup; hãy dùng quy trình khôi phục local/offline cho file lớn.";

export function getBackupRestoreMaxBytes(): number | null {
  return process.env.VERCEL === "1" ? HOSTED_BACKUP_RESTORE_MAX_BYTES : null;
}

export function getClientBackupRestoreMaxBytes(): number | null {
  return process.env.NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES === "0" ? null : HOSTED_BACKUP_RESTORE_MAX_BYTES;
}
