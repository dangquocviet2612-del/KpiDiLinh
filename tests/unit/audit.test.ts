import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

describe("recordAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an audit log entry in database with serialized JSON details", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    await recordAuditLog({
      userId: "user-123",
      username: "admin_boss",
      action: "CUSTOMER_BULK_DELETE",
      resource: "Customer",
      details: { count: 10 },
      ipAddress: "127.0.0.1",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        username: "admin_boss",
        action: "CUSTOMER_BULK_DELETE",
        resource: "Customer",
        details: JSON.stringify({ count: 10 }),
        ipAddress: "127.0.0.1",
      },
    });
  });

  it("does not throw exception if database insertion fails", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("DB Timeout"));

    await expect(
      recordAuditLog({
        userId: "user-123",
        username: "admin_boss",
        action: "TEST_ACTION",
        resource: "Test",
      })
    ).resolves.not.toThrow();
  });
});
