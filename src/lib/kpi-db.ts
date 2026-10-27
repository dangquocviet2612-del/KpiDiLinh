import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function ensureKpiTables(): Promise<void> {
  await ensureRuntimeSchema("kpi");
}
