import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import { limitPerKey } from "@/lib/services/rateLimit";

import type { Database } from "../db/database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

/**
 * Public GET endpoint prefixes that should be rate-limited per IP
 * Rate limit: 60 requests per minute per IP
 */
const PUBLIC_GET_ROUTE_PREFIXES = ["/api/picks", "/api/reports"];

/**
 * Extract client IP address from request headers
 * Checks common proxy headers in order of preference
 */
function getClientIP(request: Request): string {
  // Check common reverse proxy headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a placeholder (in dev/local environments)
  return "unknown";
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Apply rate limiting to public GET endpoints by prefix
  if (request.method === "GET" && PUBLIC_GET_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const clientIP = getClientIP(request);
    const rateLimitKey = `public:${pathname}:${clientIP}`;

    const allowed = limitPerKey({
      key: rateLimitKey,
      max: 60, // 60 requests
      windowMs: 60_000, // per minute
    });

    if (!allowed) {
      return new Response(
        JSON.stringify({
          code: "rate_limited",
          message: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
          },
        }
      );
    }
  }

  // Extract Authorization header if present for per-request client
  const authHeader = request.headers.get("authorization");

  // Create a per-request Supabase client
  // If an Authorization header is present, it will be used automatically by Supabase
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { authorization: authHeader } : {},
    },
  });

  context.locals.supabase = supabase;
  return next();
});
