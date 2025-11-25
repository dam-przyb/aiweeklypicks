import { useState, useEffect } from "react";
import type { PicksListQuery, SortOrder } from "@/types";

interface Props {
  column: NonNullable<PicksListQuery["sort"]>;
  label: string;
  currentSort: NonNullable<PicksListQuery["sort"]>;
  currentOrder: SortOrder;
  otherParams: PicksListQuery;
  isSortDisabled?: boolean;
}

/**
 * SortableTableHeader - Interactive table header for sortable columns
 *
 * Provides accessible sorting controls with:
 * - Keyboard navigation (Enter/Space)
 * - ARIA attributes (aria-sort)
 * - Screen reader announcements via aria-live
 * - Visual sort indicators
 */
export default function SortableTableHeader({
  column,
  label,
  currentSort,
  currentOrder,
  otherParams,
  isSortDisabled = false,
}: Props) {
  const [announcement, setAnnouncement] = useState("");

  // Determine if this column is currently sorted
  const isActive = currentSort === column;

  // Determine next sort order when clicked
  const getNextOrder = (): SortOrder => {
    if (!isActive) {
      // First click: use default order
      // published_at defaults to desc, others to asc
      return column === "published_at" ? "desc" : "asc";
    }
    // Toggle current order
    return currentOrder === "asc" ? "desc" : "asc";
  };

  // Build URL for next sort state
  const buildHref = (): string => {
    const nextOrder = getNextOrder();
    const params = new URLSearchParams();

    // Preserve pagination and filters
    if (otherParams.page && otherParams.page !== 1) {
      params.set("page", "1"); // Reset to page 1 when sorting changes
    }
    if (otherParams.page_size && otherParams.page_size !== 20) {
      params.set("page_size", otherParams.page_size.toString());
    }

    // Set new sort parameters
    if (column !== "published_at") {
      params.set("sort", column);
    }
    if (nextOrder !== "desc") {
      params.set("order", nextOrder);
    }

    // Preserve filters
    if (otherParams.ticker) params.set("ticker", otherParams.ticker);
    if (otherParams.exchange) params.set("exchange", otherParams.exchange);
    if (otherParams.side) params.set("side", otherParams.side);
    if (otherParams.date_before) params.set("date_before", otherParams.date_before);
    if (otherParams.date_after) params.set("date_after", otherParams.date_after);

    const str = params.toString();
    return str ? `?${str}` : "";
  };

  // Handle click/keyboard activation
  const handleActivate = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (isSortDisabled) return;

    // Keyboard handling
    if ("key" in event && event.key !== "Enter" && event.key !== " ") {
      return;
    }

    // Prevent default for space key to avoid page scroll
    if ("key" in event && event.key === " ") {
      event.preventDefault();
    }

    const nextOrder = getNextOrder();
    const orderLabel = nextOrder === "asc" ? "ascending" : "descending";
    setAnnouncement(`Sorting by ${label}, ${orderLabel}`);
  };

  // Clear announcement after it's been read
  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  // Determine aria-sort value
  const getAriaSort = () => {
    if (!isActive) return undefined;
    return currentOrder === "asc" ? "ascending" : "descending";
  };

  // If sorting is disabled, render as static header
  if (isSortDisabled) {
    return (
      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </th>
    );
  }

  const href = buildHref();

  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
      aria-sort={getAriaSort()}
    >
      <a
        href={href}
        className="group inline-flex items-center gap-2 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded transition-colors"
        onClick={handleActivate}
        onKeyDown={handleActivate}
        role="button"
        tabIndex={0}
        aria-label={`Sort by ${label}${isActive ? `, currently sorted ${currentOrder === "asc" ? "ascending" : "descending"}` : ""}`}
      >
        <span>{label}</span>

        {/* Sort indicator icon */}
        <span className="relative flex items-center" aria-hidden="true">
          {!isActive && (
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          )}
          {isActive && currentOrder === "asc" && (
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {isActive && currentOrder === "desc" && (
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </a>

      {/* Screen reader announcement for sort changes */}
      {announcement && (
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      )}
    </th>
  );
}
