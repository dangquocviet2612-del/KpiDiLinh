import { encode, getToken } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

const secret = "local-only-dependency-security-test-secret";
const cookieName = "authjs.session-token";

describe("authentication dependency security", () => {
  it.each(["%", "%E0%A4%A", "%ZZ"])(
    "rejects malformed Bearer token %s without throwing (GHSA-xmf8-cvqr-rfgj)",
    async (token) => {
      const request = new Request("http://localhost/api/auth/session", {
        headers: { authorization: `Bearer ${token}` },
      });

      await expect(getToken({ req: request, secret })).resolves.toBeNull();
    },
  );

  it("preserves encrypted JWT session claims", async () => {
    const token = await encode({
      secret,
      salt: cookieName,
      token: { sub: "local-user", id: "local-user", role: "ADMIN" },
    });
    const request = new Request("http://localhost/api/auth/session", {
      headers: { cookie: `${cookieName}=${token}` },
    });

    await expect(getToken({ req: request, secret })).resolves.toMatchObject({
      sub: "local-user",
      id: "local-user",
      role: "ADMIN",
    });
    await expect(
      getToken({ req: request, secret: "different-local-test-secret" }),
    ).resolves.toBeNull();
  });
});
