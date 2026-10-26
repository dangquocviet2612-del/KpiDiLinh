import { prisma } from "@/lib/prisma";

export interface AuditLogEntry {
  userId: string;
  username: string;
  action: string;
  resource: string;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

/**
 * Persists an audit log entry for critical system events, bulk operations, or security alterations.
 * Fails gracefully without blocking the parent business operation.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const detailsStr =
      entry.details && typeof entry.details === "object"
        ? JSON.stringify(entry.details)
        : (entry.details as string) || null;

    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        username: entry.username,
        action: entry.action,
        resource: entry.resource,
        details: detailsStr,
        ipAddress: entry.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("AUDIT_LOG_RECORD_ERROR", err);
  }
}
