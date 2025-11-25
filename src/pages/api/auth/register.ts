export const prerender = false;

import type { APIRoute } from "astro";
import { parseRegisterCommand } from "@/lib/validation/auth";
import { registerUser, AuthError } from "@/lib/services/auth";
import { limitPerKey } from "@/lib/services/rateLimit";
import { getClientIp, hashIp } from "@/lib/services/request-context";
import type { RegisterResponseDTO } from "@/types";

/**
 * POST /api/auth/register
 *
 * Public endpoint for user registration via email/password.
 * Creates a new user account via Supabase Auth and sends a verification email.
 * On success, emits a `registration_complete` event for analytics.
 *
 * Authentication: None (public endpoint)
 *
 * Request Body (JSON):
 * - email: string (valid email address)
 * - password: string (min 8 chars, uppercase, lowercase, number)
 *
 * Responses:
 * - 201 Created: Success with RegisterResponseDTO containing user_id
 * - 400 Bad Request: Malformed JSON or validation failure
 * - 409 Conflict: Email already registered
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Unexpected runtime error
 *
 * Rate Limiting:
 * - 5 registration attempts per minute per IP address
 *
 * Side Effects:
 * - Sends verification email via Supabase Auth
 * - Emits `registration_complete` event via /api/events
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;

  try {
    // Apply rate limiting (5 attempts per minute per IP)
    const clientIp = getClientIp(request);
    const salt = import.meta.env.EVENT_IP_HASH_SALT;

    if (!salt) {
      console.error("[POST /api/auth/register] CRITICAL: EVENT_IP_HASH_SALT is not configured");
      return new Response(
        JSON.stringify({
          code: "internal_error",
          message: "Service configuration error",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    }

    const ipHash = hashIp(clientIp, salt);
    const rateLimitKey = `auth:register:${ipHash}`;
    const allowed = limitPerKey({
      key: rateLimitKey,
      max: 5,
      windowMs: 60_000,
    });

    if (!allowed) {
      return new Response(
        JSON.stringify({
          code: "rate_limited",
          message: "Too many registration attempts. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "retry-after": "60",
          },
        }
      );
    }

    // Validate Content-Type header
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({
          code: "invalid_content_type",
          message: "Content-Type must be application/json",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
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
          code: "invalid_json",
          message: "Request body must be valid JSON",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    }

    // Validate request body with Zod schema
    let command;
    try {
      command = parseRegisterCommand(body);
    } catch (err: any) {
      if (err?.code === "bad_request") {
        return new Response(
          JSON.stringify({
            code: "invalid_request",
            message: err.message,
            details: err.details,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }

      // Unexpected validation error
      throw err;
    }

    // Register user via Supabase Auth
    let response: RegisterResponseDTO;
    try {
      response = await registerUser(locals.supabase, command);
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === "email_exists") {
          return new Response(
            JSON.stringify({
              code: "conflict",
              message: err.message,
            }),
            {
              status: 409,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        // Generic auth error
        return new Response(
          JSON.stringify({
            code: "auth_error",
            message: err.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }

      // Unexpected error
      throw err;
    }

    // Emit registration_complete event (fire-and-forget)
    // We don't wait for this to avoid blocking the response
    emitRegistrationEvent(request, response.user_id).catch((err) => {
      console.error("[POST /api/auth/register] Failed to emit registration_complete event:", err);
    });

    // Return success response
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    // Handle unexpected errors
    console.error("[POST /api/auth/register] Unexpected error:", {
      error: err,
      message: err?.message,
      stack: err?.stack,
    });

    return new Response(
      JSON.stringify({
        code: "internal_error",
        message: "Something went wrong. Please try again later.",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
};

/**
 * Emits a registration_complete event to the events API
 * This is a fire-and-forget operation that doesn't block the response
 */
async function emitRegistrationEvent(request: Request, userId: string): Promise<void> {
  try {
    const siteUrl = import.meta.env.SITE_URL || "http://localhost:4321";
    const eventsUrl = `${siteUrl}/api/events`;

    // Forward relevant headers for context
    const headers = new Headers({
      "content-type": "application/json",
      "user-agent": request.headers.get("user-agent") || "unknown",
    });

    // Copy authorization header if present (for user_id association)
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      headers.set("authorization", authHeader);
    }

    // Make the request
    const response = await fetch(eventsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event_type: "registration_complete",
        metadata: { user_id: userId },
      }),
    });

    if (!response.ok) {
      console.error("[emitRegistrationEvent] Event API returned error:", {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (err) {
    console.error("[emitRegistrationEvent] Failed to call events API:", err);
    // Don't throw - this is fire-and-forget
  }
}

