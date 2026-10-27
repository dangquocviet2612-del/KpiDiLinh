import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function ensureOfficialDocTables() {
  await ensureRuntimeSchema("documents");
}
