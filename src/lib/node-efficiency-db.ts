import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function ensureNodeEfficiencyColumns() {
  await ensureRuntimeSchema("node");
}
