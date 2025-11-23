import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SortStateViewModel } from "@/types";

interface SortControlsProps {
  initialSort: "published_at" | "report_week" | "title";
  initialOrder: "asc" | "desc";
  otherParams?: Record<string, string>;
}

export function SortControls({ initialSort, initialOrder, otherParams = {} }: SortControlsProps) {
  const [sort, setSort] = useState<SortStateViewModel["sort"]>(initialSort);
  const [order, setOrder] = useState<SortStateViewModel["order"]>(initialOrder);

  const handleSortChange = (newSort: SortStateViewModel["sort"]) => {
    setSort(newSort);
    navigateWithParams({ sort: newSort, order, page: 1 });
  };

  const handleOrderToggle = () => {
    const newOrder = order === "asc" ? "desc" : "asc";
    setOrder(newOrder);
    navigateWithParams({ sort, order: newOrder, page: 1 });
  };

  const navigateWithParams = (updates: { sort: string; order: string; page: number }) => {
    const params = new URLSearchParams(otherParams);

    // Reset page to 1 when sorting changes
    params.set("page", "1");

    // Set sort (only if not default)
    if (updates.sort !== "published_at") {
      params.set("sort", updates.sort);
    } else {
      params.delete("sort");
    }

    // Set order (only if not default)
    if (updates.order !== "desc") {
      params.set("order", updates.order);
    } else {
      params.delete("order");
    }

		// Navigate to the new URL (full page reload for SSR)
		const queryString = params.toString();
		const newUrl = queryString ? `/?${queryString}` : "/";
		// eslint-disable-next-line react-compiler/react-compiler
		window.location.href = newUrl;
  };

  // Map sort values to display labels
  const sortLabels: Record<SortStateViewModel["sort"], string> = {
    published_at: "Published Date",
    report_week: "Report Week",
    title: "Title",
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">
        Sort by:
      </label>

      <Select value={sort} onValueChange={handleSortChange}>
        <SelectTrigger id="sort-select" className="w-[180px]" aria-label="Sort reports by">
          <SelectValue placeholder="Select sort field" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="published_at">{sortLabels.published_at}</SelectItem>
          <SelectItem value="report_week">{sortLabels.report_week}</SelectItem>
          <SelectItem value="title">{sortLabels.title}</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="default"
        onClick={handleOrderToggle}
        aria-label={`Sort order: ${order === "asc" ? "ascending" : "descending"}. Click to toggle.`}
        className="gap-2"
      >
        {order === "asc" ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            <span>Ascending</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
            <span>Descending</span>
          </>
        )}
      </Button>

      <div className="text-sm text-gray-500 ml-auto" aria-live="polite">
        Showing reports sorted by <span className="font-medium text-gray-700">{sortLabels[sort]}</span> in{" "}
        <span className="font-medium text-gray-700">{order === "asc" ? "ascending" : "descending"}</span> order
      </div>
    </div>
  );
}
