export const prerender = false;

import type { APIRoute } from "astro";
import type { Json } from "../../../db/database.types";
import {
  filenameSchema,
  jsonVariantSchema,
  MAX_PAYLOAD_SIZE,
  calculatePayloadSize,
} from "../../../lib/validation/imports";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "../../../lib/services/authz";
import { adminImportReport } from "../../../lib/services/imports";
import { parseAdminImportsQuery, ValidationError } from "../../../lib/validation/admin/imports";
import { limitPerKey, RateLimitError } from "../../../lib/services/rateLimit";
import { listAdminImports, DatabaseError } from "../../../lib/services/admin/imports";

/**
 * POST /api/admin/imports
 *
 * Uploads a weekly report JSON and imports it into the database.
 * Supports both multipart/form-data (file upload) and application/json (direct JSON body).
 *
 * Admin-only endpoint with bearer token authentication.
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const supabase = locals.supabase;

  try {
    // Step 1: Verify admin authentication
    await requireAdmin(supabase);

    // Step 2: Parse input based on Content-Type
    const contentType = request.headers.get("content-type") || "";
    let filename: string;
    let payload: Json;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart/form-data (file upload)
      const result = await handleMultipartUpload(request);
      filename = result.filename;
      payload = result.payload;
    } else if (contentType.includes("application/json")) {
      // Handle application/json (direct JSON body)
      const result = await handleJsonUpload(request);
      filename = result.filename;
      payload = result.payload;
    } else {
      return jsonResponse(
        { code: "unsupported_media_type", message: "Content-Type must be multipart/form-data or application/json" },
        400
      );
    }

    // Step 3: Validate filename format
    const filenameValidation = filenameSchema.safeParse(filename);
    if (!filenameValidation.success) {
      return jsonResponse(
        { code: "invalid_filename", message: "Filename must match format: YYYY-MM-DDreport.json" },
        400
      );
    }

    // Step 4: Call the import RPC
    const result = await adminImportReport(supabase, payload, filenameValidation.data);

    // Step 5: Map result to HTTP response
    if (result.status === "success") {
      return jsonResponse(result, 201);
    }

    // Handle failed imports - map error to appropriate status code
    const status = classifyErrorStatus(result.error);
    return jsonResponse(result, status);
  } catch (err) {
    // Handle known authorization errors
    if (err instanceof UnauthorizedError) {
      return jsonResponse({ code: "unauthorized", message: (err as Error).message }, 401);
    }

    if (err instanceof ForbiddenError) {
      return jsonResponse({ code: "forbidden", message: (err as Error).message }, 403);
    }

    // Handle validation errors thrown during parsing
    if ((err as { code?: string }).code === "bad_request") {
      return jsonResponse(
        { code: (err as { code?: string; message: string }).code, message: (err as Error).message },
        400
      );
    }

    if ((err as { code?: string }).code === "payload_too_large") {
      return jsonResponse(
        { code: (err as { code?: string; message: string }).code, message: (err as Error).message },
        413
      );
    }

    // Log unexpected errors for debugging (in production, use proper logging)
    console.error("Unexpected error in POST /api/admin/imports:", err);

    // Return generic server error
    return jsonResponse({ code: "server_error", message: "An unexpected error occurred" }, 500);
  }
};

/**
 * Handles multipart/form-data file uploads
 */
async function handleMultipartUpload(request: Request): Promise<{ filename: string; payload: Json }> {
  const form = await request.formData();

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    throw createError("bad_request", 'Field "file" is required and must be a file');
  }

  // Validate file extension
  if (!file.name.endsWith(".json")) {
    throw createError("bad_request", "File must have .json extension");
  }

  // Validate file size (hard limit: 5MB)
  if (file.size > MAX_PAYLOAD_SIZE) {
    throw createError("payload_too_large", `File size exceeds ${MAX_PAYLOAD_SIZE / (1024 * 1024)}MB limit`);
  }

  // Get filename from form field or fallback to file.name
  const filenameField = form.get("filename");
  const filename = filenameField ? String(filenameField) : file.name;

  // Read and parse file content
  const text = await file.text();
  let payload: Json;

  try {
    payload = JSON.parse(text) as Json;
  } catch {
    throw createError("bad_request", "File content is not valid JSON");
  }

  return { filename, payload };
}

/**
 * Handles application/json body uploads
 */
async function handleJsonUpload(request: Request): Promise<{ filename: string; payload: Json }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw createError("bad_request", "Request body is not valid JSON");
  }

  // Validate body structure
  const validation = jsonVariantSchema.safeParse(body);
  if (!validation.success) {
    throw createError("bad_request", 'Request body must contain "filename" and "payload" fields');
  }

  const { filename, payload } = validation.data;

  // Validate payload size
  const payloadSize = calculatePayloadSize(payload);
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    throw createError("payload_too_large", `Payload size exceeds ${MAX_PAYLOAD_SIZE / (1024 * 1024)}MB limit`);
  }

  return { filename, payload: payload as Json };
}

/**
 * Classifies error messages from RPC to appropriate HTTP status codes
 */
function classifyErrorStatus(errorMessage: string): number {
  const lowerError = errorMessage.toLowerCase();

  // Check for duplicate/conflict errors
  if (lowerError.includes("duplicate") || lowerError.includes("already exists") || lowerError.includes("conflict")) {
    return 409; // Conflict
  }

  // Check for validation/schema errors
  if (lowerError.includes("schema") || lowerError.includes("validation") || lowerError.includes("invalid")) {
    return 422; // Unprocessable Entity
  }

  // Default to internal server error for unknown errors
  return 500;
}

/**
 * Helper to create error objects
 */
function createError(code: string, message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/**
 * GET /api/admin/imports
 *
 * Admin-only endpoint to query import audit records for operational monitoring.
 * Supports pagination and filtering by status, time range, and uploader.
 *
 * Authentication: Bearer token (admin required)
 * Rate Limit: 30 requests per minute per admin user
 * Cache: No caching (admin data)
 *
 * Query Parameters:
 * - page (number): Page number (default: 1, min: 1)
 * - page_size (number): Items per page (default: 20, min: 1, max: 100)
 * - status (string): Filter by import status (success | failed)
 * - started_before (ISO datetime): Filter imports started before this time
 * - started_after (ISO datetime): Filter imports started after this time
 * - uploader (UUID): Filter by uploaded_by_user_id
 *
 * Response Codes:
 * - 200: Success with paginated imports
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
    const query = parseAdminImportsQuery(url);

    // Step 2: Verify admin authentication
    // This will throw UnauthorizedError or ForbiddenError if not authorized
    await requireAdmin(supabase);

    // Step 3: Get authenticated user for rate limiting
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      throw new UnauthorizedError("Failed to verify user identity");
    }

    // Step 4: Apply rate limiting (30 requests per minute per admin)
    const rateLimitKey = `admin:imports:${userRes.user.id}`;
    const isAllowed = limitPerKey({
      key: rateLimitKey,
      max: 30,
      windowMs: 60_000, // 1 minute
    });

    if (!isAllowed) {
      throw new RateLimitError("Rate limit exceeded. Maximum 30 requests per minute.");
    }

    // Step 5: Query imports with filters
    const result = await listAdminImports(supabase, query);

    // Step 6: Return successful response
    return jsonResponse(result, 200);
  } catch (err) {
    // Handle validation errors (bad request)
    if (err instanceof ValidationError) {
      return jsonResponse(
        {
          code: "bad_request",
          message: err.message,
        },
        400
      );
    }

    // Handle authentication errors (unauthorized)
    if (err instanceof UnauthorizedError) {
      return jsonResponse(
        {
          code: "unauthorized",
          message: err.message,
        },
        401
      );
    }

    // Handle authorization errors (forbidden)
    if (err instanceof ForbiddenError) {
      return jsonResponse(
        {
          code: "forbidden",
          message: err.message,
        },
        403
      );
    }

    // Handle rate limit errors
    if (err instanceof RateLimitError) {
      return jsonResponse(
        {
          code: "rate_limited",
          message: err.message,
        },
        429
      );
    }

    // Handle database errors
    if (err instanceof DatabaseError) {
      // Log database errors for debugging (in production, use proper logging service)
      console.error("Database error in GET /api/admin/imports:", {
        message: err.message,
        cause: err.cause,
      });

      return jsonResponse(
        {
          code: "server_error",
          message: "Failed to retrieve imports",
        },
        500
      );
    }

    // Handle any unexpected errors
    console.error("Unexpected error in GET /api/admin/imports:", err);

    return jsonResponse(
      {
        code: "server_error",
        message: "An unexpected error occurred",
      },
      500
    );
  }
};

/**
 * Helper to create JSON responses with proper headers
 */
function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store", // Admin endpoint - not cacheable
    },
  });
}
