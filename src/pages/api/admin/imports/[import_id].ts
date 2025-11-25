export const prerender = false;

import type { APIRoute } from "astro";
import type { ImportAuditDetailDTO } from "@/types";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/services/authz";
import { DatabaseError } from "@/lib/services/admin/imports";

/**
 * GET /api/admin/imports/[import_id]
 *
 * Retrieves detailed information about a specific import audit record.
 * Includes report linkage (report_id and report_slug) if the import was successful.
 *
 * Admin-only endpoint with bearer token authentication.
 *
 * Path Parameters:
 * - import_id (UUID): The unique identifier of the import audit record
 *
 * Response Codes:
 * - 200: Success with import audit details
 * - 401: Unauthorized (missing/invalid token)
 * - 403: Forbidden (not admin)
 * - 404: Import audit record not found
 * - 500: Internal server error
 */
export const GET: APIRoute = async (context) => {
  const { params, locals } = context;
  const supabase = locals.supabase;

  try {
    // Step 1: Verify admin authentication
    await requireAdmin(supabase);

    // Step 2: Extract and validate import_id from path params
    const { import_id } = params;
    
    if (!import_id) {
      return jsonResponse(
        {
          code: "bad_request",
          message: "import_id parameter is required",
        },
        400
      );
    }

    // Step 3: Fetch import audit record
    const { data: auditData, error: auditError } = await supabase
      .from("imports_audit")
      .select("*")
      .eq("import_id", import_id)
      .single();

    if (auditError || !auditData) {
      // Check if it's a "not found" error
      if (auditError?.code === "PGRST116") {
        return jsonResponse(
          {
            code: "not_found",
            message: "Import audit record not found",
          },
          404
        );
      }

      // Other database errors
      throw new DatabaseError("Failed to fetch import audit", auditError);
    }

    // Step 4: If successful import, fetch report slug for linkage
    let reportSlug: string | undefined;
    if (auditData.report_id) {
      const { data: reportData } = await supabase
        .from("weekly_reports")
        .select("slug")
        .eq("report_id", auditData.report_id)
        .single();
      
      reportSlug = reportData?.slug;
    }

    // Step 5: Build and return the detail DTO
    const importDetail: ImportAuditDetailDTO = {
      import_id: auditData.import_id,
      uploaded_by_user_id: auditData.uploaded_by_user_id,
      filename: auditData.filename,
      source_checksum: auditData.source_checksum,
      schema_version: auditData.schema_version,
      status: auditData.status,
      error_message: auditData.error_message,
      started_at: auditData.started_at,
      finished_at: auditData.finished_at,
      report_id: auditData.report_id,
      report_slug: reportSlug,
    };

    return jsonResponse(importDetail, 200);
  } catch (err) {
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

    // Handle database errors
    if (err instanceof DatabaseError) {
      // Log database errors for debugging (in production, use proper logging service)
      console.error("Database error in GET /api/admin/imports/[import_id]:", {
        message: err.message,
        cause: err.cause,
      });

      return jsonResponse(
        {
          code: "server_error",
          message: "Failed to retrieve import audit details",
        },
        500
      );
    }

    // Handle any unexpected errors
    console.error("Unexpected error in GET /api/admin/imports/[import_id]:", err);

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

