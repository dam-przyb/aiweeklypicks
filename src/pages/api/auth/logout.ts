export const prerender = false;

import type { APIRoute } from "astro";
import { logoutUser, AuthError } from "@/lib/services/auth";

/**
 * POST /api/auth/logout
 *
 * Logs out the current user by clearing their session.
 * Redirects to the home page with a success message.
 *
 * Authentication: Requires active session (but doesn't fail if no session)
 *
 * Responses:
 * - 302 Redirect: Always redirects to home page
 *
 * Side Effects:
 * - Clears Supabase session cookies
 * - Destroys the user's session server-side
 */
export const POST: APIRoute = async (context) => {
  const { locals, redirect } = context;

  try {
    // Attempt to log out using the SSR client
    await logoutUser(locals.supabase);

    // Redirect to home page with success message
    return redirect("/?logout=success", 302);
  } catch (err) {
    // Log the error but still redirect (graceful degradation)
    if (err instanceof AuthError) {
      console.error("[POST /api/auth/logout] Auth error:", err.message);
    } else {
      console.error("[POST /api/auth/logout] Unexpected error:", err);
    }

    // Even on error, redirect to home (cookies might already be cleared client-side)
    return redirect("/?logout=error", 302);
  }
};

/**
 * GET /api/auth/logout (fallback for direct navigation)
 *
 * Redirects to login page with info message since logout requires POST.
 * This handles cases where users directly navigate to the logout URL.
 */
export const GET: APIRoute = async (context) => {
  const { redirect } = context;

  // Redirect to login with informative message
  return redirect("/auth/login?info=Please%20use%20the%20logout%20button", 302);
};

