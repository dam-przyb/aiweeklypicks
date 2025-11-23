import { z } from "zod";
import type { AdminImportsListQuery } from "../../types";

/**
 * Import status enum for validation
 */
const importStatusEnum = z.enum(["success", "failed"]);

/**
 * UUID validation helper
 */
const uuid = z.string().uuid();

/**
 * ISO datetime validation helper
 */
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Zod schema for validating admin imports query parameters
 */
export const adminImportsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    status: importStatusEnum.optional(),
    started_before: isoDate.optional(),
    started_after: isoDate.optional(),
    uploader: uuid.optional(),
  })
  .superRefine((val, ctx) => {
    // Validate date ordering: started_after must be <= started_before
    if (val.started_before && val.started_after) {
      if (new Date(val.started_after) > new Date(val.started_before)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "started_after must be <= started_before",
          path: ["started_after"],
        });
      }
    }
  });

/**
 * Error class for validation failures
 */
export class ValidationError extends Error {
  code = "bad_request" as const;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Parses and validates admin imports query parameters from URL
 *
 * @param url - Request URL with query parameters
 * @returns Validated query object
 * @throws {ValidationError} When validation fails
 *
 * @example
 * ```ts
 * const query = parseAdminImportsQuery(new URL(request.url));
 * // { page: 1, page_size: 20, status: 'success', ... }
 * ```
 */
export function parseAdminImportsQuery(url: URL): AdminImportsListQuery {
  const sp = url.searchParams;

  // Build object from search params
  const obj: Record<string, unknown> = {};
  for (const [key, value] of sp.entries()) {
    obj[key] = value;
  }

  // Validate with Zod schema
  const parsed = adminImportsQuerySchema.safeParse(obj);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    throw new ValidationError(message);
  }

  return parsed.data;
}
