# View Implementation Plan – Auth: Login (/auth/login)

## 1. Overview

A public login page that authenticates a user via email/password using a React island form with client-side validation (Zod). On success, it sets the session (via Supabase on the server), emits a `login` event (server-side), and redirects to the `returnUrl` or `/`. The page is SSR for layout/SEO; the form itself is a client island.

## 2. View Routing

- Path: `/auth/login`
- File: `src/pages/auth/login.astro`
- Access: Public; if the user is already authenticated, optionally redirect to `/`.

## 3. Component Structure

- `src/pages/auth/login.astro`
  - `Header`
  - `SEOHead`
  - `AuthForm` (React island; `mode="login"`)
  - `Footer`

## 4. Component Details

### AuthForm (React island)

- Purpose: Handle user login with accessible client-side validation and friendly error feedback.
- Main elements:
  - Fields: `email`, `password`, submit button.
  - Validation: email format; password non-empty (policy is enforced server-side).
  - UI: Shadcn/ui inputs/buttons; inline errors; toasts for success/error.
- Interactions:
  - On submit: POST `/api/auth/login` with `{ email, password }`.
  - On success: show toast, navigate to `returnUrl` (from query string) or `/`.
  - On failure: show inline error and toast; handle 400/401/429 messages.
- Types:
  - Props: `{ mode: 'login'; returnUrl?: string }`.
  - Input VM: `{ email: string; password: string }`.
- A11y:
  - Proper `label`/`id`; `aria-invalid` for errors; `aria-live="polite"` for validation messages; keyboard operable.

## 5. Types

- API DTOs (server-defined):
  - `LoginCommand = { email: string; password: string }`
  - `LoginResultDTO = { success: true }` (HTTP 200)
  - Errors: `{ code: 'bad_request'|'unauthorized'|'rate_limited', message: string }`

## 6. State Management

- Client state (island): input values, validation errors, submit in-flight flag, toasts.
- No global state; rely on Supabase session management on the server.

## 7. API Integration

- POST `/api/auth/login`
  - Request: `LoginCommand`
  - Response 200: `{ success: true }` with session established server-side and `login` event recorded (FR-070).
  - Errors: 400 invalid input, 401 unauthorized, 429 rate limited.

## 8. User Interactions

- Fill in email/password → submit.
- On success: redirect to `returnUrl` (query param) or `/`.
- Clicks on links to register or reset password (if provided).

## 9. Conditions and Validation

- Disable submit when in-flight or when required fields invalid/empty.
- Map server errors to friendly copy:
  - 401: “Invalid email or password.”
  - 429: “Too many attempts. Please try again later.”

## 10. Error Handling

- Client validation errors: inline messages; focus first invalid field.
- Server errors: show `Toast` and inline form error; never leak sensitive info.
- Network failures: show generic error and allow retry.

## 11. Implementation Steps

1. Create `src/pages/auth/login.astro` with `Header`, `SEOHead`, `AuthForm`, `Footer`.
2. Implement `src/components/auth/AuthForm.tsx` supporting `mode="login"`.
   - Zod validation for email/password; Shadcn/ui components.
   - Submit handler calls `/api/auth/login`; handles redirect and toasts.
3. Ensure server route `/api/auth/login` emits `login` event and sets session.
4. A11y: labels, described-by, `aria-live` for errors; focus management on errors.
5. QA: wrong credentials, rate-limit message, redirect behavior, keyboard-only flow.


