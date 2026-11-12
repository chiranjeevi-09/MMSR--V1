/**
 * Client-side micro-cache for PUBLIC (unauthenticated) catalog GET endpoints.
 *
 * Why this exists (Phase 3 baseline evidence): several home-page components
 * (HomeHero, TrustStats, FeaturedBooksPreview, FeaturedJournalsPreview,
 * TestimonialsPreview, UniversityPartners) each issued their own fetch on
 * every mount, and none of the service functions deduplicated in-flight or
 * repeat requests. On first visit that produced ~7 duplicate API round-trips
 * per page load, re-issued on every client-side navigation back to the page.
 *
 * The API itself measured fast (20–240 ms); this removes the redundant
 * network fan-out, which is what users actually perceive as slow navigation.
 *
 * SAFETY RULES:
 *  - Only PUBLIC, response-identity-independent endpoints may use this.
 *    Anything that sends an Authorization header or varies per user MUST NOT
 *    be cached here (per-user responses must keep no-store semantics).
 *  - TTLs are short (30–60 s) so CMS edits surface quickly.
 *  - Admin mutations must call clearCache() for the affected prefix so the
 *    CMS preview flows never observe stale data.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

// Cross-tab invalidation listener: whenever an admin mutates content in any tab,
// clear the local memory cache immediately across all tabs.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'mmsr_cache_bust') {
      memory.clear();
    }
  });
}

export interface CachedGetOptions {
  /** How long the resolved value may be reused. Default: 2 s (dedup only). */
  ttlMs?: number;
  /**
   * When provided, the underlying fetch is given this `revalidate` window
   * (Next.js data cache) in addition to the in-memory TTL. Only meaningful
   * for server-side fetches; harmless on the client.
   */
  revalidate?: number;
}

/**
 * Deduplicated, TTL-bounded getter. Concurrent callers requesting the same
 * key share a single in-flight promise; late callers within the TTL receive
 * the cached value without any network activity.
 *
 * Rejected promises are NOT cached — the next caller retries.
 */
export async function cachedGet<T>(
  key: string,
  loader: (revalidate?: number) => Promise<T>,
  options: CachedGetOptions = {}
): Promise<T> {
  const { ttlMs = 2_000, revalidate } = options;

  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const value = await loader(revalidate);
      memory.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Invalidate cached entries. Pass a key prefix (e.g. 'pub:books') after a
 * mutation so subsequent reads refetch. Call with no argument to clear all.
 */
export function clearCache(prefix?: string): void {
  if (!prefix) {
    memory.clear();
  } else {
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) {
        memory.delete(key);
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('mmsr_cache_bust', String(Date.now()));
    } catch {
      // Ignore in restricted environments
    }
  }
}
