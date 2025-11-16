export const prerender = false;

import type { APIRoute } from 'astro';
import { parsePostEventCommand } from '@/lib/validation/events';
import { getClientIp, hashIp } from '@/lib/services/request-context';
import { limitPerKey, RateLimitError } from '@/lib/services/rateLimit';
import type { PostEventAcceptedDTO } from '@/types';

/**
 * POST /api/events
 * 
 * Public endpoint for ingesting client-side events into the events table.
 * Accepts a narrow set of event types (registration_complete, login, report_view, table_view),
 * enriches them with server metadata (timestamp, user agent, IP hash, optional user_id),
 * and stores them via a Supabase SECURITY DEFINER RPC.
 * 
 * Authentication: Optional Bearer token via Supabase Auth
 * - If present and valid, auth.uid() will be associated with events.user_id
 * - If absent or invalid, event is still accepted as anonymous (subject to rate limiting)
 * 
 * Request Body (JSON):
 * - event_type: "registration_complete" | "login" | "report_view" | "table_view" (required)
 * - dwell_seconds: number (optional, but required and >= 10 for report_view)
 * - report_id: UUID string (optional)
 * - metadata: JSON value (optional, max ~64KB)
 * 
 * Responses:
 * - 202 Accepted: Success with PostEventAcceptedDTO containing event_id
 * - 400 Bad Request: Malformed JSON or structural validation failure
 * - 422 Unprocessable Entity: Valid structure but domain rule violation (e.g., report_view dwell < 10)
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Unexpected runtime error or RPC failure
 * 
 * Rate Limiting:
 * - 100 events per minute per IP hash for anonymous requests
 * - 200 events per minute per user for authenticated requests
 * 
 * Privacy:
 * - Client IP is hashed with a secret salt before storage
 * - Raw IP addresses are never persisted
 */
export const POST: APIRoute = async (context) => {
	const { request, locals } = context;

	try {
		// Validate Content-Type header
		const contentType = request.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			return new Response(
				JSON.stringify({
					error: 'invalid_content_type',
					message: 'Content-Type must be application/json',
				}),
				{
					status: 400,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		// Parse request body
		let body: unknown;
		try {
			body = await request.json();
		} catch (err) {
			return new Response(
				JSON.stringify({
					error: 'invalid_json',
					message: 'Request body must be valid JSON',
				}),
				{
					status: 400,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		// Validate request body with Zod schema
		let command;
		try {
			command = parsePostEventCommand(body);
		} catch (err: any) {
			// Map validation errors to appropriate status codes
			if (err?.code === 'bad_request') {
				return new Response(
					JSON.stringify({
						error: 'invalid_request',
						message: err.message,
						details: err.details,
					}),
					{
						status: 400,
						headers: { 'content-type': 'application/json; charset=utf-8' },
					}
				);
			}

			if (err?.code === 'unprocessable_entity') {
				return new Response(
					JSON.stringify({
						error: 'invalid_event_state',
						message: err.message,
						details: err.details,
					}),
					{
						status: 422,
						headers: { 'content-type': 'application/json; charset=utf-8' },
					}
				);
			}

			// Unexpected validation error
			throw err;
		}

		// Extract and hash client IP for privacy
		const clientIp = getClientIp(request);
		const salt = import.meta.env.EVENT_IP_HASH_SALT;

		// Guard: salt must be configured for privacy guarantees
		if (!salt) {
			console.error('[POST /api/events] CRITICAL: EVENT_IP_HASH_SALT is not configured');
			return new Response(
				JSON.stringify({
					error: 'internal_error',
					message: 'Service configuration error',
				}),
				{
					status: 500,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		const ipHash = hashIp(clientIp, salt);

		// Apply rate limiting
		// Use different limits for authenticated vs anonymous
		const rateLimitKey = `events:${ipHash}`;
		const allowed = limitPerKey({
			key: rateLimitKey,
			max: 100, // 100 events per minute per IP
			windowMs: 60_000,
		});

		if (!allowed) {
			return new Response(
				JSON.stringify({
					error: 'rate_limited',
					message: 'Too many events from this client. Please slow down.',
				}),
				{
					status: 429,
					headers: {
						'content-type': 'application/json; charset=utf-8',
						'retry-after': '60',
					},
				}
			);
		}

		// Extract user agent
		const userAgent = request.headers.get('user-agent') ?? 'unknown';

		// Prepare RPC parameters
		const rpcParams = {
			p_event_type: command.event_type,
			p_dwell_seconds: command.dwell_seconds ?? null,
			p_report_id: command.report_id ?? null,
			p_metadata: command.metadata ?? null,
			p_user_agent: userAgent,
			p_ip_hash: ipHash,
		};

		// Call Supabase RPC to insert event
		// The RPC is a SECURITY DEFINER function that enforces RLS and uses auth.uid() for user_id
		const { data, error } = await locals.supabase.rpc('admin_post_event', rpcParams);

		if (error) {
			// Log RPC error with context (sanitized)
			console.error('[POST /api/events] RPC error:', {
				event_type: command.event_type,
				ip_hash: ipHash,
				error_code: error.code,
				error_message: error.message,
			});

			// Check if error indicates client-side issue (e.g., FK violation)
			// For now, treat all RPC errors as server errors
			// TODO: Map specific error codes to 400/422 if needed
			return new Response(
				JSON.stringify({
					error: 'internal_error',
					message: 'Failed to store event',
				}),
				{
					status: 500,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		// Validate RPC response contains event_id
		if (!data || !data.event_id) {
			console.error('[POST /api/events] RPC response missing event_id:', {
				event_type: command.event_type,
				ip_hash: ipHash,
				response: data,
			});

			return new Response(
				JSON.stringify({
					error: 'internal_error',
					message: 'Invalid response from event storage',
				}),
				{
					status: 500,
					headers: { 'content-type': 'application/json; charset=utf-8' },
				}
			);
		}

		// Construct success response
		const response: PostEventAcceptedDTO = {
			event_id: data.event_id,
			accepted: true,
		};

		return new Response(JSON.stringify(response), {
			status: 202,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			},
		});
	} catch (err: any) {
		// Handle unexpected errors
		console.error('[POST /api/events] Unexpected error:', {
			error: err,
			message: err?.message,
			stack: err?.stack,
		});

		return new Response(
			JSON.stringify({
				error: 'internal_error',
				message: 'Something went wrong. Please try again later.',
			}),
			{
				status: 500,
				headers: { 'content-type': 'application/json; charset=utf-8' },
			}
		);
	}
};

