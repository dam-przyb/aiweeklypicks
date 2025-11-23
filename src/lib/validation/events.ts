import { z } from "zod";
import type { PostEventCommand, PublicEventType } from "@/types";

/**
 * Zod schema for validating POST /api/events request body
 *
 * Validates:
 * - event_type: Must be one of the allowed PublicEventType values
 * - dwell_seconds: Optional number >= 0, but required and >= 10 for "report_view"
 * - report_id: Optional UUID string
 * - metadata: Optional JSON value with size limit
 */
export const postEventSchema = z
  .object({
    event_type: z.enum(["registration_complete", "login", "report_view", "table_view"], {
      errorMap: () => ({
        message: "event_type must be one of: registration_complete, login, report_view, table_view",
      }),
    }),
    dwell_seconds: z.number().nonnegative("dwell_seconds must be >= 0").optional(),
    report_id: z.string().uuid("report_id must be a valid UUID").optional(),
    metadata: z
      .any()
      .optional()
      .refine(
        (val) => {
          if (val === undefined) return true;
          // Soft size limit check: ~64KB when stringified
          const json = JSON.stringify(val);
          return json.length <= 65536;
        },
        { message: "metadata must not exceed 64KB when serialized" }
      ),
  })
  .strict() // Reject extra fields
  .superRefine((val, ctx) => {
    // Domain rule: report_view requires dwell_seconds >= 10
    if (val.event_type === "report_view") {
      if (val.dwell_seconds === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dwell_seconds"],
          message: "dwell_seconds is required for report_view events",
          // Tag this as a domain error for 422 mapping
          params: { domain: true },
        });
      } else if (val.dwell_seconds < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dwell_seconds"],
          message: "dwell_seconds must be at least 10 for report_view events",
          // Tag this as a domain error for 422 mapping
          params: { domain: true },
        });
      }
    }
  });

/**
 * Type guard to check if a Zod error contains domain-level validation issues
 * Domain errors should be mapped to 422 Unprocessable Entity
 */
export function isDomainValidationError(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.params?.domain === true);
}

/**
 * Parses and validates the request body for POST /api/events
 *
 * @param body - The parsed JSON body from the request
 * @returns Validated PostEventCommand object
 * @throws Error with code 'bad_request' or 'unprocessable_entity' if validation fails
 */
export function parsePostEventCommand(body: unknown): PostEventCommand {
  const parsed = postEventSchema.safeParse(body);

  if (!parsed.success) {
    // Collect all validation error messages
    const message = parsed.error.issues.map((i) => i.message).join("; ");

    // Determine if this is a domain-level error (422) or structural error (400)
    const isDomain = isDomainValidationError(parsed.error);

    // Create error with custom code for error handling in route
    const error: any = new Error(message);
    error.code = isDomain ? "unprocessable_entity" : "bad_request";
    error.details = parsed.error.issues;
    throw error;
  }

  return parsed.data;
}
