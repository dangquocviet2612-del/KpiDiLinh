import { describe, it, expect } from "vitest";
import { getAccessibleCtvCodes, canAccessCustomerByCtvCode } from "@/lib/scope";

describe("Scope & Permission Security", () => {
  it("ADMIN has unrestricted access (returns null for all CTV codes)", async () => {
    const adminSession = {
      user: {
        role: "ADMIN",
        name: "admin_user",
      },
    };

    const allowed = await getAccessibleCtvCodes(adminSession);
    expect(allowed).toBeNull();

    const canAccessAny = await canAccessCustomerByCtvCode(adminSession, "ANY_CTV_CODE");
    expect(canAccessAny).toBe(true);
  });

  it("CTV is scoped strictly to their own username", async () => {
    const ctvSession = {
      user: {
        role: "CTV",
        name: "CTV_HUE",
      },
    };

    const allowed = await getAccessibleCtvCodes(ctvSession);
    expect(allowed).toEqual(["CTV_HUE"]);

    const canAccessOwn = await canAccessCustomerByCtvCode(ctvSession, "CTV_HUE");
    expect(canAccessOwn).toBe(true);

    const canAccessOther = await canAccessCustomerByCtvCode(ctvSession, "CTV_OTHER");
    expect(canAccessOther).toBe(false);
  });

  it("unauthenticated or empty role returns empty list (denies access)", async () => {
    const noAuth = null;
    const allowed = await getAccessibleCtvCodes(noAuth);
    expect(allowed).toEqual([]);

    const canAccess = await canAccessCustomerByCtvCode(noAuth, "CTV_ANY");
    expect(canAccess).toBe(false);
  });
});
