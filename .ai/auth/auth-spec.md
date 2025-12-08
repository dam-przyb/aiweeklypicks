# AI Weekly Picks – Authentication Architecture Specification (Post‑MVP)

Version: 1.0  
Date: 2025‑11‑29  
Sources: `.ai/prd.md`, `.ai/tech-stack.md`, `astro.config.mjs`

Scope

- Adds/extends registration, login, logout, and password recovery using Supabase Auth.
- Implements 30‑day gating: signed‑in users have full access; guests see only reports older than 30 days and cannot access the historical picks table. Admin-only import stays protected.
- Uses Astro 5 (Node adapter, SSR), TypeScript 5, React 19, Tailwind 4, shadcn/ui.

Non‑Goals

- No OAuth providers (can be added later). No advanced profile features.

## 1. User Interface Architecture

### 1.1 Routes and pages

Astro pages (SSR) host React islands for interactive auth forms. All routes live under `src/pages`:

- `src/pages/auth/login.astro` – Login view (public)
- `src/pages/auth/register.astro` – Registration view (public)
- `src/pages/auth/forgot-password.astro` – Request password reset (public)
- `src/pages/auth/callback.astro` – Supabase email link handler; supports `type=recovery` and future OAuth/email links (public)
- `src/pages/auth/reset-password.astro` – New password entry after callback session (public but guarded to signed‑in recovery session)
- `src/pages/account/index.astro` – Minimal “My account” landing (requires login)
- `src/pages/logout.astro` – Immediate server‑side logout and redirect (POST enforced; GET safely redirects to login)

Public routes remain, but content is gated per FR‑040/FR‑041: guests only see reports older than 30 days and cannot access the historical picks table. Admin routes stay under `/admin/*` and require `admin` role.

### 1.2 Layouts and shared UI

- `src/layouts/BaseLayout.astro`
  - Receives `session` (Supabase) and optional `user` via SSR.
  - Header shows Sign in / Register when signed out; shows user menu (Account, Admin if role=admin, Logout) when signed in.
  - Footer unchanged. Disclaimers/pages per PRD unchanged.
- `src/layouts/AuthLayout.astro`
  - Minimal frame for auth pages (centered card, reduced chrome). Uses BaseLayout for header/footer consistency, but with subdued nav.

### 1.3 React components (client islands)

All components are TypeScript React 19, shadcn/ui based, Tailwind styled. Location:
`src/components/auth/*` and shared UI in `src/components/ui/*`.

- `LoginForm.tsx`
  - Props: `{ redirectTo?: string }`
  - Fields: email, password
  - Submits via `fetch('/api/auth/login', { method: 'POST' })`
  - Handles client validation and displays field/global errors
  - On success: hard redirect to `redirectTo ?? '/account'`

- `RegisterForm.tsx`
  - Props: `{ redirectTo?: string }`
  - Fields: email, password, confirmPassword, acceptTos (checkbox)
  - Calls `POST /api/auth/register`
  - Shows success state prompting email verification (per Supabase policy) and redirects to login

- `ForgotPasswordForm.tsx`
  - Fields: email
  - Calls `POST /api/auth/request-password-reset`
  - Shows success: “If an account exists, a reset link has been sent”

- `ResetPasswordForm.tsx`
  - Fields: newPassword, confirmNewPassword
  - Calls `POST /api/auth/reset-password`
  - Requires a valid recovery session (established by `auth/callback` via Supabase code exchange); otherwise shows an error and link to login

- `AccountMenu.tsx` (header dropdown)
  - Props: `{ user: { email?: string, role?: string } | null }`
  - Items: Account, Admin (if role=admin), Logout (submits POST to `/api/auth/logout` or navigates to `/logout` POST flow)

- `AuthSuccessNotice.tsx` / `AuthErrorAlert.tsx`
  - Reusable message components aligned with shadcn/ui `Alert`

### 1.4 Responsibilities and integration

- Astro pages (SSR):
  - Fetch server session using Supabase server client; pass session/user to layouts and islands.
  - Render SEO, stubs, and non‑interactive content.
  - Gate `/account` and `/admin` via middleware (see Backend).
- React forms:
  - Handle field-level validation, interaction, and submission.
  - Talk only to `/api/auth/*` endpoints, not directly to Supabase.
  - Display normalized error codes/messages from server responses.
- Navigation:
  - After login/register/reset, perform full page redirects (server state changed).
  - Preserve `redirectTo` query param when applicable.

### 1.5 Validation cases and user messages

Client‑side (fast feedback):

- Email: required, basic format.
- Password: required, min length 8 (align with server), avoid trivial strings (optional client hint).
- Confirm password: must match.
- ToS: required checkbox for registration (Post‑MVP policy; configurable).

Server‑side (authoritative), shared via Zod schemas:

- Email required, RFC‑5322 compliant (zod `email()`).
- Password required, min 8, max 128, reject known weak patterns if feasible (post‑MVP).
- Enforce confirm match for registration and reset.

Canonical error codes (HTTP 400 unless noted):

- `auth/invalid-email` – “Enter a valid email address.”
- `auth/invalid-password` – “Password must be at least 8 characters.”
- `auth/mismatch-password` – “Passwords do not match.”
- `auth/tos-required` – “You must accept the Terms of Service.”
- `auth/wrong-credentials` (401) – “Email or password is incorrect.”
- `auth/unverified-email` (403) – “Verify your email to continue. Check your inbox.”
- `auth/rate-limited` (429) – “Too many attempts. Try again soon.”
- `auth/recovery-session-missing` (401) – “Reset link invalid or expired. Request a new one.”
- `auth/server-error` (500) – Generic fallback with request id (logged server‑side).

### 1.6 Scenario handling

- Login with wrong credentials: show `auth/wrong-credentials` with no field leakage.
- Login unverified: show `auth/unverified-email`, include “Resend verification” CTA (post‑MVP optional).
- Registration success: show “Check your email to verify your account.” Insert `registration_complete` event (see Backend).
- Password reset request: show non‑enumerating success (“If an account exists, we sent an email”). Always 200 unless validation fails.
- Reset link followed: `auth/callback` exchanges code for a session; redirect to `auth/reset-password` to set new password; after save, log in and redirect to `/account`.
- Logout: POST required; safe GET fallback redirects to login with info banner.
- Admin access by non‑admin: 403 page with link to Home or Login.

## 2. Backend Logic

### 2.1 API endpoints (`src/pages/api/auth/*`)

All handlers use Astro server runtime (Node adapter, `output: "server"`). Return JSON with `{ ok: boolean, data?: T, error?: { code: string, message: string, fieldErrors?: Record<string,string> } }`.

- `POST /api/auth/register`
  - Body: `{ email, password, confirmPassword, acceptTos }`
  - Validates input; calls Supabase `auth.signUp({ email, password, options: { emailRedirectTo: <APP_URL>/auth/callback }} )`
  - On success: insert `registration_complete` event; respond `ok: true`

- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Validates; rate‑limit per IP and email; calls `auth.signInWithPassword`
  - On success: set Supabase cookies (managed by SSR client); insert `login` event; respond `ok: true`
  - On unverified policy violations: `auth/unverified-email`

- `POST /api/auth/logout`
  - No body. Requires active session.
  - Calls `auth.signOut` server‑side; clears cookies; `ok: true`

- `POST /api/auth/request-password-reset`
  - Body: `{ email }`
  - Validates; rate‑limit per IP and email.
  - Calls `auth.resetPasswordForEmail(email, { redirectTo: <APP_URL>/auth/callback?type=recovery })`
  - Always `ok: true` on success path (no account enumeration); validation errors return 400.

- `POST /api/auth/reset-password`
  - Body: `{ newPassword, confirmNewPassword }`
  - Requires valid recovery session (see 2.3).
  - Calls `auth.updateUser({ password: newPassword })`; responds `ok: true` then redirects client to `/account`

- `GET /api/auth/session` (optional utility)
  - Returns `{ user, session }` for client hydration (if needed).

### 2.2 Validation (`src/lib/validation/authSchemas.ts`)

Use Zod schemas mirrored by client types:

- `RegisterSchema`: email, password (min 8), confirmPassword (refine match), acceptTos (true)
- `LoginSchema`: email, password
- `RequestResetSchema`: email
- `ResetPasswordSchema`: newPassword (min 8), confirmNewPassword (match)

All API routes parse JSON, validate with Zod, and short‑circuit with 400 and `fieldErrors` on failure.

### 2.3 Session, cookies, and callback flow

- Server client: `src/db/supabaseServer.ts` uses `@supabase/ssr` `createServerClient` with Astro `cookies`.
- Browser client: `src/db/supabaseBrowser.ts` uses `createBrowserClient` for islands if needed.
- Callback: `src/pages/auth/callback.astro`
  - Reads URL params (`code`, `type`). If `type=recovery` and `code` present, uses server client `auth.exchangeCodeForSession(code)` to establish a server session bound to cookies.
  - On success: redirect to `/auth/reset-password`.
  - On failure: redirect to `/auth/forgot-password?err=auth/recovery-session-missing`.

### 2.4 Middleware and authorization (`src/middleware/index.ts`)

Middleware runs on every request:

- Hydrates `locals.user` and `locals.session` using server client.
- Protects routes:
  - `/account/**` requires authenticated user → else 302 to `/auth/login?redirectTo=<requested>`
  - `/admin/**` requires `user.app_metadata.role === 'admin'` → else 403 response page
  - Access gating (FR‑041):
    - Historical picks table route requires login; guests are redirected to `/auth/login?redirectTo=<requested>`
    - Reports:
      - Guests: list/detail limited to reports with `published_at <= now() - 30 days`; attempting to access newer reports triggers an inline gated message with CTA to sign in or a redirect to login (implementation choice per UX).
      - Signed‑in: full access.

### 2.5 Event logging (`src/lib/events.ts` and DB table per PRD FR‑070)

Provide a small service to insert events:

- `recordEvent({ eventType, userId?, dwellSeconds?, userAgent, ipHash, metadata?, isStaffIp?, isBot? })`
- Triggered in:
  - `POST /api/auth/register` → `registration_complete`
  - `POST /api/auth/login` → `login`
  - Existing UI should continue logging `report_view` and `table_view` elsewhere (unchanged).

Compute `ipHash` using a stable secret salt and SHA‑256; mark bots/staff IPs via simple heuristics and allowlist.

### 2.6 Rate limiting (`src/lib/rateLimit.ts`)

Lightweight, best‑effort limiter for POST auth endpoints:

- Per IP and per key (email) buckets, sliding window (e.g., 5/minute).
- Node adapter allows in‑memory store for single instance; recommend Redis when horizontally scaled (post‑MVP).
- On exceed, respond 429 `auth/rate-limited` with `Retry-After` header.

### 2.7 Error handling policy

All API handlers:

- Wrap Supabase and DB calls; map known Supabase errors to canonical codes.
- Return consistent JSON shape.
- Log server errors with correlation id; never leak Supabase internal messages to client.

### 2.8 SSR updates (per `astro.config.mjs`)

Since `output: "server"` and Node adapter (standalone) are enabled:

- Astro SSR can read and set cookies; Supabase server client manages auth cookies automatically.
- `BaseLayout.astro` should receive `session`/`user` from page frontmatter `get()` (or via middleware‑enhanced props) to render header state.
- Avoid client‑only auth for navigation; rely on SSR for correctness and FOUC‑free UI.

## 3. Authentication System (Supabase)

### 3.1 Clients and setup

- Install `@supabase/supabase-js` and `@supabase/ssr` (already part of stack expectation).
- `src/db/supabaseServer.ts`
  - Exports `getSupabaseServerClient(AstroCookies)` using `createServerClient(supabaseUrl, supabaseAnonKey, { cookies })`.
- `src/db/supabaseBrowser.ts`
  - Exports `getSupabaseBrowserClient()` using `createBrowserClient(...)` for islands if needed.

Environment:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `APP_URL` for redirect building

### 3.2 Flows

- Registration
  - Server: `auth.signUp` with `emailRedirectTo: <APP_URL>/auth/callback`
  - Email verification required (default). UI shows verification notice.
  - Event: `registration_complete`

- Login
  - Server: `auth.signInWithPassword`
  - On success, cookies set. Event: `login`

- Logout
  - Server: `auth.signOut`; clear cookies; redirect to `/`

- Password recovery
  - Request: `auth.resetPasswordForEmail(email, { redirectTo: <APP_URL>/auth/callback?type=recovery })`
  - Callback: `exchangeCodeForSession`; redirect to `/auth/reset-password`
  - Update: `auth.updateUser({ password })`; keep user logged in and redirect to `/account`

### 3.3 Roles and admin

- Role stored in `auth.users.app_metadata.role` (string: `admin` | `user`, default `user`).
- Admin assignment via Supabase dashboard or secure admin tool (post‑MVP).
- Middleware checks role for `/admin/**` and admin API routes.

### 3.4 Security considerations

- HTTPS enforced at platform; `Secure`, `HttpOnly`, `SameSite=Lax` cookies via Supabase SSR client defaults.
- CSRF: Require POST for state‑changing endpoints; verify `Origin`/`Referer`. Optionally add double‑submit CSRF token (post‑MVP).
- Brute force mitigation: rate limiter + uniform error messages.
- Account enumeration: use identical success responses for reset requests.
- Logging: never log passwords or tokens; log request ids and coarse outcome only.

### 3.5 Accessibility and UX

- All forms keyboard navigable; labels and aria‑describedby for errors.
- Focus management on error/success; announce via aria‑live regions in alerts.
- Preserve `redirectTo` param through flows for smoother returns.

## 4. Modules, contracts, and file map

Folders (align with workspace rules):

- `src/pages/auth/*` – Astro pages for auth flows
- `src/pages/api/auth/*` – JSON API handlers
- `src/middleware/index.ts` – Session hydration and route guards
- `src/db/*` – Supabase clients (server/browser)
- `src/lib/validation/*` – Zod schemas
- `src/lib/rateLimit.ts` – Rate limiter
- `src/lib/events.ts` – Event logging service
- `src/layouts/*` – Base and Auth layouts
- `src/components/auth/*` – Auth React islands
- `src/components/ui/*` – shadcn/ui wrappers

Contracts (examples):

- API response: `{ ok: boolean, data?: T, error?: { code: string, message: string, fieldErrors?: Record<string,string> } }`
- Auth schemas: Zod objects described in 2.2
- Event: `{ eventType: 'registration_complete' | 'login' | 'report_view' | 'table_view', ... }`

## 5. Compatibility with PRD and existing behavior

- Post‑MVP update activates 30‑day gating (FR‑041): guests see older reports only and cannot access the historical picks table; signed‑in users have full access.
- Admin import remains role‑gated; middleware enforces `admin` role (US‑009).
- Event logging extended to include `registration_complete` and `login` (FR‑070/US‑018).
- Authentication errors are clear and actionable (US‑006, US‑008, US‑024).
- SSR preserved with Node adapter; header reflects auth state without client flicker.
- ISO dates, disclaimers, legal pages unaffected.

### 5.1 User Stories Impact (Post‑MVP)

Implementation of this spec modifies the acceptance criteria of MVP-era User Stories:

- **US‑001 (Guest views reports list):** Modified. Guests view a _filtered_ list (excluding reports < 30 days old) rather than the full list defined in MVP.
- **US‑003 (Guest views historical table):** Superseded by **US‑032**. Guests are redirected to login; they can no longer view the table anonymously.
- **US‑025 (Public content affirmation):** Superseded by **US‑031** and **FR‑041**. Content is no longer fully public; 30‑day gating is enforced.

## 6. Future work (post‑spec, not included here)

- Add OAuth providers.
- Move rate limiting to Redis and add captcha after N failures.
- Add email verification resend and UI surface.
- Profiles table and richer account settings.
- CSRF double‑submit tokens on all POST forms.
