import { prisma } from "@/lib/prisma";
import contracts from "./runtime-schema-contract.json";
import { createRuntimeSchemaGuard } from "./runtime-schema-check.mjs";

export type RuntimeSchemaDomain = keyof typeof contracts;

const guard = createRuntimeSchemaGuard((sql: string, parameters: unknown[]) =>
  prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...parameters));

export async function ensureRuntimeSchema(domain: RuntimeSchemaDomain, options: { requireDefaults?: boolean } = {}): Promise<void> {
  await guard(domain, options);
}
