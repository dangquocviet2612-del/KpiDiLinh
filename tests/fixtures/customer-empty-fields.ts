import { customerControlsProps, syntheticCustomer } from "./customer-mobile-controls";

export const customerFieldVariants = ["complete", "missing-phone", "missing-account", "missing-both"] as const;
export type CustomerFieldVariant = typeof customerFieldVariants[number];

export function customerEmptyFieldsProps(variant: CustomerFieldVariant = "complete", userRole = "ADMIN") {
  return {
    ...customerControlsProps(userRole),
    customers: [{
      ...syntheticCustomer,
      phone: variant === "missing-phone" || variant === "missing-both" ? null : syntheticCustomer.phone,
      account: variant === "missing-account" || variant === "missing-both" ? null : syntheticCustomer.account,
    }],
  };
}
