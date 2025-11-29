import type { SupabaseServerClient } from "@/db/supabaseServer";
import type { RegisterCommand, LoginCommand, RegisterResponseDTO, LoginResponseDTO } from "@/types";

/**
 * Error codes for auth operations
 */
export class AuthError extends Error {
  constructor(
    public code: "email_exists" | "invalid_credentials" | "email_not_confirmed" | "unknown",
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Registers a new user with email and password
 * NOTE: After registration, the user is NOT automatically logged in.
 * They must verify their email and then log in manually.
 *
 * @param supabase - SSR-enabled Supabase server client with cookie management
 * @param command - Registration command with email and password
 * @returns RegisterResponseDTO with user_id
 * @throws AuthError if registration fails
 */
export async function registerUser(
  supabase: SupabaseServerClient,
  command: RegisterCommand
): Promise<RegisterResponseDTO> {
  const siteUrl = import.meta.env.SITE_URL || "http://localhost:3000";
  
  const { data, error } = await supabase.auth.signUp({
    email: command.email,
    password: command.password,
    options: {
      // Email confirmation callback - redirect to auth callback handler
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  // Handle registration errors
  if (error) {
    // Check if email already exists
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists") ||
      error.message.toLowerCase().includes("user already registered")
    ) {
      throw new AuthError("email_exists", "An account with this email already exists");
    }

    // Generic error
    console.error("[registerUser] Supabase auth error:", error);
    throw new AuthError("unknown", "Failed to create account. Please try again later.");
  }

  // Verify user was created
  if (!data.user) {
    console.error("[registerUser] No user returned from signUp");
    throw new AuthError("unknown", "Failed to create account. Please try again later.");
  }

  // IMPORTANT: Sign out immediately to prevent auto-login
  // User must verify email and then log in manually
  await supabase.auth.signOut();

  return {
    user_id: data.user.id,
  };
}

/**
 * Authenticates a user with email and password
 * With SSR, this automatically sets auth cookies via the server client
 *
 * @param supabase - SSR-enabled Supabase server client with cookie management
 * @param command - Login command with email and password
 * @returns LoginResponseDTO with user_id (tokens are managed via cookies)
 * @throws AuthError if login fails
 */
export async function loginUser(
  supabase: SupabaseServerClient,
  command: LoginCommand
): Promise<LoginResponseDTO> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: command.email,
    password: command.password,
  });

  // Handle login errors
  if (error) {
    // Check if credentials are invalid
    if (
      error.message.toLowerCase().includes("invalid") ||
      error.message.toLowerCase().includes("incorrect") ||
      error.message.toLowerCase().includes("invalid login credentials")
    ) {
      throw new AuthError("invalid_credentials", "Invalid email or password");
    }

    // Check if email is not confirmed
    if (
      error.message.toLowerCase().includes("email not confirmed") ||
      error.message.toLowerCase().includes("not verified") ||
      error.message.toLowerCase().includes("email confirmation")
    ) {
      throw new AuthError("email_not_confirmed", "Please verify your email address before logging in");
    }

    // Generic error
    console.error("[loginUser] Supabase auth error:", error);
    throw new AuthError("unknown", "Login failed. Please try again later.");
  }

  // Verify session was created
  if (!data.session || !data.user) {
    console.error("[loginUser] No session or user returned from signIn");
    throw new AuthError("unknown", "Login failed. Please try again later.");
  }

  // Note: With SSR, tokens are automatically managed via cookies
  // We only return user_id for the response, tokens are not exposed to client
  return {
    access_token: data.session.access_token, // Still returned for compatibility
    refresh_token: data.session.refresh_token, // Still returned for compatibility
    user_id: data.user.id,
  };
}

/**
 * Logs out the current user
 * With SSR, this automatically clears auth cookies via the server client
 *
 * @param supabase - SSR-enabled Supabase server client with cookie management
 * @throws AuthError if logout fails
 */
export async function logoutUser(supabase: SupabaseServerClient): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[logoutUser] Supabase auth error:", error);
    throw new AuthError("unknown", "Logout failed. Please try again later.");
  }
}

