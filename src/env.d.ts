/// <reference types="astro/client" />

import type { SupabaseServerClient } from "./db/supabaseServer";
import type { User, Session } from "@supabase/supabase-js";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseServerClient;
      user: User | null;
      session: Session | null;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly EVENT_IP_HASH_SALT: string;
  readonly SITE_URL: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
