import { z } from 'zod';
import type { ReportsListQuery } from '@/types';

// Define allowed values for sort and order
const sortValues = z.enum(['published_at', 'report_week', 'title']);
const orderValues = z.enum(['asc', 'desc']);

// ISO week format: YYYY-Wnn (e.g., "2025-W42")
const isoWeek = z.string().regex(/^\d{4}-W\d{2}$/, 'Invalid ISO week format (expected YYYY-Wnn)');

// ISO datetime validation
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Zod schema for validating query parameters for GET /api/reports
 * 
 * Validates and coerces query parameters with defaults:
 * - page: 1 (min 1)
 * - page_size: 20 (min 1, max 100)
 * - sort: 'published_at'
 * - order: 'desc'
 * 
 * Also validates:
 * - week format (YYYY-Wnn)
 * - published_before/after as ISO datetimes
 * - Ensures published_after <= published_before when both provided
 */
export const reportsListQuerySchema = z.object({
	page: z.coerce.number().int().min(1, 'Page must be >= 1').default(1),
	page_size: z.coerce.number().int().min(1, 'Page size must be >= 1').max(100, 'Page size must be <= 100').default(20),
	sort: sortValues.default('published_at'),
	order: orderValues.default('desc'),
	week: isoWeek.optional(),
	version: z.string().min(1, 'Version must not be empty').optional(),
	published_before: isoDate.optional(),
	published_after: isoDate.optional(),
}).superRefine((val, ctx) => {
	// Validate date ordering when both dates are provided
	if (val.published_before && val.published_after) {
		const before = new Date(val.published_before);
		const after = new Date(val.published_after);
		
		if (after > before) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'published_after must be <= published_before',
				path: ['published_after'],
			});
		}
	}
});

/**
 * Parses and validates query parameters from a URL for the reports list endpoint.
 * 
 * @param url - The URL object containing query parameters
 * @returns Validated ReportsListQuery object with defaults applied
 * @throws Error with code 'bad_request' if validation fails
 */
export function parseReportsListQuery(url: URL): ReportsListQuery {
	// Convert URLSearchParams to plain object
	const obj = Object.fromEntries(url.searchParams.entries());
	
	// Validate using Zod schema
	const parsed = reportsListQuerySchema.safeParse(obj);
	
	if (!parsed.success) {
		// Collect all validation error messages
		const message = parsed.error.issues.map(i => i.message).join('; ');
		
		// Create error with custom code for error handling in route
		const error: any = new Error(message);
		error.code = 'bad_request';
		throw error;
	}
	
	return parsed.data;
}

