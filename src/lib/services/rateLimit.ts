/**
 * In-memory rate limiting service
 * Tracks request counts per key within sliding time windows
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limit entries
const store = new Map<string, RateLimitEntry>();

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends Error {
  code = "rate_limited" as const;

  constructor(message = "Too many requests") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Checks and enforces rate limit for a given key
 * Uses a fixed window rate limiting strategy
 *
 * @param options - Rate limiting configuration
 * @param options.key - Unique identifier for the rate limit (e.g., "admin:<user_id>")
 * @param options.max - Maximum number of requests allowed in the window
 * @param options.windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 *
 * @example
 * ```ts
 * // Allow 30 requests per minute per admin user
 * if (!limitPerKey({
 *   key: `admin:${userId}`,
 *   max: 30,
 *   windowMs: 60_000
 * })) {
 *   throw new RateLimitError();
 * }
 * ```
 */
export function limitPerKey(options: { key: string; max: number; windowMs: number }): boolean {
  const { key, max, windowMs } = options;
  const now = Date.now();

  // Get or create entry
  let entry = store.get(key);

  // If no entry or window expired, create new entry
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return true;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > max) {
    return false;
  }

  return true;
}

/**
 * Clears all rate limit entries
 * Useful for testing or manual reset
 */
export function clearRateLimits(): void {
  store.clear();
}

/**
 * Clears rate limit entry for a specific key
 * @param key - The key to clear
 */
export function clearRateLimitForKey(key: string): void {
  store.delete(key);
}

/**
 * Periodically cleans up expired entries from the store
 * Call this on a timer to prevent memory leaks
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
