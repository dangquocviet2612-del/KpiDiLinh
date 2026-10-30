type CacheItem<T> = {
  expiresAt: number;
  value: T;
};

const MAX_CACHE_ENTRIES = 1000;
const store = new Map<string, CacheItem<unknown>>();
let cacheGeneration = Symbol("cache-generation");

export function getCacheGeneration(): symbol {
  return cacheGeneration;
}

export function getCache<T>(key: string): T | null {
  const item = store.get(key);
  if (!item) return null;
  if (Date.now() >= item.expiresAt) {
    store.delete(key);
    return null;
  }
  store.delete(key);
  store.set(key, item);
  return item.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number, generation?: symbol) {
  if (generation !== undefined && generation !== cacheGeneration) return;
  const now = Date.now();
  const expiresAt = now + ttlMs;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || !Number.isFinite(expiresAt)) {
    store.delete(key);
    return;
  }
  for (const [existingKey, item] of store) {
    if (now >= item.expiresAt) store.delete(existingKey);
  }
  store.delete(key);
  store.set(key, { value, expiresAt });
  while (store.size > MAX_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function clearCacheByPrefix(prefix: string) {
  cacheGeneration = Symbol("cache-generation");
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
