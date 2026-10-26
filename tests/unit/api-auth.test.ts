import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

describe("requireAuth Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 response if user is unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const result = await requireAuth();
    expect(result.user).toBeNull();
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it("returns 403 response if user does not have required role", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", name: "ctv_user", role: "CTV" },
      expires: "2099-01-01",
    } as any);

    const result = await requireAuth({ roles: ["ADMIN"] });
    expect(result.user).toBeNull();
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(403);
  });

  it("returns user object and null errorResponse when role matches", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "admin-1", name: "admin_boss", role: "ADMIN" },
      expires: "2099-01-01",
    } as any);

    const result = await requireAuth({ roles: ["ADMIN", "MANAGER"] });
    expect(result.errorResponse).toBeNull();
    expect(result.user).not.toBeNull();
    expect(result.user?.id).toBe("admin-1");
    expect(result.user?.role).toBe("ADMIN");
  });

  it("returns 403 if requireGps is requested and user.canUseGps is false", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "ctv-nogps", name: "ctv_nogps", role: "CTV" },
      expires: "2099-01-01",
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      canUseGps: false,
      managerCode: null,
      secondaryCode: null,
    } as any);

    const result = await requireAuth({ requireGps: true });
    expect(result.user).toBeNull();
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(403);
  });

  it("allows access when requireGps is requested and user.canUseGps is true", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "ctv-gps", name: "ctv_gps", role: "CTV" },
      expires: "2099-01-01",
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      canUseGps: true,
      managerCode: "QL_01",
      secondaryCode: null,
    } as any);

    const result = await requireAuth({ requireGps: true });
    expect(result.errorResponse).toBeNull();
    expect(result.user?.canUseGps).toBe(true);
    expect(result.user?.managerCode).toBe("QL_01");
  });
});
