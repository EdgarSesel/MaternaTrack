/**
 * Cache utility wrapping Next.js unstable_cache with typed helpers.
 *
 * Usage:
 *   const result = await cachedQuery(() => db.patient.count(...), ["key"], 60);
 *
 * The third argument is TTL in seconds.
 */

import { unstable_cache } from "next/cache";

/**
 * Wrap an async factory in Next.js data cache with a TTL.
 * @param fn      Factory function that returns the data
 * @param keys    Cache key segments (must uniquely identify the query + params)
 * @param ttl     Time-to-live in seconds
 * @param tags    Optional cache tags for targeted revalidation
 */
export function cachedQuery<T>(
  fn: () => Promise<T>,
  keys: string[],
  ttl: number,
  tags?: string[],
): Promise<T> {
  return unstable_cache(fn, keys, {
    revalidate: ttl,
    tags,
  })();
}
