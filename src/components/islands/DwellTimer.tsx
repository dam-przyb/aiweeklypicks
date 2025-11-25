import { useEffect, useRef, useState } from "react";
import type { UUID, PostEventCommand, PostEventAcceptedDTO } from "@/types";

interface DwellTimerProps {
  reportId: UUID;
  thresholdSeconds?: number;
}

/**
 * DwellTimer - React island that tracks active view time and posts a report_view event
 * after the user has been actively viewing the page for at least the threshold duration.
 *
 * Pauses when the tab is hidden and resumes when visible.
 * Prevents duplicate event posts.
 */
export default function DwellTimer({ reportId, thresholdSeconds = 10 }: DwellTimerProps) {
  const [hasPosted, setHasPosted] = useState(false);
  const elapsedMsRef = useRef(0);
  const intervalIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Don't start if already posted
    if (hasPosted) {
      return;
    }

    const thresholdMs = thresholdSeconds * 1000;

    /**
     * Posts the report_view event to the API
     */
    const postEvent = async () => {
      if (hasPosted) {
        return;
      }

      const dwellSeconds = Math.floor(elapsedMsRef.current / 1000);

      // Only post if we've met the threshold
      if (dwellSeconds < thresholdSeconds) {
        return;
      }

      try {
        const payload: PostEventCommand = {
          event_type: "report_view",
          dwell_seconds: dwellSeconds,
          report_id: reportId,
        };

        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = (await response.json()) as PostEventAcceptedDTO;
          console.log("report_view event posted successfully:", result.event_id);
          setHasPosted(true);
        } else {
          console.warn("Failed to post report_view event:", response.status);
        }
      } catch (error) {
        console.warn("Error posting report_view event:", error);
      }
    };

    /**
     * Starts the timer to accumulate active viewing time
     */
    const startTimer = () => {
      if (intervalIdRef.current !== null || hasPosted) {
        return;
      }

      startTimeRef.current = Date.now();

      // Check elapsed time every 100ms for precision
      intervalIdRef.current = window.setInterval(() => {
        if (startTimeRef.current !== null) {
          const now = Date.now();
          const delta = now - startTimeRef.current;
          elapsedMsRef.current += delta;
          startTimeRef.current = now;

          // Check if we've reached the threshold
          if (elapsedMsRef.current >= thresholdMs && !hasPosted) {
            stopTimer();
            postEvent();
          }
        }
      }, 100);
    };

    /**
     * Stops the timer without resetting accumulated time
     */
    const stopTimer = () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      startTimeRef.current = null;
    };

    /**
     * Handles visibility change (tab hidden/visible)
     */
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    /**
     * Handles page unload events - stop timer to prevent late posts
     */
    const handleUnload = () => {
      stopTimer();
    };

    // Start timer if page is visible
    if (!document.hidden) {
      startTimer();
    }

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    // Note: 'freeze' event is not widely supported but we'll add it for completeness
    window.addEventListener("freeze", handleUnload);

    // Cleanup
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("freeze", handleUnload);
    };
  }, [reportId, thresholdSeconds, hasPosted]);

  // This component has no visible UI
  return null;
}
