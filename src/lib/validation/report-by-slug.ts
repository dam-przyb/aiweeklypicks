import { z } from "zod";
import type { ReportSlugParams } from "@/types";

// Validation schema for report slug path params
export const reportSlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

/**
 * Parses and validates the slug path param for GET /api/reports/{slug}
 * Throws an error with code 'bad_request' when invalid.
 */
export function parseReportSlug(params: ReportSlugParams): string {
  const parsed = reportSlugSchema.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    const error: any = new Error(message || "invalid slug");
    error.code = "bad_request";
    throw error;
  }
  return parsed.data.slug;
}
