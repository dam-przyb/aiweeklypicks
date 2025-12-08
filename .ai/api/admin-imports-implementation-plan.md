## API Endpoint Implementation Plan: GET /api/admin/imports

### 1. Endpoint Overview

Admin-only endpoint to list entries from the `imports_audit` table with pagination and filters.  
It allows administrators to review recent report import attempts, including status, timing, and error information, to support operations and debugging.

### 2. Request Details

- **HTTP Method**: GET
- **URL Structure**: `/api/admin/imports`
- **Authentication**: `Authorization: Bearer <access_token>` (Supabase JWT)
- **Authorization**: Caller must be an admin (`profiles.is_admin = true` for `auth.uid()`), enforced via `requireAdmin` and RLS.

- **Parameters**
  - **Required**
    - **None** – the endpoint returns the first page with default settings if no query parameters are provided.
  - **Optional (query string)**
    - **`page`**: number (1-based page index)
      - Default: `1`
      - Constraints: integer, `page >= 1`
    - **`page_size`**: number (items per page)
      - Default: `20`
      - Constraints: integer, `1 <= page_size <= 100`
    - **`status`**: string
      - Allowed values: `"success" | "failed"` (matches `ImportStatus` / `import_status_enum`)
    - **`started_before`**: string
      - ISO 8601 datetime (with or without offset) to filter imports started at or before this timestamp.
    - **`started_after`**: string
      - ISO 8601 datetime (with or without offset) to filter imports started at or after this timestamp.
    - **`uploader`**: string
      - UUID of `uploaded_by_user_id` to filter imports for a single uploader.

- **Request Body**: None (all inputs are query parameters).

### 3. Used Types

From `src/types.ts`:

- **Entity / DTO Types**
  - **`ImportAuditEntity`**: Entity mapped to the `imports_audit` table.
  - **`ImportsAuditDTO`**: DTO for individual audit rows exposed via the API:
    - `import_id`
    - `uploaded_by_user_id`
    - `filename`
    - `source_checksum`
    - `schema_version`
    - `status`
    - `error_message`
    - `started_at`
    - `finished_at`
  - **`AdminImportsListResponseDTO`**: Paginated response envelope:
    - `items: ImportsAuditDTO[]`
    - `page`
    - `page_size`
    - `total_items`
    - `total_pages`

- **Query Types**
  - **`AdminImportsListQuery`**:
    - `page?: number`
    - `page_size?: number`
    - `status?: ImportStatus`
    - `started_before?: ISODateString`
    - `started_after?: ISODateString`
    - `uploader?: UUID`

- **Supporting Types**
  - **`ImportStatus`**: `"success" | "failed"` (from `Enums<"import_status_enum">`).
  - **`UUID`**, **`ISODateString`**, **`Paginated<T>`**.
  - **`SupabaseClient`** from `src/db/supabase.client.ts` (used in services).

### 4. Response Details

- **Success**
  - **Status Code**: `200 OK`
  - **Body**: `AdminImportsListResponseDTO`
    - `items`: array of `ImportsAuditDTO` objects
    - `page`: number (echoes effective page)
    - `page_size`: number
    - `total_items`: total number of matching rows
    - `total_pages`: `ceil(total_items / page_size)` (at least `1` when there are results; `0` or `1` strategy can be chosen but must be consistent with existing admin endpoints)

- **Errors (standardized JSON error envelope)**
  - **400 Bad Request**
    - Cause: invalid query parameters (e.g., non-numeric `page`, malformed ISO datetime, invalid UUID, invalid `status`).
    - Body: `{ "code": "bad_request", "message": string }`
  - **401 Unauthorized**
    - Cause: missing/invalid JWT, or failure to resolve authenticated user.
    - Body: `{ "code": "unauthorized", "message": string }`
  - **403 Forbidden**
    - Cause: authenticated user is not an admin.
    - Body: `{ "code": "forbidden", "message": string }`
  - **429 Too Many Requests**
    - Cause: rate limit exceeded (admin endpoints limited to 30 requests/min per admin).
    - Body: `{ "code": "rate_limited", "message": string }`
  - **500 Internal Server Error**
    - Cause: database failures or unexpected runtime errors.
    - Body: `{ "code": "server_error", "message": string }`

> Note: A 404 status is not used for an empty result set; an empty `items` array with `200 OK` is returned when no rows match the filters.

### 5. Data Flow

1. **HTTP Request → Astro API Route**
   - Request hits `GET /api/admin/imports`, implemented in `src/pages/api/admin/imports.ts` in the same module that already defines `POST`.
   - Handler is exported as `export const GET: APIRoute`.

2. **Query Parsing and Validation**
   - The handler constructs a `URL` from `request.url`.
   - It calls a helper `parseAdminImportsQuery(url)` in a new validation module `src/lib/validation/admin/imports.ts`.
   - `parseAdminImportsQuery`:
     - Reads `page`, `page_size`, `status`, `started_before`, `started_after`, `uploader` from `url.searchParams`.
     - Normalizes and validates via Zod against `AdminImportsListQuery` constraints.
     - Throws `ValidationError` on failure, to be mapped to HTTP 400.

3. **Authentication and Authorization**
   - The handler obtains the Supabase client from `context.locals.supabase`.
   - It calls `requireAdmin(supabase)` (from `src/lib/services/authz.ts`).
     - Internally, `requireAdmin`:
       - Calls `supabase.auth.getUser()` to obtain `auth.uid()`.
       - Checks `profiles` table for `is_admin = true`.
       - Throws `UnauthorizedError` or `ForbiddenError` on failure.

4. **Rate Limiting**
   - After confirming the user is authenticated and admin, the handler retrieves the user again (or reuses the id obtained via `requireAdmin`, depending on existing ergonomics).
   - It calls `limitPerKey` from `src/lib/services/rateLimit.ts` with:
     - `key = "admin:imports:<user_id>"`
     - `max = 30`, `windowMs = 60_000`.
   - If `limitPerKey` returns `false`, a `RateLimitError` is thrown and mapped to HTTP 429.

5. **Service Call**
   - With a validated query and authorized user, the handler calls a new service:
     - `listAdminImports(supabase, query)` in `src/lib/services/admin/imports.ts`.
   - `listAdminImports`:
     - Constructs pagination indices: `from = (page - 1) * page_size`, `to = from + page_size - 1`.
     - Builds a Supabase query on `imports_audit`:
       - `select` the required columns (matching `ImportsAuditDTO`).
       - `order('started_at', { ascending: false })` by default.
       - `range(from, to)` for pagination.
       - Applies filters:
         - `.eq('status', status)` when provided.
         - `.gte('started_at', started_after)` / `.lte('started_at', started_before)` when provided.
         - `.eq('uploaded_by_user_id', uploader)` when provided.
       - Requests `count: 'exact'` to compute `total_items`.
     - Executes the query and:
       - On error: throws `DatabaseError` with a `cause`.
       - On success: maps `data` to `ImportsAuditDTO[]`, computes `total_pages`, and returns an `AdminImportsListResponseDTO`.

6. **HTTP Response**
   - The handler wraps the service result into a `Response` via a shared `jsonResponse` helper (already present in `src/pages/api/admin/imports.ts` for `POST`).
   - Response headers:
     - `content-type: application/json`
     - `cache-control: no-store` (admin endpoint; never cache).

### 6. Security Considerations

- **Authentication**
  - Enforced via Supabase JWT in `Authorization` header.
  - `requireAdmin` will throw `UnauthorizedError` when there is no valid user session.

- **Authorization**
  - Admin-only access enforced at two layers:
    - Application layer: `requireAdmin` checks `profiles.is_admin`.
    - Database layer: RLS on `imports_audit` allows `SELECT` for admins only.
  - This ensures non-admins cannot read any import audit data even if they bypass the route.

- **Input Validation & Injection Protection**
  - All query parameters are validated using Zod in `parseAdminImportsQuery`, converting types safely and rejecting invalid values early.
  - No user-controlled field is interpolated into raw SQL; Supabase query builder handles parameterization.
  - The endpoint does not expose arbitrary sorting or dynamic column references; order is fixed to `started_at DESC`.

- **Rate Limiting**
  - Per-admin rate limiting (30/min) prevents enumeration, abuse, or accidental DDoS from misconfigured admin tools.

- **Data Exposure**
  - `ImportsAuditDTO` includes only the intended columns; no raw payload (`source_json`) is exposed.
  - Sensitive internal details (e.g., RPC-level error hints) should appear only in the summarized `error_message` column, which is already present in `imports_audit`.

- **Transport Security**
  - Assumes HTTPS with HSTS is enforced at the platform level.

### 7. Error Handling

- **Validation Errors**
  - Source: `parseAdminImportsQuery` throws `ValidationError` when query parameters do not conform to schema.
  - Handling in route:
    - Catch `ValidationError` and respond with:
      - Status: `400`
      - Body: `{ "code": "bad_request", "message": err.message }`

- **Authentication / Authorization Errors**
  - Source: `requireAdmin` throws `UnauthorizedError` or `ForbiddenError`.
  - Handling in route:
    - `UnauthorizedError` → `401` with `{ code: "unauthorized", message }`
    - `ForbiddenError` → `403` with `{ code: "forbidden", message }`

- **Rate Limit Errors**
  - Source: `limitPerKey` / `RateLimitError` (same pattern as `/api/admin/events`).
  - Handling:
    - `RateLimitError` → `429` with `{ code: "rate_limited", message }`

- **Database Errors**
  - Source: `listAdminImports` throws `DatabaseError` on query failure or unexpected exceptions.
  - Handling:
    - Log with `console.error('Database error in GET /api/admin/imports:', { message: err.message, cause: err.cause })`.
    - Respond with `500` and `{ code: "server_error", message: "Failed to retrieve imports" }`.

- **Unexpected Errors**
  - Any other error type is treated as an internal server error.
  - Handling:
    - Log with `console.error('Unexpected error in GET /api/admin/imports:', err)`.
    - Respond with `500` and `{ code: "server_error", message: "An unexpected error occurred" }`.

- **Error Table Logging**
  - The current design does not define a dedicated error table; instead:
    - Operational failures are logged via `console.error` and can be integrated with a logging/observability platform (e.g., structured logs, APM).
    - Functional failures related to imports themselves are already recorded in `imports_audit.status` and `imports_audit.error_message` by the import workflow.

### 8. Performance Considerations

- **Indexes Utilization**
  - `imports_audit` has indexes on:
    - `import_id` (PK)
    - `uploaded_by_user_id`
    - `started_at DESC`
    - Optional index on `status`
  - Filters and ordering are aligned with these indexes:
    - Range queries on `started_at` use the `started_at` index.
    - Filtering by `uploaded_by_user_id` and `status` benefits from their indexes.

- **Pagination**
  - Pagination uses `range(from, to)` with a bounded `page_size` (max 100) to keep queries efficient.
  - `count: 'exact'` is used to compute `total_items`; for very large tables, this might be tuned later (e.g., approximate counts), but is acceptable for admin-scale usage.

- **Response Size**
  - The response only includes a limited set of columns per row and is paginated, avoiding large payloads.
  - No heavy JSON (`source_json`) is returned, reducing bandwidth and parsing time.

- **Caching**
  - Admin endpoint is marked with `cache-control: no-store`; no server-side or CDN caching is applied.
  - This ensures administrators always see the latest audit data.

### 9. Implementation Steps

1. **Create Validation Schema for Admin Imports Query**
   - Add `src/lib/validation/admin/imports.ts` with:
     - A Zod schema `adminImportsQuerySchema` that:
       - Coerces and validates `page` and `page_size` with defaults and bounds.
       - Validates `status` as an enum (`"success" | "failed"`).
       - Validates `started_before` and `started_after` as ISO datetimes; ensures `started_after <= started_before` when both are present via `superRefine`.
       - Validates `uploader` as a UUID string.
     - A `ValidationError` class mirroring `validation/admin/events.ts` (can be shared or reused if you choose to centralize).
     - A `parseAdminImportsQuery(url: URL): AdminImportsListQuery` function that:
       - Reads query parameters into an object.
       - Runs `safeParse` on the Zod schema.
       - Throws `ValidationError` with a combined error message on failure.

2. **Implement Admin Imports Service**
   - Add `src/lib/services/admin/imports.ts` with:
     - An array constant of columns to select from `imports_audit` matching `ImportsAuditDTO`.
     - A `DatabaseError` class (or reuse a shared one) consistent with `admin/events.ts`.
     - A function:
       - `export async function listAdminImports(supabase: SupabaseClient<Database>, query: AdminImportsListQuery): Promise<AdminImportsListResponseDTO>`
       - Responsibilities:
         - Compute `from`/`to` based on `page`/`page_size`.
         - Build the Supabase query with `select(columns, { count: 'exact' })`, `order('started_at', { ascending: false })`, `.range(from, to)`.
         - Apply conditional filters for `status`, `started_before`, `started_after`, `uploader`.
         - Execute, check for errors, and on success:
           - Cast `data` to `ImportsAuditDTO[]`.
           - Derive `total_items` from `count` (default 0).
           - Compute `total_pages = Math.max(1, Math.ceil(total_items / page_size))` (or align with existing admin conventions).
           - Return an `AdminImportsListResponseDTO`.
         - Wrap any Supabase error or unexpected exception into `DatabaseError`.

3. **Extend the Astro API Route for Admin Imports**
   - In `src/pages/api/admin/imports.ts`:
     - Keep `export const prerender = false` and the existing `POST` handler intact.
     - Import new helpers:
       - `parseAdminImportsQuery`, `ValidationError` from `lib/validation/admin/imports`.
       - `limitPerKey`, `RateLimitError` from `lib/services/rateLimit`.
       - `listAdminImports`, `DatabaseError` from `lib/services/admin/imports`.
     - Implement:
       - `export const GET: APIRoute = async (context) => { ... }` mirroring the structure of `GET /api/admin/events`:
         - Extract `supabase` and `request` from `context`.
         - Build `url` from `request.url`.
         - In a `try` block:
           - Call `parseAdminImportsQuery(url)` to get `AdminImportsListQuery`.
           - Call `requireAdmin(supabase)` to enforce admin rights.
           - Get the current user via `supabase.auth.getUser()` to identify the rate-limit key.
           - Use `limitPerKey({ key: "admin:imports:<user_id>", max: 30, windowMs: 60_000 })` and throw `RateLimitError` if not allowed.
           - Call `listAdminImports(supabase, query)` to get the paginated result.
           - Return `jsonResponse(result, 200)`.
         - In the `catch` block:
           - Map `ValidationError` → 400, `UnauthorizedError` → 401, `ForbiddenError` → 403, `RateLimitError` → 429, `DatabaseError` → 500 with specific message.
           - Log and map any other error to a generic 500.
     - Reuse the existing `jsonResponse` helper defined at the bottom of the file to ensure consistent headers (`no-store`).

4. **Align with RLS and Supabase Policies**
   - Confirm that RLS on `imports_audit` is configured as admin-only for `SELECT`, as per the DB plan.
   - Verify that the service queries only the necessary columns and that they are all accessible under admin policies.

5. **Add Tests (Optional but Recommended)**
   - Unit tests for `parseAdminImportsQuery`:
     - Valid parameter combinations, default values, error messages for invalid inputs.
   - Unit tests for `listAdminImports` (can be integration tests against a test Supabase instance or mocked Supabase client):
     - Query building under various filter combinations.
     - Pagination bounds.
     - Error propagation via `DatabaseError`.
   - API-level tests for `GET /api/admin/imports`:
     - Admin vs non-admin access.
     - Rate limiting behavior.
     - Correct mapping of validation errors and database errors to HTTP statuses.

6. **Documentation and Observability**
   - Ensure that this plan is reflected in the overall API documentation, referencing the response shapes and query parameters exactly.
   - If a centralized logging or monitoring solution is used, replace `console.error` calls with the appropriate logging integration for better traceability of admin access and failure modes.
