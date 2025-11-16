import { createHash } from "node:crypto";

/**
 * Compute a stable SHA-256 hex digest for arbitrary JSON-serializable input.
 */
export function hashJSON(value: unknown): string {
  const json = JSON.stringify(value);
  return createHash("sha256").update(json).digest("hex");
}
