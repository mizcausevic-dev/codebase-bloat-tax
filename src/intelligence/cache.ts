import { LOOKUP_CACHE_TTL_MS } from '../models/constants';

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttl = LOOKUP_CACHE_TTL_MS): void {
  store.set(key, { value, expires: Date.now() + ttl });
}

export function cacheClear(): void {
  store.clear();
}
