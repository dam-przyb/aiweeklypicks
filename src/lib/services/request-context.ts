import { createHash } from "node:crypto";

/**
 * Extracts client IP address from request headers
 * Checks common proxy/CDN headers in order of preference
 *
 * @param request - The incoming request object
 * @returns Client IP address or null if unavailable
 *
 * @example
 * ```ts
 * const clientIp = getClientIp(request);
 * if (clientIp) {
 *   const hash = hashIp(clientIp, salt);
 * }
 * ```
 */
export function getClientIp(request: Request): string | null {
  // Check common reverse proxy headers in order of preference
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // No IP found (e.g., local dev environment)
  return null;
}

/**
 * Computes a privacy-preserving SHA-256 hash of an IP address with a secret salt
 *
 * @param ip - Client IP address (or null for sentinel)
 * @param salt - Secret salt string from environment
 * @returns Hex-encoded hash string
 *
 * @remarks
 * - If IP is null or empty, hashes the sentinel value "unknown"
 * - Format: sha256(salt + "|" + ip) as hex
 * - The salt must be long, random, and kept secret
 *
 * @example
 * ```ts
 * const salt = import.meta.env.EVENT_IP_HASH_SALT;
 * const ipHash = hashIp("192.168.1.1", salt);
 * // Returns: "a1b2c3d4..." (64 hex chars)
 * ```
 */
export function hashIp(ip: string | null, salt: string): string {
  // Use sentinel for missing IP
  const effectiveIp = ip || "unknown";

  // Combine salt and IP with separator
  const input = `${salt}|${effectiveIp}`;

  // Compute SHA-256 hash and return as hex
  return createHash("sha256").update(input).digest("hex");
}
