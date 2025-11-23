import { z } from "zod";
import type { AdminEventsListQuery } from "../../types";

/**
 * Allowed event types for filtering
 */
const eventTypeEnum = z.enum(["registration_complete", "login", "report_view", "table_view"]);

/**
 * UUID validation helper
 */
const uuid = z.string().uuid();

/**
 * ISO datetime validation helper
 */
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Zod schema for validating admin events query parameters
 */
export const adminEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    event_type: z.union([eventTypeEnum, z.array(eventTypeEnum)]).optional(),
    occurred_before: isoDate.optional(),
    occurred_after: isoDate.optional(),
    report_id: uuid.optional(),
    user_id: uuid.optional(),
  })
  .superRefine((val, ctx) => {
    // Validate date ordering: occurred_after must be <= occurred_before
    if (val.occurred_before && val.occurred_after) {
      if (new Date(val.occurred_after) > new Date(val.occurred_before)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "occurred_after must be <= occurred_before",
          path: ["occurred_after"],
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
 * Parses and validates admin events query parameters from URL
 * Handles both repeated query params (?event_type=a&event_type=b) and
 * comma-separated values (?event_type=a,b)
 *
 * @param url - Request URL with query parameters
 * @returns Validated query object with normalized event_type as array
 * @throws {ValidationError} When validation fails
 */
export function parseAdminEventsQuery(url: URL): AdminEventsListQuery & { event_type?: string[] } {
  const sp = url.searchParams;

  // Handle event_type as repeated params or comma-separated
  const repeated = sp.getAll("event_type");
  const splitComma = repeated
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  // Build object from search params
  const obj: Record<string, unknown> = {};
  for (const [key, value] of sp.entries()) {
    if (key !== "event_type") {
      obj[key] = value;
    }
  }

  // Add normalized event_type array if present
  if (splitComma.length > 0) {
    // Deduplicate event types
    obj.event_type = [...new Set(splitComma)];
  }

  // Validate with Zod schema
  const parsed = adminEventsQuerySchema.safeParse(obj);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    throw new ValidationError(message);
  }

  const data = parsed.data as any;

  // Normalize single string to array for consistent handling
  if (typeof data.event_type === "string") {
    data.event_type = [data.event_type];
  }

  return data;
}
