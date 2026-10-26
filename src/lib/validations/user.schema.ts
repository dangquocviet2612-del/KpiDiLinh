import { z } from "zod";

export const userInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(50, "Tên đăng nhập không vượt quá 50 ký tự")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Tên đăng nhập chỉ chứa chữ cái, chữ số và dấu _, -, ."),

  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
    .max(100, "Mật khẩu quá dài"),

  role: z.enum(["ADMIN", "MANAGER", "CTV"]),

  managerCode: z.string().trim().max(50).optional().nullable(),
  secondaryCode: z.string().trim().max(50).optional().nullable(),
  canUseGps: z.boolean().default(false),
});

export const userUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(50, "Tên đăng nhập không vượt quá 50 ký tự")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Tên đăng nhập chỉ chứa chữ cái, chữ số và dấu _, -, .")
    .optional(),
  password: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val === null ? undefined : val),
      z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(100, "Mật khẩu quá dài").optional()
    ),
  role: z.enum(["ADMIN", "MANAGER", "CTV"]).optional(),
  managerCode: z.string().trim().max(50).optional().nullable(),
  secondaryCode: z.string().trim().max(50).optional().nullable(),
  canUseGps: z.boolean().optional(),
});

export type UserInput = z.infer<typeof userInputSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
