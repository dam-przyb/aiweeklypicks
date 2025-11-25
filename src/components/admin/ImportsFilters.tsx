import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImportsFiltersProps {
  currentStatus?: string;
  currentStartedAfter?: string;
  currentStartedBefore?: string;
}

export default function ImportsFilters({
  currentStatus = "",
  currentStartedAfter = "",
  currentStartedBefore = "",
}: ImportsFiltersProps) {
  const [status, setStatus] = useState(currentStatus);
  const [startedAfter, setStartedAfter] = useState(currentStartedAfter);
  const [startedBefore, setStartedBefore] = useState(currentStartedBefore);

  const handleApplyFilters = useCallback(() => {
    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }
    if (startedAfter) {
      params.set("started_after", startedAfter);
    }
    if (startedBefore) {
      params.set("started_before", startedBefore);
    }

    // Always reset to page 1 when applying filters
    params.set("page", "1");

    window.location.href = `?${params.toString()}`;
  }, [status, startedAfter, startedBefore]);

  const handleClearFilters = useCallback(() => {
    window.location.href = "?page=1";
  }, []);

  const hasActiveFilters = Boolean(currentStatus || currentStartedAfter || currentStartedBefore);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
            Status
          </Label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Started After Filter */}
        <div className="space-y-2">
          <Label htmlFor="started-after-filter" className="text-sm font-medium text-gray-700">
            Started After
          </Label>
          <Input
            id="started-after-filter"
            type="datetime-local"
            value={startedAfter}
            onChange={(e) => setStartedAfter(e.target.value)}
            className="w-full text-sm"
          />
        </div>

        {/* Started Before Filter */}
        <div className="space-y-2">
          <Label htmlFor="started-before-filter" className="text-sm font-medium text-gray-700">
            Started Before
          </Label>
          <Input
            id="started-before-filter"
            type="datetime-local"
            value={startedBefore}
            onChange={(e) => setStartedBefore(e.target.value)}
            className="w-full text-sm"
          />
        </div>
      </div>

      {/* Apply Button */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={handleClearFilters}
          variant="outline"
          className="text-sm"
          disabled={!hasActiveFilters}
        >
          Reset
        </Button>
        <Button onClick={handleApplyFilters} className="text-sm">
          Apply Filters
        </Button>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Active filters:</p>
          <div className="flex flex-wrap gap-2">
            {currentStatus && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Status: {currentStatus === "success" ? "Success" : "Failed"}
                <button
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("status");
                    params.set("page", "1");
                    window.location.href = `?${params.toString()}`;
                  }}
                  className="ml-1 hover:text-blue-900"
                  aria-label="Remove status filter"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {currentStartedAfter && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                After: {new Date(currentStartedAfter).toLocaleString()}
                <button
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("started_after");
                    params.set("page", "1");
                    window.location.href = `?${params.toString()}`;
                  }}
                  className="ml-1 hover:text-blue-900"
                  aria-label="Remove started after filter"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {currentStartedBefore && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Before: {new Date(currentStartedBefore).toLocaleString()}
                <button
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("started_before");
                    params.set("page", "1");
                    window.location.href = `?${params.toString()}`;
                  }}
                  className="ml-1 hover:text-blue-900"
                  aria-label="Remove started before filter"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

