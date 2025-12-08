## API Endpoint Implementation Plan: POST /api/admin/imports

### 1. Endpoint Overview

Uploads a weekly report JSON (via multipart form-data file upload or direct JSON body) and atomically imports it into the database using a SECURITY DEFINER RPC `admin_import_report(payload JSONB, filename TEXT)`. The RPC writes an audit row to `imports_audit`, inserts/updates `weekly_reports` and `stock_picks` consistently, and refreshes `picks_history` on success. Admin-only endpoint.

### 2. Request Details

- **HTTP Method**: POST
- **URL**: `/api/admin/imports`
- **Headers**:
  - `Authorization: Bearer <access_token>` (required; admin)
  - `Content-Type`: one of:
    - `multipart/form-data` (preferred for file upload)
    - `application/json` (JSON body variant)
- **Body Variants**:
  - `multipart/form-data` fields:
    - `file` (required): `.json` file
    - `filename` (optional): string; when omitted, use `file.name`
  - `application/json` body:
    - `{ "filename": string, "payload": object }`
- **Filename Requirements**:
  - Must match regex: `^\\d{4}-\\d{2}-\\d{2}report\\.json$`
- **Size Limits**:
  - Hard server limit: ≤ 5 MB (DB constraint)
  - Recommended UI soft limit: ≤ 2 MB (enforced by client; server still guards 5 MB)
- **Rate Limiting**: 30/min per admin (enforced via middleware/local store or platform rate limiter)

### 3. Used Types

- From `src/types.ts`:
  - **AdminImportJsonCommand**: `{ filename: string; payload: Json; }`
  - **AdminImportSuccessResponse**: `{ import_id: UUID; status: "success"; report_id: UUID; report_slug: string; }`
  - **AdminImportFailedResponse**: `{ import_id: UUID; status: "failed"; error: string; }`
  - **AdminImportResponse**: union of success/failed
- Entities used by RPC (DB-managed): `weekly_reports`, `stock_picks`, `imports_audit`, `picks_history` (MV)

### 4. Response Details

- **201 Created** (success):
  - Body: `AdminImportSuccessResponse`
- **400 Bad Request**:
  - Invalid content type, missing required fields, bad JSON, invalid filename format
- **401 Unauthorized**:
  - Missing/invalid bearer token
- **403 Forbidden**:
  - Authenticated but not admin (`profiles.is_admin = false`)
- **409 Conflict**:
  - Duplicate report per RPC classification (e.g., same `report_id` or unique constraints)
- **413 Payload Too Large**:
  - File/body exceeds server 5 MB limit
- **422 Unprocessable Entity**:
  - Schema/field validation errors surfaced from RPC (JSON schema v1, enums, cross-field checks)
- **500 Internal Server Error**:
  - Unexpected server/RPC error

Notes:

- For RPC-handled failures (business validation), return an error HTTP status (409/422) and include body shaped like `AdminImportFailedResponse` (so clients can show `import_id` from the audit row).

### 5. Data Flow

1. Client sends request with bearer token and either `multipart/form-data` or `application/json`.
2. Middleware constructs a per-request Supabase client bound to the bearer token and sets `context.locals.supabase`.
3. Handler validates admin via `profiles` lookup (or helper service): ensure `profiles.is_admin = true` for `auth.uid()`.
4. Handler parses input based on `Content-Type`:
   - `multipart/form-data`: read `file`, optional `filename`; read file into string; size-check; parse JSON.
   - `application/json`: validate `filename` and `payload` shape; size-check via `JSON.stringify(payload)` length.
5. Validate `filename` matches regex.
6. Call RPC `admin_import_report(payload, filename)` via `supabase.rpc`.
7. Map RPC result:
   - On success: 201 with `{ import_id, status: "success", report_id, report_slug }`.
   - On classified failure: 409/422 with `{ import_id, status: "failed", error }`.
   - On unclassified RPC error: 500 with error message (sanitized).
8. Optionally emit an operational log entry (server logs) including `import_id`, actor `user_id`, and status.

### 6. Security Considerations

- **Authentication**: Require `Authorization: Bearer` and construct per-request Supabase client using the token (do not use global anon client for auth checks).
- **Authorization**: Check admin via `profiles` table for `auth.uid()`; deny with 403 if not admin.
- **Input Validation**: Strict `Content-Type` checks; enforce filename regex; enforce size limits; JSON parse errors handled gracefully.
- **RPC Boundary**: Use SECURITY DEFINER RPC for all writes to respect RLS and encapsulate business rules.
- **Data Leakage**: Do not echo uploaded JSON in error responses. Return minimal error strings; log detailed errors server-side only.
- **Rate Limiting**: Apply 30/min per admin (keyed by `user_id`); return 429 when exceeded if implemented.
- **File Handling**: Accept only `.json`; reject other extensions; normalize filename strictly (no path separators).
- **CSRF**: Not applicable for Bearer-auth API; still ensure `POST` only and disable pre-rendering.

### 7. Error Handling

- Map validation failures to 400; include a machine-readable `code` and human-readable `message`.
- On admin check failure, respond 403 without indicating existence of target resources.
- For RPC failures, prefer mapping:
  - Duplicate/uniqueness violations → 409
  - Schema/field validation → 422
  - Size violations (pre-DB) → 413
  - Unknown/unhandled → 500
- Always include `import_id` when available from RPC failure for traceability.
- Log errors with structured context: `{ route: "/api/admin/imports", user_id, filename, import_id?, error_code, message }`.

### 8. Performance Considerations

- Limit request body to 5 MB; avoid buffering multiple copies of the payload. For multipart, stream to memory once, then parse.
- Keep RPC call singular and atomic; MV refresh occurs inside the DB function.
- Set conservative `Cache-Control: no-store` (admin-only; not cacheable).
- Use lightweight JSON validation (zod) before RPC to fail fast.
- Consider async logging to avoid blocking response.

### 9. Implementation Steps

1. Middleware: per-request Supabase client
   - Update `src/middleware/index.ts` to read `Authorization` header and create a new Supabase client with `global.headers.Authorization = "Bearer <token>"`, assigning it to `context.locals.supabase`.
   - Keep `export const onRequest` as-is structurally; ensure `export const prerender = false` remains at route level (not middleware).
2. Create services
   - `src/lib/services/authz.ts`
     - `getCurrentUserId(supabase)`: calls SECURITY DEFINER RPC `get_current_user_identity()` to resolve `{ user_id }` reliably; fallback to `supabase.auth.getUser()` if configured.
     - `requireAdmin(supabase)`: queries `profiles` for `user_id`; throws 403 if not found or `is_admin = false`.
   - `src/lib/services/imports.ts`
     - `adminImportReport(supabase, payload: Json, filename: string): Promise<AdminImportResponse | AdminImportFailedResponse>`; internally calls `supabase.rpc('admin_import_report', { payload, filename })` and normalizes return shape.
3. Zod validation
   - `src/lib/validation/imports.ts`
     - `filenameSchema` enforcing `^\\d{4}-\\d{2}-\\d{2}report\\.json$`.
     - `jsonVariantSchema` for `{ filename: string; payload: unknown }` (coerce unknown → Json-safe check).
     - Helpers for size checks (byte length of stringified JSON ≤ 5 MB).
4. API route handler
   - File: `src/pages/api/admin/imports.ts`
   - `export const prerender = false`
   - `export async function POST(context)`:
     - Extract `supabase` from `context.locals`.
     - `await requireAdmin(supabase)`.
     - Inspect `Content-Type`:
       - If `multipart/form-data`:
         - `const form = await context.request.formData()`
         - Ensure `file` is present and `.json`; derive `filename` as provided or from `file.name`.
         - Enforce size: `file.size <= 5 * 1024 * 1024`.
         - Read text: `const text = await file.text()`; try `JSON.parse(text)` to `payload`.
       - If `application/json`:
         - Parse body as `AdminImportJsonCommand`.
         - Size-check via `Buffer.byteLength(JSON.stringify(payload))`.
     - Validate `filename` against regex.
     - Call `adminImportReport(supabase, payload, filename)`.
     - Map result:
       - Success → 201 with success body.
       - Failure with duplicate/schema → 409/422 respectively with failed body.
       - Else → 500 with minimal error.
     - Set `Content-Type: application/json`.
5. Rate limiting (optional initial cut)
   - Add simple in-memory token bucket keyed by `user_id` in middleware or handler; return 429 when exceeded.
   - Document replacement with platform limiter in production.
6. Testing
   - Unit tests for validation utilities (filename, size, JSON variant schema).
   - Integration tests covering both content types and all error codes.
   - Manual tests with sample files around size limits; duplicate imports; invalid schema.
7. Observability
   - Add structured server logs on outcomes with `import_id`.
   - Consider adding an ops-only endpoint or log sink in future for auditing.

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/admin/imports.ts
export const prerender = false;

import type { APIRoute } from "astro";
import { filenameSchema, jsonVariantSchema } from "@/lib/validation/imports";
import { requireAdmin } from "@/lib/services/authz";
import { adminImportReport } from "@/lib/services/imports";

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const supabase = locals.supabase;

  try {
    await requireAdmin(supabase);

    const contentType = request.headers.get("content-type") || "";

    let filename: string;
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return new Response(JSON.stringify({ code: "bad_request", message: "file is required" }), { status: 400 });
      }
      if (!("name" in file) || !String(file.name).endsWith(".json")) {
        return new Response(JSON.stringify({ code: "bad_request", message: "file must be a .json" }), { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ code: "payload_too_large", message: "file exceeds 5MB" }), {
          status: 413,
        });
      }
      filename = String(form.get("filename") || file.name);
      const text = await file.text();
      try {
        payload = JSON.parse(text);
      } catch {
        return new Response(JSON.stringify({ code: "bad_json", message: "invalid JSON" }), { status: 400 });
      }
    } else if (contentType.includes("application/json")) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ code: "bad_json", message: "invalid JSON" }), { status: 400 });
      }
      const parsed = jsonVariantSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ code: "bad_request", message: "invalid body" }), { status: 400 });
      }
      filename = parsed.data.filename;
      payload = parsed.data.payload;
      const size = Buffer.byteLength(JSON.stringify(payload));
      if (size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ code: "payload_too_large", message: "payload exceeds 5MB" }), {
          status: 413,
        });
      }
    } else {
      return new Response(
        JSON.stringify({ code: "unsupported_media_type", message: "use multipart/form-data or application/json" }),
        { status: 400 }
      );
    }

    const f = filenameSchema.safeParse(filename);
    if (!f.success) {
      return new Response(
        JSON.stringify({ code: "invalid_filename", message: "filename must match YYYY-MM-DDreport.json" }),
        { status: 400 }
      );
    }

    const rpc = await adminImportReport(supabase, payload as any, f.data);

    if (rpc.status === "success") {
      return new Response(JSON.stringify(rpc), { status: 201, headers: { "content-type": "application/json" } });
    }

    // Map known error categories if surfaced by service
    const status = /duplicate/i.test(rpc.error) ? 409 : /schema|validation/i.test(rpc.error) ? 422 : 500;
    return new Response(JSON.stringify(rpc), { status, headers: { "content-type": "application/json" } });
  } catch (err: any) {
    if (err?.code === "forbidden") {
      return new Response(JSON.stringify({ code: "forbidden", message: "admin required" }), { status: 403 });
    }
    if (err?.code === "unauthorized") {
      return new Response(JSON.stringify({ code: "unauthorized", message: "invalid or missing token" }), {
        status: 401,
      });
    }
    return new Response(JSON.stringify({ code: "server_error", message: "unexpected error" }), { status: 500 });
  }
};
```

### 11. Files to Add/Update

- Update: `src/middleware/index.ts` to bind per-request Supabase client with bearer token.
- New: `src/lib/services/authz.ts`
- New: `src/lib/services/imports.ts`
- New: `src/lib/validation/imports.ts`
- New: `src/pages/api/admin/imports.ts`

### 12. Admin Check Query (Service Outline)

- `requireAdmin(supabase)` implementation outline:
  - Resolve `user_id` via RPC `get_current_user_identity()` or `supabase.auth.getUser()` depending on environment.
  - `select is_admin from profiles where user_id = :user_id` with RLS-allowed path for admin check.
  - Throw `{ code: 'forbidden' }` when falsey.

### 13. RPC Contract Assumptions

- `admin_import_report(payload JSONB, filename TEXT)` returns on success:
  - `{ import_id UUID, report_id UUID, report_slug TEXT, status TEXT = 'success' }`
- On failure:
  - `{ import_id UUID, status TEXT = 'failed', error TEXT }`
- It writes `imports_audit` with status and optional `error_message` and refreshes `picks_history` on success.
