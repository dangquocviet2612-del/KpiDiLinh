import { describe, it, expect } from "vitest";
import { customerInputSchema, customerUpdateSchema } from "@/lib/validations/customer.schema";
import { userInputSchema } from "@/lib/validations/user.schema";

describe("Customer Validation Schema", () => {
  it("passes for valid customer payload", () => {
    const valid = {
      name: "Nguyễn Văn A",
      account: "ACC001",
      phone: "0901234567",
      subscriberType: "FIXED",
      price: 220000,
      latitude: 10.7769,
      longitude: 106.7009,
      billingType: "PREPAID",
      prepaidPeriod: 6,
    };
    const result = customerInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("fails if customer name is missing or too short", () => {
    const invalid = {
      name: "A",
      account: "ACC002",
    };
    const result = customerInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("ít nhất 2 ký tự"))).toBe(true);
    }
  });

  it("fails if latitude or longitude is out of range", () => {
    const invalid = {
      name: "Khách Hàng B",
      account: "ACC003",
      latitude: 95.5, // > 90
      longitude: 106.7,
    };
    const result = customerInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("fails if price is negative", () => {
    const invalid = {
      name: "Khách Hàng C",
      account: "ACC004",
      price: -50000,
    };
    const result = customerInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("User Validation Schema", () => {
  it("passes for valid user creation payload", () => {
    const valid = {
      username: "ctv_linhpm",
      password: "securePassword123",
      role: "CTV",
      canUseGps: true,
    };
    const result = userInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("fails if password is shorter than 6 characters", () => {
    const invalid = {
      username: "user_short",
      password: "123",
      role: "CTV",
    };
    const result = userInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("fails if role is not one of ADMIN, MANAGER, CTV", () => {
    const invalid = {
      username: "user_invalid_role",
      password: "password123",
      role: "SUPERUSER",
    };
    const result = userInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
