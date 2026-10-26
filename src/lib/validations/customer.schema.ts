import { z } from "zod";

function coerceNumberOrNull(val: unknown): unknown {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "string") {
    const trimmed = val.trim().replace(",", ".");
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isNaN(num) ? val : num;
  }
  return val;
}

function coerceStringOrNull(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  }
  return val;
}

export const customerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên khách hàng phải có ít nhất 2 ký tự")
    .max(120, "Tên khách hàng không được vượt quá 120 ký tự"),

  account: z.preprocess(
    coerceStringOrNull,
    z.string().max(60, "Mã account không được vượt quá 60 ký tự").optional().nullable()
  ),

  nodeName: z.preprocess(
    coerceStringOrNull,
    z.string().max(60).optional().nullable()
  ),

  subscriberType: z.preprocess(
    (val) => (val === "" || val == null ? "FIXED" : val),
    z.enum(["FIXED", "MOBILE"]).default("FIXED")
  ),

  phone: z.preprocess(
    coerceStringOrNull,
    z
      .string()
      .max(20, "Số điện thoại không được vượt quá 20 ký tự")
      .regex(/^[0-9+\s.-]*$/, "Số điện thoại chỉ được chứa chữ số và dấu cách")
      .optional()
      .nullable()
  ),

  package: z.preprocess(
    coerceStringOrNull,
    z.string().max(100).optional().nullable()
  ),

  price: z.preprocess(
    coerceNumberOrNull,
    z
      .number()
      .min(0, "Giá cước không được là số âm")
      .max(1_000_000_000, "Giá cước vượt quá giới hạn cho phép")
      .optional()
      .nullable()
  ),

  status: z.preprocess(
    (val) => (val === "" || val == null ? "Hoạt động" : val),
    z.string().max(50).default("Hoạt động")
  ),

  address: z.preprocess(
    coerceStringOrNull,
    z.string().max(300, "Địa chỉ không vượt quá 300 ký tự").optional().nullable()
  ),

  latitude: z.preprocess(
    coerceNumberOrNull,
    z
      .number()
      .min(-90, "Vĩ độ hợp lệ từ -90 đến 90")
      .max(90, "Vĩ độ hợp lệ từ -90 đến 90")
      .optional()
      .nullable()
  ),

  longitude: z.preprocess(
    coerceNumberOrNull,
    z
      .number()
      .min(-180, "Kinh độ hợp lệ từ -180 đến 180")
      .max(180, "Kinh độ hợp lệ từ -180 đến 180")
      .optional()
      .nullable()
  ),

  ctvCode: z.preprocess(
    coerceStringOrNull,
    z.string().max(50).optional().nullable()
  ),

  billingType: z.preprocess(
    coerceStringOrNull,
    z.enum(["PREPAID", "MONTHLY"]).optional().nullable()
  ),

  prepaidPeriod: z.preprocess(
    coerceNumberOrNull,
    z
      .number()
      .int("Kỳ đóng trước phải là số nguyên")
      .min(0, "Kỳ đóng trước không được âm")
      .max(120, "Kỳ đóng trước không vượt quá 120 tháng")
      .optional()
      .nullable()
  ),

  renewalMonth: z.preprocess(
    (val) => (val === "" ? null : val),
    z.union([z.string(), z.date()]).optional().nullable()
  ),

  expirationDate: z.preprocess(
    (val) => (val === "" ? null : val),
    z.union([z.string(), z.date()]).optional().nullable()
  ),
});

export const customerUpdateSchema = customerInputSchema.partial().extend({
  id: z.string().optional(),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;
