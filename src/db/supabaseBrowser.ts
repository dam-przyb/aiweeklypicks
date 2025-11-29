import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Creates a Supabase browser client for client-side React components
 * This client automatically manages authentication cookies in the browser
 *
 * Note: This should only be used in React islands (client:* directives in Astro)
 * For server-side code, use getSupabaseServerClient instead
 *
 * @returns Supabase client configured for browser with cookie-based session management
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_KEY
  );
}

/**
 * Type export for the Supabase browser client
 * Use this type in React components
 */
export type SupabaseBrowserClient = ReturnType<typeof getSupabaseBrowserClient>;

