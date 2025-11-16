export const prerender = false;

import type { APIRoute } from 'astro';
import { parseReportsListQuery } from '@/lib/validation/reports';
import { listReports } from '@/lib/services/reports';

/**
 * GET /api/reports
 * 
 * Public endpoint that lists weekly reports with pagination, sorting, and filtering.
 * Results are ordered by published_at (default desc) and shaped to minimal fields needed by the UI.
 * 
 * Anonymous access is allowed under RLS; bearer tokens are accepted but not required.
 * 
 * Query Parameters (all optional):
 * - page (number; default 1; min 1)
 * - page_size (number; default 20; min 1; max 100)
 * - sort (enum: published_at, report_week, title; default published_at)
 * - order (enum: asc, desc; default desc)
 * - week (ISO week string; e.g., "2025-W42")
 * - version (string)
 * - published_before (ISO datetime)
 * - published_after (ISO datetime)
 * 
 * Responses:
 * - 200: Success with ReportsListResponseDTO
 * - 400: Bad Request (invalid query parameters)
 * - 500: Internal Server Error
 * 
 * Caching:
 * - Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120
 */
export const GET: APIRoute = async (context) => {
	const { request, locals } = context;
	const url = new URL(request.url);

	try {
		// Parse and validate query parameters
		const query = parseReportsListQuery(url);

		// Fetch reports from database via service
		const result = await listReports(locals.supabase, query);

		// Return successful response with caching headers
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
			},
		});
	} catch (err: any) {
		// Handle validation errors (400 Bad Request)
		if (err?.code === 'bad_request') {
			return new Response(
				JSON.stringify({
					code: 'bad_request',
					message: err.message,
				}),
				{
					status: 400,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		// Log unexpected errors for debugging
		console.error('[GET /api/reports] Unexpected error:', {
			route: '/api/reports',
			query: Object.fromEntries(url.searchParams.entries()),
			error: err,
		});

		// Handle all other errors (500 Internal Server Error)
		return new Response(
			JSON.stringify({
				code: 'server_error',
				message: 'An unexpected error occurred',
			}),
			{
				status: 500,
				headers: { 'content-type': 'application/json; charset=utf-8' },
			}
		);
	}
};

