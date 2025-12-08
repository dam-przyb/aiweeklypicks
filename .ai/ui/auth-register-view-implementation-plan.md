# View Implementation Plan – Auth: Register (/auth/register)

## 1. Overview

A public registration page that creates an account via email/password using a React island form with client-side validation (Zod). On success, it emits a `registration_complete` event (server-side) and guides the user about email verification. The page is SSR for layout/SEO; the form is a client island.

## 2. View Routing

- Path: `/auth/register`
- File: `src/pages/auth/register.astro`
- Access: Public; if already authenticated, optionally redirect to `/`.

## 3. Component Structure

- `src/pages/auth/register.astro`
  - `Header`
  - `SEOHead`
  - `AuthForm` (React island; `mode="register"`)
  - `Footer`

## 4. Component Details

### AuthForm (React island)

- Purpose: Register a user with accessible client validation and friendly error feedback.
- Main elements:
  - Fields: `email`, `password`, optional `confirmPassword`.
  - Validation: email format; password policy hints; `password === confirmPassword` (if included).
  - UI: Shadcn/ui inputs/buttons; inline errors; toasts for success/error.
- Interactions:
  - On submit: POST `/api/auth/register` with `{ email, password }`.
  - On success: show success toast and message about email verification; redirect to `/` or `returnUrl` (optional).
- Types:
  - Props: `{ mode: 'register'; returnUrl?: string }`.
  - Input VM: `{ email: string; password: string; confirmPassword?: string }`.
- A11y:
  - Proper `label`/`id`; `aria-invalid`; `aria-live="polite"` for messages.

## 5. Types

- API DTOs (server-defined):
  - `RegisterCommand = { email: string; password: string }`
  - `RegisterResultDTO = { success: true }` (HTTP 200)
  - Errors: `{ code: 'bad_request'|'rate_limited'|'conflict', message: string }` (e.g., email already in use)

## 6. State Management

- Client state (island): input values, validation errors, submit in-flight flag, toasts.
- No global state; Supabase handles session/verification email server-side.

## 7. API Integration

- POST `/api/auth/register`
  - Request: `RegisterCommand`
  - Response 200: `{ success: true }` and `registration_complete` event recorded (FR-070).
  - Errors: 400 invalid input, 409 conflict (email exists), 429 rate limited.

## 8. User Interactions

- Fill in email/password → submit.
- On success: see confirmation; optional redirect; may prompt to check email for verification.

## 9. Conditions and Validation

- Disable submit when in-flight or when fields invalid.
- Password policy guidance (client-side hints; server enforces).
- Map server errors to friendly copy (e.g., “Email already registered.”).

## 10. Error Handling

- Client validation errors: inline messages; focus first invalid field.
- Server errors: show `Toast` and inline message; do not reveal internal details.
- Network failures: show generic error; allow retry.

## 11. Implementation Steps

1. Create `src/pages/auth/register.astro` with `Header`, `SEOHead`, `AuthForm`, `Footer`.
2. Extend `src/components/auth/AuthForm.tsx` to support `mode="register"`.
   - Zod schema for email/password/(confirm); Shadcn/ui components.
   - Submit handler calls `/api/auth/register`; shows success message and redirects if desired.
3. Ensure server route `/api/auth/register` emits `registration_complete` and sends email verification via Supabase.
4. A11y: labels, described-by, `aria-live` for errors; focus management on errors/success.
5. QA: duplicate email, rate-limit, redirect behavior, keyboard-only flow.
