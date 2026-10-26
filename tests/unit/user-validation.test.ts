import { describe, it, expect } from "vitest";
import { userUpdateSchema, userInputSchema } from "@/lib/validations/user.schema";

describe("User Zod Schema Validation", () => {
  describe("userUpdateSchema", () => {
    it("coerces empty password string '' to undefined without 422 error", () => {
      const result = userUpdateSchema.safeParse({
        password: "",
        role: "CTV",
        canUseGps: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBeUndefined();
        expect(result.data.role).toBe("CTV");
        expect(result.data.canUseGps).toBe(false);
      }
    });

    it("coerces null password to undefined", () => {
      const result = userUpdateSchema.safeParse({
        password: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBeUndefined();
      }
    });

    it("accepts a new valid password of 6+ characters", () => {
      const result = userUpdateSchema.safeParse({
        password: "newSecurePassword123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe("newSecurePassword123");
      }
    });

    it("rejects password shorter than 6 characters if provided", () => {
      const result = userUpdateSchema.safeParse({
        password: "12345",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Mật khẩu phải có ít nhất 6 ký tự");
      }
    });

    it("validates and trims valid username", () => {
      const result = userUpdateSchema.safeParse({
        username: "  ctv_john.doe-99  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("ctv_john.doe-99");
      }
    });

    it("rejects username with invalid characters or whitespace inside", () => {
      const result = userUpdateSchema.safeParse({
        username: "user name with spaces",
      });

      expect(result.success).toBe(false);
    });

    it("rejects username shorter than 3 characters", () => {
      const result = userUpdateSchema.safeParse({
        username: "ab",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("userInputSchema", () => {
    it("requires password on user creation", () => {
      const result = userInputSchema.safeParse({
        username: "new_ctv",
        password: "",
        role: "CTV",
      });

      expect(result.success).toBe(false);
    });

    it("successfully parses complete valid user input", () => {
      const result = userInputSchema.safeParse({
        username: "new_ctv",
        password: "securePassword123",
        role: "CTV",
        managerCode: "MGR01",
        canUseGps: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("new_ctv");
        expect(result.data.canUseGps).toBe(true);
      }
    });
  });
});
