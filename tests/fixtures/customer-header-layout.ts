import { customerControlsProps, syntheticCustomer } from "./customer-mobile-controls";

export const headerVariants = ["normal", "long-name", "long-status", "status-hidden"] as const;
export type HeaderVariant = typeof headerVariants[number];
export const longCustomerName = `KHACH_HANG_GIA_LAP_${"N".repeat(96)}`;
export const longCustomerStatus = `TRANG_THAI_GIA_LAP_${"X".repeat(30)}`;

export function customerHeaderProps(variant: HeaderVariant = "normal", userRole = "ADMIN") {
  return {
    ...customerControlsProps(userRole),
    visibleColumns: { status: variant !== "status-hidden" },
    customers: [{ ...syntheticCustomer, name: variant === "long-name" || variant === "status-hidden" ? longCustomerName : syntheticCustomer.name, status: variant === "long-status" ? longCustomerStatus : syntheticCustomer.status }],
  };
}
