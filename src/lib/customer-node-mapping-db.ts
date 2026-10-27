import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function ensureCustomerNodeMappingTable() {
  await ensureRuntimeSchema("mapping");
}
