# View Implementation Plan – Error & Utility Views

## 1. Overview

Foundational error and utility routes/behaviors that provide clear feedback and safe navigation for unauthorized access, missing content, and unexpected server failures. Aligns with UI plan and PRD reliability/security requirements.

## 2. Routes and Behaviors

- 401 / Expired Session
  - Behavior: Middleware redirects to `/auth/login?returnUrl=...` and shows a toast/message on the login page.
  - Dedicated page route not required (handled via redirect).
- Gated content (guest access limitations)
  - Picks table: Redirect to `/auth/login?returnUrl=...`; do not render or fetch table data for guests.
  - Recent reports (< 30 days): Either render an inline gated message with Login/Register CTA or redirect to login. Older reports remain accessible.
- 403 (Admin-only access)
  - Path: `/admin/forbidden` (optional helper) or inline render within guarded admin pages.
  - Behavior: Friendly 403 page if not authorized.
- 404 (Not Found)
  - Path: Catch-all or specific missing routes (e.g., unknown `/reports/[slug]`).
  - Behavior: Render 404 page with link back to a safe destination.
- 500 (Server Error)
  - Path: Error boundary handling (framework-level) or explicit error page.
  - Behavior: Generic error message with retry guidance.

## 3. Component Structure

- 403 Page (`src/pages/admin/forbidden.astro`, optional)
  - `Header`
  - `SEOHead`
  - `ErrorBanner` or inline copy (“Admin-only area”)
  - `Footer`
- 404 Page (`src/pages/404.astro`)
  - `Header`
  - `SEOHead`
  - `ErrorBanner` or inline copy; link back to `/`
  - `Footer`
- 500 Page (`src/pages/500.astro`, optional if using global error boundary)
  - `Header`
  - `SEOHead`
  - `ErrorBanner` with generic message and retry link
  - `Footer`

## 4. Component Details

### ErrorBanner (SSR)

- Purpose: Reusable presentation of error state with semantic `role="alert"`.
- Props: `{ code?: string; message: string; actionHref?: string; actionLabel?: string }`.

### Middleware / Guards

- `src/middleware/index.ts`:
  - Redirect 401 to `/auth/login?returnUrl=...`.
  - Render friendly 403 in admin routes when authenticated but not authorized.

## 5. Types

- `ErrorViewModel = { code?: string; message: string }` (reused across pages).

## 6. State Management

- None (SSR pages). 401 flow relies on redirect and a toast message on the login page.

## 7. API Integration

- None directly; pages reflect server outcomes (404/500) and middleware decisions.

## 8. User Interactions

- Navigate back to safe routes; retry actions where applicable.

## 9. Conditions and Validation

- Ensure 404 for unknown slugs (`/reports/[slug]` not found).
- Ensure 401 redirect for expired sessions; 403 page for non-admins on `/admin/**`.

## 10. Error Handling

- Use `ErrorBanner` with readable copy; avoid leaking sensitive details.
- Provide clear CTAs (e.g., “Go to home”, “Try again”).

## 11. Implementation Steps

1. Add 404 page at `src/pages/404.astro` using layout with `Header`, `Footer`, and `ErrorBanner`.
2. (Optional) Add 500 page at `src/pages/500.astro` or rely on framework edge error rendering.
3. (Optional) Add a friendly 403 page at `src/pages/admin/forbidden.astro` and link it from guard fallback.
4. Update `src/middleware/index.ts` to enforce:
   - 401 redirect to login with `returnUrl`.
   - 403 friendly render for admin routes when authenticated but unauthorized.
   - Gating: require login for the picks table; for recent reports, either redirect to login or flag the page to render a gated message.
5. QA: trigger 401/403/404/500 scenarios and verify copy, navigation, and accessibility.
6. QA: verify gated content flows for guests (recent report detail and picks table) show CTA/redirects without leaking data.
