import type { SupabaseClient } from "../../db/supabase.client";
import type { AdminImportsListQuery, AdminImportsListResponseDTO, ImportsAuditDTO } from "../../types";

/**
 * Columns to select from imports_audit table for admin view
 * Excludes source_json payload to keep response lightweight
 */
const ADMIN_IMPORTS_COLUMNS = [
  "import_id",
  "uploaded_by_user_id",
  "filename",
  "source_checksum",
  "schema_version",
  "status",
  "error_message",
  "started_at",
  "finished_at",
] as const;

/**
 * Error class for database operation failures
 */
export class DatabaseError extends Error {
  code = "server_error" as const;

  constructor(
    message = "Database operation failed",
    public cause?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Lists import audit records with admin-level access and filtering
 * Applies pagination, ordering by started_at DESC, and various filters
 *
 * @param supabase - Authenticated Supabase client (must be admin user)
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated list of import audit records
 * @throws {DatabaseError} When database query fails
 *
 * @example
 * ```ts
 * const result = await listAdminImports(supabase, {
 *   page: 1,
 *   page_size: 20,
 *   status: 'failed',
 *   started_after: '2025-01-01T00:00:00Z',
 * });
 * ```
 */
export async function listAdminImports(
  supabase: SupabaseClient,
  query: AdminImportsListQuery
): Promise<AdminImportsListResponseDTO> {
  const { page = 1, page_size = 20, status, started_before, started_after, uploader } = query;

  // Calculate pagination range
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  try {
    // Build base query with count
    let req = supabase
      .from("imports_audit")
      .select(ADMIN_IMPORTS_COLUMNS.join(","), { count: "exact" })
      .order("started_at", { ascending: false })
      .range(from, to);

    // Apply status filter if provided
    if (status) {
      req = req.eq("status", status);
    }

    // Apply time range filters
    if (started_after) {
      req = req.gte("started_at", started_after);
    }
    if (started_before) {
      req = req.lte("started_at", started_before);
    }

    // Apply uploader filter
    if (uploader) {
      req = req.eq("uploaded_by_user_id", uploader);
    }

    // Execute query
    const { data, count, error } = await req;

    if (error) {
      throw new DatabaseError("Failed to query imports audit", error);
    }

    // Build paginated response
    const items = (data ?? []) as unknown as ImportsAuditDTO[];
    const total_items = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total_items / page_size));

    return {
      items,
      page,
      page_size,
      total_items,
      total_pages,
    };
  } catch (error) {
    // Re-throw DatabaseError as-is
    if (error instanceof DatabaseError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new DatabaseError("Unexpected error querying imports audit", error);
  }
}
