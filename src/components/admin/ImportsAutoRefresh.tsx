import { useEffect, useRef, useState, useCallback } from "react";

interface ImportsAutoRefreshProps {
  refreshIntervalSeconds?: number;
}

/**
 * Optional component that auto-refreshes the imports page at a configurable interval.
 * Pauses when the tab is hidden using the Page Visibility API.
 * Displays a toggle to enable/disable auto-refresh and shows last refresh time.
 */
export default function ImportsAutoRefresh({
  refreshIntervalSeconds = 30,
}: ImportsAutoRefreshProps) {
  const [enabled, setEnabled] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(refreshIntervalSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(() => {
    // Only refresh if the page is visible
    if (document.visibilityState === "visible") {
      setLastRefresh(new Date());
      setCountdown(refreshIntervalSeconds);
      window.location.reload();
    }
  }, [refreshIntervalSeconds]);

  const startPolling = useCallback(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Start refresh interval
    intervalRef.current = setInterval(() => {
      refresh();
    }, refreshIntervalSeconds * 1000);

    // Start countdown interval (update every second)
    setCountdown(refreshIntervalSeconds);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return refreshIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
  }, [refresh, refreshIntervalSeconds]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(refreshIntervalSeconds);
  }, [refreshIntervalSeconds]);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // Handle visibility change to pause/resume polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (enabled) {
        if (document.visibilityState === "visible") {
          // Resume polling when tab becomes visible
          startPolling();
        } else {
          // Pause polling when tab is hidden
          stopPolling();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling]);

  const handleToggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
            enabled ? "bg-blue-600" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle auto-refresh"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>

        {/* Label and Status */}
        <div>
          <p className="text-sm font-medium text-gray-900">
            Auto-refresh {enabled ? "enabled" : "disabled"}
          </p>
          {enabled && (
            <p className="text-xs text-gray-600">
              Next refresh in {countdown}s
              {document.visibilityState !== "visible" && " (paused - tab hidden)"}
            </p>
          )}
          {!enabled && lastRefresh && (
            <p className="text-xs text-gray-600">
              Last refreshed at {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Manual Refresh Button */}
      {enabled && (
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-800 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
          aria-label="Refresh now"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh now
        </button>
      )}
    </div>
  );
}

