import type { ReportsListQuery, ReportsListResponseDTO, ReportListItemDTO, UUID } from "@/types";
import type { SupabaseClient } from "@/db/supabase.client";

/**
 * Columns to select from weekly_reports table for list view.
 * Only includes fields needed by ReportListItemDTO to minimize payload size.
 */
const COLUMNS = [
  "report_id",
  "slug",
  "report_week",
  "published_at",
  "version",
  "title",
  "summary",
  "created_at",
] as const;

/**
 * Lists weekly reports with pagination, sorting, and filtering.
 *
 * This service function builds and executes a Supabase query against the weekly_reports table,
 * applying filters, sorting, and pagination as specified in the query parameters.
 *
 * @param supabase - Supabase client from context.locals (works for both anon and authenticated users)
 * @param query - Validated query parameters containing pagination, sorting, and filter options
 * @returns Promise resolving to paginated response with report items and metadata
 * @throws Supabase errors if database query fails
 */
export async function listReports(supabase: SupabaseClient, query: ReportsListQuery): Promise<ReportsListResponseDTO> {
  // Extract query parameters with defaults
  const {
    page = 1,
    page_size = 20,
    sort = "published_at",
    order = "desc",
    week,
    version,
    published_before,
    published_after,
  } = query;

  // Calculate range for pagination
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  // Build base query with explicit column selection and count
  let request = supabase
    .from("weekly_reports")
    .select(COLUMNS.join(","), { count: "exact" })
    .order(sort, { ascending: order === "asc" })
    .range(from, to);

  // Apply optional filters
  if (week) {
    request = request.eq("report_week", week);
  }
  if (version) {
    request = request.eq("version", version);
  }
  if (published_after) {
    request = request.gte("published_at", published_after);
  }
  if (published_before) {
    request = request.lte("published_at", published_before);
  }

  // Execute query
  const { data, count, error } = await request;

  // Handle database errors
  if (error) {
    throw error;
  }

  // Shape response with pagination metadata
  const items = (data ?? []) as unknown as ReportListItemDTO[];
  const total_items = count ?? 0;
  const total_pages = Math.max(1, Math.ceil(total_items / page_size));

  return {
    items,
    page,
    page_size,
    total_items,
    total_pages,
  };
}

/**
 * Gets the slug for a report by its ID.
 * Used for redirecting from report_id-based links to slug-based canonical URLs.
 *
 * @param supabase - Supabase client from context.locals
 * @param reportId - UUID of the report
 * @returns Promise resolving to the slug, or null if not found
 * @throws Supabase errors if database query fails
 */
export async function getReportSlugById(supabase: SupabaseClient, reportId: UUID): Promise<string | null> {
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("slug")
    .eq("report_id", reportId)
    .single();

  if (error) {
    // If not found, return null instead of throwing
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data?.slug ?? null;
}
