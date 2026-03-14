/**
 * Simple in-memory rate limiter for login attempts.
 * For production, replace with Redis-backed limiter (upstash/ratelimit).
 *
 * Tracks failed attempts per key (IP or email).
 * After maxAttempts failures within windowMs, blocks for blockMs.
 */

interface Bucket {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes block

const buckets = new Map<string, Bucket>();

/** Returns true if the key is allowed to proceed, false if rate-limited. */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (bucket?.blockedUntil) {
    if (now < bucket.blockedUntil) return false; // still blocked
    buckets.delete(key); // block expired
  }

  return true;
}

/** Record a failed login attempt for the given key. */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return;
  }

  bucket.count++;
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.blockedUntil = now + BLOCK_MS;
  }
}

/** Clear failure record on successful login. */
export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}

// Evict expired entries every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    const expired =
      (!bucket.blockedUntil && now - bucket.firstAttemptAt > WINDOW_MS) ||
      (bucket.blockedUntil && now > bucket.blockedUntil);
    if (expired) buckets.delete(key);
  }
}, 30 * 60 * 1000);
