export const prerender = false;

import type { APIRoute } from 'astro';
import { parsePicksListQuery } from '@/lib/validation/picks';
import { listPicks } from '@/lib/services/picks';

/**
 * GET /api/picks
 * 
 * Public endpoint that returns a paginated, sortable, and filterable list of stock picks.
 * Uses the picks_history materialized view when available, with automatic fallback to
 * joining stock_picks and weekly_reports tables.
 * 
 * Query Parameters:
 * - page (number, default 1): Page number for pagination
 * - page_size (number, default 20, max 100): Items per page
 * - sort (string, default 'published_at'): Sort column (published_at, ticker, exchange, side, target_change_pct)
 * - order (string, default 'desc'): Sort order (asc, desc)
 * - ticker (string): Filter by ticker (case-insensitive)
 * - exchange (string): Filter by exchange (case-insensitive)
 * - side (string): Filter by side (long, short)
 * - date_before (ISO datetime): Filter picks published before this date
 * - date_after (ISO datetime): Filter picks published after this date
 * 
 * Returns:
 * - 200 OK: Paginated list of picks with metadata
 * - 400 Bad Request: Invalid query parameters
 * - 500 Internal Server Error: Unexpected server/database error
 */
export const GET: APIRoute = async (context) => {
	const { request, locals } = context;
	const url = new URL(request.url);

	try {
		// Parse and validate query parameters
		const query = parsePicksListQuery(url);

		// Fetch picks from database with filters and pagination
		const result = await listPicks(locals.supabase, query);

		// Return successful response with caching headers for public content
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				// Cache for 60 seconds, allow stale content while revalidating
				'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
			},
		});
	} catch (err: any) {
		// Handle validation errors (400 Bad Request)
		if (err?.code === 'bad_request') {
			return new Response(
				JSON.stringify({
					code: 'bad_request',
					message: err.message || 'invalid query parameters'
				}),
				{
					status: 400,
					headers: { 'content-type': 'application/json' }
				}
			);
		}

		// Log unexpected errors for debugging
		console.error('[GET /api/picks] Unexpected error:', {
			message: err?.message,
			stack: err?.stack,
			query: url.search
		});

		// Handle unexpected errors (500 Internal Server Error)
		return new Response(
			JSON.stringify({
				code: 'server_error',
				message: 'unexpected error'
			}),
			{
				status: 500,
				headers: { 'content-type': 'application/json' }
			}
		);
	}
};

