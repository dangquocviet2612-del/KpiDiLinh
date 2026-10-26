import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("Rate Limit Utility", () => {
  it("allows requests within threshold", () => {
    const key = `test-ip-${Date.now()}-1`;
    const limit = 5;
    const windowMs = 10_000;

    for (let i = 1; i <= limit; i++) {
      const res = checkRateLimit(key, limit, windowMs);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - i);
    }
  });

  it("blocks requests exceeding threshold", () => {
    const key = `test-ip-${Date.now()}-2`;
    const limit = 3;
    const windowMs = 10_000;

    for (let i = 0; i < limit; i++) {
      checkRateLimit(key, limit, windowMs);
    }

    const blocked = checkRateLimit(key, limit, windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
