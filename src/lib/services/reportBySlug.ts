import type { ReportWithPicksDTO, ReportDTO, StockPickDTO } from "@/types";
import type { SupabaseClient } from "@/db/supabase.client";

const REPORT_COLUMNS = [
  "report_id",
  "slug",
  "report_week",
  "published_at",
  "version",
  "title",
  "summary",
  "created_at",
] as const;

const PICK_COLUMNS = [
  "pick_id",
  "report_id",
  "ticker",
  "exchange",
  "side",
  "target_change_pct",
  "rationale",
  "created_at",
] as const;

/**
 * Fetch a single report by slug with its associated stock picks.
 * Returns null when the report is not found.
 */
export async function getReportWithPicksBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<ReportWithPicksDTO | null> {
  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS.join(","))
    .eq("slug", slug)
    .single();

  // Not found: PostgREST returns code PGRST116 for .single() with no rows
  if ((reportError as any)?.code === "PGRST116") return null;
  if (reportError) throw reportError;
  if (!report) return null;

  const { data: picks, error: picksError } = await supabase
    .from("stock_picks")
    .select(PICK_COLUMNS.join(","))
    .eq("report_id", (report as any).report_id)
    .order("ticker", { ascending: true })
    .order("side", { ascending: true });

  if (picksError) throw picksError;

  return {
    report: report as unknown as ReportDTO,
    picks: (picks ?? []) as unknown as StockPickDTO[],
  };
}
