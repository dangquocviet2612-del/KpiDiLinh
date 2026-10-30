import type { Customer } from "@/types";
import { customerControlsProps, syntheticCustomer } from "./customer-mobile-controls";

export const metadataVariants = ["complete", "price-only", "zero-price", "missing-ctv", "zero-price-no-ctv", "empty-metadata"] as const;
export type MetadataVariant = typeof metadataVariants[number];
const overrides: Record<MetadataVariant, Partial<Customer>> = {
  complete: {},
  "price-only": { package: null },
  "zero-price": { package: null, price: 0 },
  "missing-ctv": { ctvCode: null },
  "zero-price-no-ctv": { package: null, price: 0, ctvCode: null },
  "empty-metadata": { package: null, price: null, ctvCode: null },
};

export function customerMetadataProps(variant: MetadataVariant = "complete", userRole = "ADMIN") {
  return { ...customerControlsProps(userRole), customers: [{ ...syntheticCustomer, ...overrides[variant] }] };
}
