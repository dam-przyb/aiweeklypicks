import { z } from 'zod';
import type { PicksListQuery } from '@/types';

// Enum definitions matching the allowed values
const sortValues = z.enum(['published_at', 'ticker', 'exchange', 'side', 'target_change_pct']);
const orderValues = z.enum(['asc', 'desc']);
const sideEnum = z.enum(['long', 'short']);

// ISO datetime validation (with or without offset)
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Zod schema for validating picks list query parameters.
 * Applies defaults, coercion, and cross-field validation.
 */
export const picksListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	page_size: z.coerce.number().int().min(1).max(100).default(20),
	sort: sortValues.default('published_at'),
	order: orderValues.default('desc'),
	ticker: z.string().min(1).optional(),
	exchange: z.string().min(1).optional(),
	side: sideEnum.optional(),
	date_before: isoDate.optional(),
	date_after: isoDate.optional(),
}).superRefine((val, ctx) => {
	// Cross-field validation: ensure date_after <= date_before
	if (val.date_before && val.date_after) {
		if (new Date(val.date_after) > new Date(val.date_before)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'date_after must be <= date_before',
				path: ['date_after']
			});
		}
	}
});

/**
 * Parses and validates query parameters from a URL for picks listing.
 * 
 * @param url - URL object containing query parameters
 * @returns Validated PicksListQuery object
 * @throws Error with code 'bad_request' if validation fails
 */
export function parsePicksListQuery(url: URL): PicksListQuery {
	const obj = Object.fromEntries(url.searchParams.entries());
	const parsed = picksListQuerySchema.safeParse(obj);
	
	if (!parsed.success) {
		const message = parsed.error.issues.map(i => i.message).join('; ');
		const error: any = new Error(message);
		error.code = 'bad_request';
		throw error;
	}
	
	return parsed.data;
}

