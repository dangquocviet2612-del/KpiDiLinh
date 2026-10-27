import { clearCacheByPrefix } from "@/lib/kpi-cache";

export const CACHE_MUTATION_PREFIXES = {
  cuoc: ["cuoc:", "kpi:", "prepaid:"],
  nodes: ["node:", "nodes:", "map:", "customers:"],
  users: [""],
  restore: [""],
} as const;

export type CacheMutation = keyof typeof CACHE_MUTATION_PREFIXES;

export function invalidateCacheForMutation(mutation: CacheMutation) {
  for (const prefix of CACHE_MUTATION_PREFIXES[mutation]) clearCacheByPrefix(prefix);
}
