import type { ReportsListQuery, ReportListItemDTO, ReportListItemViewModel } from "@/types";

/**
 * Normalizes query parameters from URLSearchParams into a validated ReportsListQuery.
 * Coerces invalid values to defaults.
 */
export function normalizeReportsListQuery(searchParams: URLSearchParams): ReportsListQuery {
  const query: ReportsListQuery = {};

  // Parse page (min 1, default 1)
  const pageParam = searchParams.get("page");
  if (pageParam) {
    const pageNum = parseInt(pageParam, 10);
    query.page = !isNaN(pageNum) && pageNum >= 1 ? pageNum : 1;
  } else {
    query.page = 1;
  }

  // Parse page_size (min 1, max 100, default 20)
  const pageSizeParam = searchParams.get("page_size");
  if (pageSizeParam) {
    const pageSizeNum = parseInt(pageSizeParam, 10);
    query.page_size = !isNaN(pageSizeNum) && pageSizeNum >= 1 && pageSizeNum <= 100 ? pageSizeNum : 20;
  } else {
    query.page_size = 20;
  }

  // Parse sort (allowed: published_at, report_week, title; default: published_at)
  const sortParam = searchParams.get("sort");
  const allowedSorts = ["published_at", "report_week", "title"] as const;
  if (sortParam && allowedSorts.includes(sortParam as (typeof allowedSorts)[number])) {
    query.sort = sortParam as "published_at" | "report_week" | "title";
  } else {
    query.sort = "published_at";
  }

  // Parse order (allowed: asc, desc; default: desc)
  const orderParam = searchParams.get("order");
  if (orderParam === "asc" || orderParam === "desc") {
    query.order = orderParam;
  } else {
    query.order = "desc";
  }

  // Optional filters (pass through if present)
  const weekParam = searchParams.get("week");
  if (weekParam) query.week = weekParam;

  const versionParam = searchParams.get("version");
  if (versionParam) query.version = versionParam;

  const publishedBeforeParam = searchParams.get("published_before");
  if (publishedBeforeParam) query.published_before = publishedBeforeParam;

  const publishedAfterParam = searchParams.get("published_after");
  if (publishedAfterParam) query.published_after = publishedAfterParam;

  return query;
}

/**
 * Maps a ReportListItemDTO to a ReportListItemViewModel.
 * Formats dates for display and creates localized tooltip strings.
 */
export function mapReportDtoToViewModel(dto: ReportListItemDTO): ReportListItemViewModel {
  // Parse the ISO date string (format: YYYY-MM-DDTHH:mm:ss.sssZ or similar)
  const publishedDate = new Date(dto.published_at);

  // Format as YYYY-MM-DD for display (UTC)
  const publishedAtIso = publishedDate.toISOString().split("T")[0];

  // Create a localized datetime string for tooltip
  // Example: "November 23, 2025, 10:30 AM PST"
  const publishedAtLocalTooltip = publishedDate.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return {
    reportId: dto.report_id,
    slug: dto.slug,
    title: dto.title,
    reportWeek: dto.report_week,
    publishedAtIso,
    publishedAtLocalTooltip,
    version: dto.version,
    summary: dto.summary || "No summary available.",
  };
}

/**
 * Builds a query string from a ReportsListQuery object.
 */
export function buildQueryString(query: ReportsListQuery): string {
  const params = new URLSearchParams();

  if (query.page !== undefined && query.page !== 1) {
    params.set("page", query.page.toString());
  }
  if (query.page_size !== undefined && query.page_size !== 20) {
    params.set("page_size", query.page_size.toString());
  }
  if (query.sort && query.sort !== "published_at") {
    params.set("sort", query.sort);
  }
  if (query.order && query.order !== "desc") {
    params.set("order", query.order);
  }
  if (query.week) params.set("week", query.week);
  if (query.version) params.set("version", query.version);
  if (query.published_before) params.set("published_before", query.published_before);
  if (query.published_after) params.set("published_after", query.published_after);

  const str = params.toString();
  return str ? `?${str}` : "";
}
