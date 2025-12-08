import { createServerClient, parseCookieHeader, type CookieOptions } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "./database.types";

/**
 * Creates a Supabase server client for SSR contexts (Astro pages, API routes, middleware)
 * This client automatically manages authentication cookies for server-side rendering
 *
 * @param cookies - Astro cookies object from the request context
 * @param headers - Optional request headers (used to parse initial cookies)
 * @returns Supabase client configured for SSR with cookie-based session management
 */
export function getSupabaseServerClient(cookies: AstroCookies, headers?: Headers) {
  return createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookies: {
      getAll() {
        // Parse cookies from request headers if available, otherwise get from Astro cookies
        if (headers) {
          return parseCookieHeader(headers.get("Cookie") ?? "");
        }
        return cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        // Set cookies using Astro's cookie API
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options as Parameters<AstroCookies["set"]>[2]);
        });
      },
    },
  });
}

/**
 * Type export for the Supabase server client
 * Use this type in service functions and API routes
 */
export type SupabaseServerClient = ReturnType<typeof getSupabaseServerClient>;
