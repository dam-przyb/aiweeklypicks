import { useEffect, useRef, useState } from "react";

interface PrefetchLinkProps {
	href: string;
	children: React.ReactNode;
	strategy?: "route" | "api";
	disableOnTouch?: boolean;
	className?: string;
	[key: string]: unknown; // Allow other anchor props
}

/**
 * PrefetchLink - A React island that prefetches content on hover/focus
 * 
 * This component wraps an anchor tag and adds intelligent prefetching behavior:
 * - Prefetches on mouseenter/focus (desktop only by default)
 * - Debounces to avoid excessive requests
 * - Cancels prefetch if user leaves before delay
 * - Disabled on touch devices to save bandwidth
 */
export function PrefetchLink({
	href,
	children,
	strategy = "route",
	disableOnTouch = true,
	className,
	...anchorProps
}: PrefetchLinkProps) {
	const linkRef = useRef<HTMLAnchorElement>(null);
	const [hasPrefetched, setHasPrefetched] = useState(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Detect if device supports touch
	const isTouchDevice = useRef(false);

	useEffect(() => {
		// Check if touch is supported
		isTouchDevice.current =
			"ontouchstart" in window || navigator.maxTouchPoints > 0;
	}, []);

	const prefetch = async () => {
		// Don't prefetch if already done or disabled on touch devices
		if (hasPrefetched || (disableOnTouch && isTouchDevice.current)) {
			return;
		}

		// Cancel any existing prefetch
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Create new abort controller
		abortControllerRef.current = new AbortController();

		try {
			if (strategy === "route") {
				// Prefetch the route by creating a link tag
				// This leverages browser's built-in prefetching
				const existingLink = document.querySelector(
					`link[rel="prefetch"][href="${href}"]`
				);

				if (!existingLink) {
					const link = document.createElement("link");
					link.rel = "prefetch";
					link.href = href;
					link.as = "document";
					document.head.appendChild(link);
				}
			} else if (strategy === "api") {
				// Prefetch API data
				const apiUrl = href.replace("/reports/", "/api/reports/");
				await fetch(apiUrl, {
					signal: abortControllerRef.current.signal,
					priority: "low" as RequestPriority,
				});
			}

			setHasPrefetched(true);
		} catch (err) {
			// Ignore abort errors
			if ((err as Error).name !== "AbortError") {
				console.warn("Prefetch failed:", err);
			}
		}
	};

	const handleMouseEnter = () => {
		// Debounce: only prefetch if user hovers for 100ms
		timeoutRef.current = setTimeout(() => {
			void prefetch();
		}, 100);
	};

	const handleMouseLeave = () => {
		// Cancel prefetch if user leaves quickly
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		// Abort ongoing fetch
		if (abortControllerRef.current && !hasPrefetched) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
	};

	const handleFocus = () => {
		// Prefetch on focus (keyboard navigation)
		// Slightly longer delay for focus to avoid prefetching while tabbing through
		timeoutRef.current = setTimeout(() => {
			void prefetch();
		}, 200);
	};

	const handleBlur = () => {
		// Cancel on blur
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	return (
		<a
			ref={linkRef}
			href={href}
			className={className}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleFocus}
			onBlur={handleBlur}
			{...anchorProps}
		>
			{children}
		</a>
	);
}

