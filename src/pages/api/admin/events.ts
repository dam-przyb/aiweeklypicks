export const prerender = false;

import type { APIRoute } from 'astro';
import { parseAdminEventsQuery, ValidationError } from '../../../lib/validation/admin/events';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '../../../lib/services/authz';
import { limitPerKey, RateLimitError } from '../../../lib/services/rateLimit';
import { listAdminEvents, DatabaseError } from '../../../lib/services/admin/events';

/**
 * GET /api/admin/events
 *
 * Admin-only endpoint to query ingested events for operational analytics.
 * Supports pagination and filtering by event type, time range, report, and user.
 *
 * Authentication: Bearer token (admin required)
 * Rate Limit: 30 requests per minute per admin user
 * Cache: No caching (admin data)
 *
 * Query Parameters:
 * - page (number): Page number (default: 1, min: 1)
 * - page_size (number): Items per page (default: 20, min: 1, max: 100)
 * - event_type (string | string[]): Filter by event types (registration_complete, login, report_view, table_view)
 * - occurred_before (ISO datetime): Filter events before this time
 * - occurred_after (ISO datetime): Filter events after this time
 * - report_id (UUID): Filter by report
 * - user_id (UUID): Filter by user
 *
 * Response Codes:
 * - 200: Success with paginated events
 * - 400: Bad request (invalid parameters)
 * - 401: Unauthorized (missing/invalid token)
 * - 403: Forbidden (not admin)
 * - 429: Too many requests (rate limit exceeded)
 * - 500: Internal server error
 */
export const GET: APIRoute = async (context) => {
  const { request, locals } = context;
  const supabase = locals.supabase;
  const url = new URL(request.url);

  try {
    // Step 1: Parse and validate query parameters
    const query = parseAdminEventsQuery(url);

    // Step 2: Verify admin authentication
    // This will throw UnauthorizedError or ForbiddenError if not authorized
    await requireAdmin(supabase);

    // Step 3: Get authenticated user for rate limiting
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      throw new UnauthorizedError('Failed to verify user identity');
    }

    // Step 4: Apply rate limiting (30 requests per minute per admin)
    const rateLimitKey = `admin:events:${userRes.user.id}`;
    const isAllowed = limitPerKey({
      key: rateLimitKey,
      max: 30,
      windowMs: 60_000, // 1 minute
    });

    if (!isAllowed) {
      throw new RateLimitError('Rate limit exceeded. Maximum 30 requests per minute.');
    }

    // Step 5: Query events with filters
    const result = await listAdminEvents(supabase, query);

    // Step 6: Return successful response
    return jsonResponse(result, 200);
  } catch (err) {
    // Handle validation errors (bad request)
    if (err instanceof ValidationError) {
      return jsonResponse(
        {
          code: 'bad_request',
          message: err.message,
        },
        400
      );
    }

    // Handle authentication errors (unauthorized)
    if (err instanceof UnauthorizedError) {
      return jsonResponse(
        {
          code: 'unauthorized',
          message: err.message,
        },
        401
      );
    }

    // Handle authorization errors (forbidden)
    if (err instanceof ForbiddenError) {
      return jsonResponse(
        {
          code: 'forbidden',
          message: err.message,
        },
        403
      );
    }

    // Handle rate limit errors
    if (err instanceof RateLimitError) {
      return jsonResponse(
        {
          code: 'rate_limited',
          message: err.message,
        },
        429
      );
    }

    // Handle database errors
    if (err instanceof DatabaseError) {
      // Log database errors for debugging (in production, use proper logging service)
      console.error('Database error in GET /api/admin/events:', {
        message: err.message,
        cause: err.cause,
      });

      return jsonResponse(
        {
          code: 'server_error',
          message: 'Failed to retrieve events',
        },
        500
      );
    }

    // Handle any unexpected errors
    console.error('Unexpected error in GET /api/admin/events:', err);

    return jsonResponse(
      {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
      500
    );
  }
};

/**
 * Helper to create JSON responses with proper headers
 * Admin endpoints should never be cached
 */
function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store', // Admin endpoint - not cacheable
    },
  });
}

