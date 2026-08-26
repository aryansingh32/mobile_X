// Lightweight stale-while-revalidate cache for GET-style fetches.
// Lets a screen show cached data instantly on remount (e.g. switching tabs)
// instead of re-paying a full network round trip + shimmer every time,
// while still refreshing in the background so data doesn't go stale.

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

interface FetchCachedOptions<T> {
  /** How long cached data is considered fresh enough to skip a refetch entirely. */
  ttlMs?: number;
  /** How long stale data is still safe to *show* while a fresh copy loads in the background. */
  staleMs?: number;
  onStaleData?: (data: T) => void;
}

/**
 * Returns cached data immediately if present (even if stale), and kicks off
 * a revalidation fetch when the cache is missing, expired, or stale.
 * Concurrent calls with the same key share one in-flight request.
 */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: FetchCachedOptions<T> = {}
): Promise<T> {
  const { ttlMs = 15_000, staleMs = 5 * 60_000, onStaleData } = options;
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const age = entry ? Date.now() - entry.fetchedAt : Infinity;

  if (entry && age < ttlMs) {
    return entry.data;
  }

  if (entry && age < staleMs) {
    onStaleData?.(entry.data);
    // Refresh in the background; caller already has usable data.
    void revalidate(key, fetcher);
    return entry.data;
  }

  return revalidate(key, fetcher);
}

function revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCached(key: string): void {
  cache.delete(key);
}

export function invalidateCachedPrefix(prefix: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

export function peekCached<T>(key: string): T | undefined {
  return (cache.get(key) as CacheEntry<T> | undefined)?.data;
}
