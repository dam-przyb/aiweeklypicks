/**
 * @deprecated Use getSupabaseServerClient() from "./supabaseServer" for SSR contexts
 * or getSupabaseBrowserClient() from "./supabaseBrowser" for client-side React components.
 *
 * This file maintains type compatibility for the migration period.
 */

import type { SupabaseServerClient } from "./supabaseServer";
import type { SupabaseBrowserClient } from "./supabaseBrowser";
import type { Database } from "./database.types";

/**
 * Unified SupabaseClient type that works with both server and browser clients
 * This maintains backward compatibility during migration
 */
export type SupabaseClient = SupabaseServerClient | SupabaseBrowserClient;
