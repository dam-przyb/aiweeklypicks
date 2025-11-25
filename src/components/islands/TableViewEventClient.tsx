import { useEffect, useRef } from "react";
import type { PostEventCommand, PostEventAcceptedDTO } from "@/types";

/**
 * TableViewEventClient - React island that posts a table_view event once on mount.
 * 
 * This component is headless (no UI) and fires the event as soon as the page loads.
 * It uses a ref guard to prevent duplicate posts and silently handles failures
 * to ensure analytics issues don't impact user experience.
 */
export default function TableViewEventClient() {
  const hasPostedRef = useRef(false);

  useEffect(() => {
    // Guard: Only fire once per component mount
    if (hasPostedRef.current) {
      return;
    }

    const postEvent = async () => {
      // Double-check guard in case of race conditions
      if (hasPostedRef.current) {
        return;
      }

      // Mark as posted immediately to prevent duplicate attempts
      hasPostedRef.current = true;

      try {
        const payload: PostEventCommand = {
          event_type: "table_view",
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
          
          // Log success in development only
          if (import.meta.env.DEV) {
            console.log("table_view event posted successfully:", result.event_id);
          }
        } else {
          // Log warning but don't throw - analytics failures shouldn't break UX
          if (import.meta.env.DEV) {
            console.warn("Failed to post table_view event:", response.status);
          }
        }
      } catch (error) {
        // Silently handle errors in production, log in development
        if (import.meta.env.DEV) {
          console.warn("Error posting table_view event:", error);
        }
      }
    };

    // Post the event
    postEvent();
  }, []); // Empty deps array - only run once on mount

  // This component has no visible UI
  return null;
}

