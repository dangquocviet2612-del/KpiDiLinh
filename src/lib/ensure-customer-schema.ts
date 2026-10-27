import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function ensureCustomerSchema(): Promise<void> {
    await ensureRuntimeSchema("customer");
}
