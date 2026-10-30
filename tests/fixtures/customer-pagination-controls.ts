import type { ComponentProps } from "react";
import type PaginationControls from "@/components/PaginationControls";

export const paginationVariants = ["first", "middle", "last", "single", "large-counts"] as const;
export type PaginationVariant = typeof paginationVariants[number];
type PageValues = Pick<ComponentProps<typeof PaginationControls>, "page" | "totalPages" | "total" | "limit">;
const values: Record<PaginationVariant, PageValues> = {
  first: { page: 1, totalPages: 5, total: 95, limit: 20 },
  middle: { page: 3, totalPages: 5, total: 95, limit: 20 },
  last: { page: 5, totalPages: 5, total: 95, limit: 20 },
  single: { page: 1, totalPages: 1, total: 7, limit: 10 },
  "large-counts": { page: 999998, totalPages: 999999, total: 99999900, limit: 100 },
};
const noop = () => undefined;
export function customerPaginationProps(variant: PaginationVariant = "middle"): ComponentProps<typeof PaginationControls> {
  return { ...values[variant], onPageChange: noop, onLimitChange: noop };
}
