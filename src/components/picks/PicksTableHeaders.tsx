import { useState, useEffect } from "react";
import type { PicksListQuery, SortOrder } from "@/types";

interface Props {
  currentSort: NonNullable<PicksListQuery["sort"]>;
  currentOrder: SortOrder;
  otherParams: PicksListQuery;
}

interface HeaderConfig {
  column: NonNullable<PicksListQuery["sort"]> | null;
  label: string;
  sortable: boolean;
}

const headers: HeaderConfig[] = [
  { column: "published_at", label: "Date", sortable: true },
  { column: null, label: "Week", sortable: false },
  { column: "ticker", label: "Ticker", sortable: true },
  { column: "exchange", label: "Exchange", sortable: true },
  { column: "side", label: "Side", sortable: true },
  { column: "target_change_pct", label: "Target %", sortable: true },
  { column: null, label: "Report", sortable: false },
];

/**
 * PicksTableHeaders - Renders all table headers in a single row
 * Prevents duplicate headers by rendering the entire <tr> as one React component
 */
export default function PicksTableHeaders({ currentSort, currentOrder, otherParams }: Props) {
  const [announcement, setAnnouncement] = useState("");

  const buildHref = (column: NonNullable<PicksListQuery["sort"]>): string => {
    const isActive = currentSort === column;
    const nextOrder: SortOrder = !isActive
      ? column === "published_at"
        ? "desc"
        : "asc"
      : currentOrder === "asc"
        ? "desc"
        : "asc";

    const params = new URLSearchParams();

    // Reset to page 1 when sorting changes
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

  const handleClick = (column: NonNullable<PicksListQuery["sort"]>, label: string) => {
    const isActive = currentSort === column;
    const nextOrder = !isActive
      ? column === "published_at"
        ? "desc"
        : "asc"
      : currentOrder === "asc"
        ? "desc"
        : "asc";
    const orderLabel = nextOrder === "asc" ? "ascending" : "descending";
    setAnnouncement(`Sorting by ${label}, ${orderLabel}`);
  };

  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const getAriaSort = (column: NonNullable<PicksListQuery["sort"]>) => {
    if (currentSort !== column) return undefined;
    return currentOrder === "asc" ? ("ascending" as const) : ("descending" as const);
  };

  return (
    <tr>
      {headers.map((header, index) => {
        if (!header.sortable || !header.column) {
          return (
            <th
              key={index}
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {header.label}
            </th>
          );
        }

        const column = header.column;
        const isActive = currentSort === column;
        const href = buildHref(column);

        return (
          <th
            key={index}
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            aria-sort={getAriaSort(column)}
          >
            <a
              href={href}
              className="group inline-flex items-center gap-2 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded transition-colors"
              onClick={() => handleClick(column, header.label)}
              role="button"
              tabIndex={0}
              aria-label={`Sort by ${header.label}${isActive ? `, currently sorted ${currentOrder === "asc" ? "ascending" : "descending"}` : ""}`}
            >
              <span>{header.label}</span>

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

            {announcement && (
              <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
              </span>
            )}
          </th>
        );
      })}
    </tr>
  );
}
