import { describe, it, expect } from "vitest";
import { customerInputSchema } from "@/lib/validations/customer.schema";

describe("CustomerModalRefined Payload Regression Test", () => {
  it("successfully parses real-world modal payload with empty strings and numeric strings", () => {
    // Exact shape emitted by CustomerModalRefined.tsx handleSubmit
    const modalPayload = {
      name: "Nguyễn Văn Test",
      account: "", // Optional account left empty
      subscriberType: "FIXED",
      phone: "0981234567",
      package: "HOME 1",
      price: "", // Empty price string
      address: "123 Đường Số 1, Phường 2",
      nodeName: "",
      latitude: "", // Empty coordinate string
      longitude: "",
      ctvCode: "CTV_HUE",
      billingType: "",
      prepaidPeriod: "", // Empty prepaid period
      renewalMonth: "",
      expirationDate: "",
      status: "Hoạt động",
    };

    const result = customerInputSchema.safeParse(modalPayload);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.account).toBeNull();
      expect(result.data.price).toBeNull();
      expect(result.data.latitude).toBeNull();
      expect(result.data.longitude).toBeNull();
      expect(result.data.prepaidPeriod).toBeNull();
      expect(result.data.billingType).toBeNull();
      expect(result.data.subscriberType).toBe("FIXED");
      expect(result.data.status).toBe("Hoạt động");
    }
  });

  it("successfully coerces numeric string inputs into actual numbers", () => {
    const filledModalPayload = {
      name: "Trần Thị Khách Hàng",
      account: "ACC_HUE_001",
      subscriberType: "FIXED",
      phone: "0909998888",
      package: "NET 2 PLUS",
      price: "240000",
      address: "456 Đường Lê Lợi",
      nodeName: "LDG-DN02",
      latitude: "10.776889",
      longitude: "106.700891",
      ctvCode: "CTV_HUE",
      billingType: "PREPAID",
      prepaidPeriod: "6",
      renewalMonth: "2026-05-01",
      expirationDate: "2026-11-01",
      status: "Hoạt động",
    };

    const result = customerInputSchema.safeParse(filledModalPayload);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.price).toBe(240000);
      expect(result.data.latitude).toBe(10.776889);
      expect(result.data.longitude).toBe(106.700891);
      expect(result.data.prepaidPeriod).toBe(6);
      expect(result.data.account).toBe("ACC_HUE_001");
      expect(result.data.billingType).toBe("PREPAID");
    }
  });

  it("rejects non-numeric string values for price", () => {
    const invalidPayload = {
      name: "Lê Văn Lỗi",
      price: "khong_phai_so",
    };

    const result = customerInputSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
