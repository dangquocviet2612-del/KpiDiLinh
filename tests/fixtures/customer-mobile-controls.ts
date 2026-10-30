import type { ComponentProps } from "react";
import type CustomerTableRefined from "@/components/CustomerTableRefined";
import type { Customer } from "@/types";

export const syntheticCustomer: Customer = {
  id: "synthetic-customer-01", name: "Khách giả lập 01", account: `  SYNTHETIC_ACCOUNT_${"X".repeat(48)}  `,
  subscriberType: "FIXED", phone: "0000000000", package: "Gói giả lập", price: 100000,
  address: "Địa chỉ giả lập", nodeName: "SYNTHETIC_NODE_01", latitude: null, longitude: null,
  ctvCode: "SYNTHETIC_CTV", billingType: "MONTHLY", prepaidPeriod: null, renewalMonth: null,
  expirationDate: null, status: "Hoạt động", createdAt: "2026-10-29T00:00:00.000Z", updatedAt: "2026-10-29T00:00:00.000Z",
};
const noop = () => undefined;

export function customerControlsProps(userRole = "ADMIN"): ComponentProps<typeof CustomerTableRefined> {
  return {
    customers: [{ ...syntheticCustomer }], selectedIds: [], userRole, copiedAccount: null,
    onSelectIds: noop, onEdit: noop, onViewNode: noop, onDelete: noop, onCopyAccount: noop,
  };
}
