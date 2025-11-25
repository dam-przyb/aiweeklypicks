import type { SupabaseClient } from "@/db/supabase.client";
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
 *
 * @param supabase - Supabase client instance
 * @param command - Registration command with email and password
 * @returns RegisterResponseDTO with user_id
 * @throws AuthError if registration fails
 */
export async function registerUser(
  supabase: SupabaseClient,
  command: RegisterCommand
): Promise<RegisterResponseDTO> {
  const { data, error } = await supabase.auth.signUp({
    email: command.email,
    password: command.password,
    options: {
      // Require email confirmation before allowing login
      emailRedirectTo: `${import.meta.env.SITE_URL || "http://localhost:4321"}/auth/verify`,
    },
  });

  // Handle registration errors
  if (error) {
    // Check if email already exists
    if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists")) {
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

  return {
    user_id: data.user.id,
  };
}

/**
 * Authenticates a user with email and password
 *
 * @param supabase - Supabase client instance
 * @param command - Login command with email and password
 * @returns LoginResponseDTO with tokens and user_id
 * @throws AuthError if login fails
 */
export async function loginUser(
  supabase: SupabaseClient,
  command: LoginCommand
): Promise<LoginResponseDTO> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: command.email,
    password: command.password,
  });

  // Handle login errors
  if (error) {
    // Check if credentials are invalid
    if (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("incorrect")) {
      throw new AuthError("invalid_credentials", "Invalid email or password");
    }

    // Check if email is not confirmed
    if (error.message.toLowerCase().includes("email not confirmed") || error.message.toLowerCase().includes("not verified")) {
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

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: data.user.id,
  };
}

/**
 * Logs out the current user
 *
 * @param supabase - Supabase client instance
 * @throws AuthError if logout fails
 */
export async function logoutUser(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[logoutUser] Supabase auth error:", error);
    throw new AuthError("unknown", "Logout failed. Please try again later.");
  }
}

