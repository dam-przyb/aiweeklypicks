# REST API Plan

## 1. Resources

- Weekly Reports — table `weekly_reports`
- Stock Picks — table `stock_picks`
- Imports Audit — table `imports_audit`
- Profiles — table `profiles`
- Events — partitioned table `events` (monthly partitions)
- Staff Networks — table `staff_networks`
- Picks History — materialized view `picks_history`

Notes

- Public read access (via RLS policies) is allowed for `weekly_reports` and `stock_picks`.
- Admin-only access for `imports_audit`, `events`, and `staff_networks`.
- Admin is determined by `profiles.is_admin = true` for `auth.uid()`.
- Business operations (import, event insert) are executed via SECURITY DEFINER RPCs under RLS.

## 2. Endpoints

Conventions

- Base path: `/api`
- Auth: Supabase Auth JWT in `Authorization: Bearer <token>`; anon allowed for public GETs
- Pagination: `page` (1-based), `page_size` (default 20, max 100)
- Sorting: `sort` (whitelisted fields), `order` (`asc`|`desc`)
- Filtering: explicit query params per endpoint
- Timestamps: ISO 8601 in UTC

### Weekly Reports

1. GET /api/reports

- Description: List weekly reports ordered by publish date desc
- Query
  - `page`, `page_size`
  - `sort` in {`published_at`,`report_week`,`title`}; default `published_at`
  - `order` in {`asc`,`desc`}; default `desc`
  - `week` (string, ISO week like `2025-W42`)
  - `version` (string)
  - `published_before`, `published_after` (ISO datetime)
- Response 200
  - `items`: array of {`report_id`,`slug`,`report_week`,`published_at`,`version`,`title`,`summary`,`created_at`}
  - `page`,`page_size`,`total_items`,`total_pages`
- Errors: 400 invalid params

2. GET /api/reports/{slug}

- Description: Fetch a single report by permalink slug, including its picks
- Path: `slug` (string)
- Response 200
  - `report`: {`report_id`,`slug`,`report_week`,`published_at`,`version`,`title`,`summary`,`created_at`}
  - `picks`: array of Stock Pick (see schema below)
- Errors: 404 not found

3. GET /api/reports/id/{report_id}

- Description: Fetch a single report by UUID (alternative to slug)
- Path: `report_id` (UUID)
- Response 200: same shape as by slug
- Errors: 400 invalid UUID, 404 not found

Note: Creating/updating/deleting reports occurs only through the Import endpoint (admin) to preserve invariants.

### Stock Picks

4. GET /api/picks

- Description: Historical picks table (uses `picks_history` MV when available)
- Query
  - `page`, `page_size`
  - `sort` in {`published_at`,`ticker`,`exchange`,`side`,`target_change_pct`}; default `published_at`
  - `order` in {`asc`,`desc`}; default `desc`
  - Filters: `ticker`, `exchange`, `side` in {`long`,`short`}, `date_before`, `date_after`
- Response 200
  - `items`: array of {`published_at`,`report_week`,`ticker`,`exchange`,`side`,`target_change_pct`,`report_id`}
  - `page`,`page_size`,`total_items`,`total_pages`
- Errors: 400 invalid params

5. GET /api/reports/{report_id}/picks

- Description: List picks for a given report (directly from `stock_picks`)
- Path: `report_id` (UUID)
- Query: none (small cardinality)
- Response 200: `items`: array of Stock Pick
- Errors: 400 invalid UUID, 404 report not found

Stock Pick JSON shape

- `{ "pick_id": UUID, "report_id": UUID, "ticker": string, "exchange": string, "side": "long"|"short", "target_change_pct": number, "rationale": string, "created_at": string }`

### Admin: Imports

6. GET /api/admin/imports ✅ **IMPLEMENTED**

- AuthZ: admin only (via `requireAdmin` + RLS)
- Rate Limit: 30 requests/min per admin user
- Description: List recent imports from `imports_audit` with pagination and filters
- Query
  - `page` (number, default: 1, min: 1)
  - `page_size` (number, default: 20, min: 1, max: 100)
  - `status` (string) in {`success`,`failed`} - filter by import status
  - `started_before` (ISO datetime) - filter imports started before this time
  - `started_after` (ISO datetime) - filter imports started after this time (must be <= started_before)
  - `uploader` (UUID) - filter by `uploaded_by_user_id`
- Response 200
  - `items`: array {`import_id`,`uploaded_by_user_id`,`filename`,`source_checksum`,`schema_version`,`status`,`error_message`,`started_at`,`finished_at`}
  - `page`,`page_size`,`total_items`,`total_pages`
  - Note: `source_json` is excluded from response for performance (up to 5MB payload)
  - Ordered by `started_at DESC`
  - Cache: `no-store` (admin endpoint, always fresh)
- Errors
  - 400 Bad Request: invalid query parameters (invalid UUID, date format, status value, page bounds, or started_after > started_before)
  - 401 Unauthorized: missing or invalid JWT token
  - 403 Forbidden: authenticated user is not an admin
  - 429 Too Many Requests: rate limit exceeded (30 requests/min)
  - 500 Internal Server Error: database query failure or unexpected error
- Implementation
  - Route: `src/pages/api/admin/imports.ts` (GET handler)
  - Validation: `src/lib/validation/admin/imports.ts`
  - Service: `src/lib/services/admin/imports.ts`
  - Tests: `src/lib/validation/admin/imports.test.ts` (45 tests, all passing)
  - RLS Verification: `.ai/admin-imports-rls-verification.md`
  - Plan: `.ai/admin-imports-implementation-plan.md`

7. GET /api/admin/imports/{import_id}

- AuthZ: admin only
- Description: Fetch a specific import audit row
- Path: `import_id` (UUID)
- Response 200: single audit row (fields as above)
- Errors: 400 invalid UUID, 403 not admin, 404 not found

8. POST /api/admin/imports

- AuthZ: admin only
- Description: Upload a weekly report JSON and import atomically via RPC `admin_import_report(payload JSONB, filename TEXT)`
- Content Types
  - `multipart/form-data` with `file` (.json), optional `filename`
  - `application/json` with `{ "filename": string, "payload": object }`
- Request validation
  - Filename must match `^\d{4}-\d{2}-\d{2}report\.json$`
  - JSON schema v1 per PRD; size ≤ 2MB (UI guard) and DB limit 5MB (server)
- Response 201
  - `{ "import_id": UUID, "status": "success", "report_id": UUID, "report_slug": string }` on success
  - On failure: `{ "import_id": UUID, "status": "failed", "error": string }`
- Errors: 400 validation, 403 not admin, 409 duplicate report, 413 payload too large, 422 schema errors, 500 server

### Admin: Profiles

9. GET /api/admin/profiles

- AuthZ: admin only
- Description: List profiles; useful for admin management
- Query: `page`, `page_size`, `is_admin` (boolean)
- Response 200: `items`: array {`user_id`, `is_admin`, `created_at`}
- Errors: 403 not admin

10. POST /api/admin/profiles/{user_id}/grant-admin

- AuthZ: admin only
- Description: Set `profiles.is_admin = true` for the specified user
- Path: `user_id` (UUID)
- Response 200: `{ "user_id": UUID, "is_admin": true }`
- Errors: 400 invalid UUID, 403 not admin, 404 user/profile not found

11. POST /api/admin/profiles/{user_id}/revoke-admin

- AuthZ: admin only
- Description: Set `profiles.is_admin = false`
- Response 200: `{ "user_id": UUID, "is_admin": false }`
- Errors: same as grant

Note: These should be executed via a server-side service role or a SECURITY DEFINER RPC to satisfy RLS.

### Events

12. POST /api/events

- AuthZ: public (server executes with RPC that does not require `auth.uid()`); associates `auth.uid()` when present
- Description: Generic event ingestion (validated types, server-controlled timestamps, IP hashing)
- Request JSON
  - `event_type`: one of `registration_complete`,`login`,`report_view`,`table_view`
  - `dwell_seconds` (number, optional; required for `report_view` and must be ≥ 10)
  - `report_id` (UUID, optional for `report_view`)
  - `metadata` (object, optional)
- Server behavior
  - Set `occurred_at` (server time), capture `user_agent`, compute `ip_hash` using secret salt
  - Bot/staff flags set via triggers/heuristics
- Response 202: `{ "event_id": UUID, "accepted": true }`
- Errors: 400 validation, 422 dwell < 10 for report_view, 429 rate limit

13. GET /api/admin/events

- AuthZ: admin only
- Description: Query events for ops analytics (excludes bots/staff via filters when requested)
- Query
  - `page`, `page_size`
  - `event_type` (one or many)
  - `occurred_before`, `occurred_after`
  - `report_id` (UUID), `user_id` (UUID)
- Response 200: `items`: array {`event_id`,`user_id`,`event_type`,`occurred_at`,`user_agent`,`ip_hash`,`dwell_seconds`,`metadata`,`is_staff_ip`,`is_bot`,`report_id`}
- Errors: 403 not admin

### Staff Networks

14. GET /api/admin/staff-networks

- AuthZ: admin only
- Description: List staff networks used to flag staff IPs
- Query: `page`, `page_size`
- Response 200: `items`: array {`network`,`label`,`created_at`}
- Errors: 403 not admin

15. POST /api/admin/staff-networks

- AuthZ: admin only
- Description: Add a CIDR to `staff_networks`
- Request JSON: `{ "network": string (CIDR), "label": string }`
- Response 201: created record
- Errors: 400 invalid CIDR, 403 not admin, 409 duplicate

16. DELETE /api/admin/staff-networks/{network}

- AuthZ: admin only
- Description: Remove a CIDR entry
- Path: `network` as URL-encoded CIDR
- Response 204: no content
- Errors: 403 not admin, 404 not found

### Auth (Supabase-provided; optional REST facades)

17. POST /api/auth/register

- Description: Proxy to Supabase Auth sign-up to emit consistent events server-side
- Request JSON: `{ "email": string, "password": string }`
- Response 201: `{ "user_id": UUID }` and schedules `registration_complete` event
- Errors: 400 invalid, 409 email exists, 429 rate limit

18. POST /api/auth/login

- Description: Proxy to Supabase Auth sign-in; emits `login` event on success
- Request JSON: `{ "email": string, "password": string }`
- Response 200: `{ "access_token": string, "refresh_token": string, "user_id": UUID }`
- Errors: 400/401 invalid creds, 429 rate limit

19. POST /api/auth/logout

- Description: Invalidate session (client should also clear tokens)
- Request: empty
- Response 204

### Utility

20. GET /api/health

- Description: Liveness check
- Response 200: `{ "status": "ok" }`

## 3. Authentication and Authorization

- Mechanism: Supabase Auth JWT in `Authorization: Bearer <token>`; verified server-side with Supabase client.
- Public content: `GET /api/reports*` and `GET /api/picks` allow anon; no token required.
- Admin: Endpoints under `/api/admin/**` require `profiles.is_admin = true` for `auth.uid()`.
- Server-only operations: Import and Events use SECURITY DEFINER RPCs to perform privileged actions under RLS.
- Session persistence: Handled by Supabase SDK on the client; server trusts bearer tokens.

Rate Limiting

- `POST /api/auth/login` and `/api/auth/register`: 5/min per IP and email
- `POST /api/events`: 60/min per IP, 10/min per user for `report_view`
- Public GETs: 60/min per IP
- Admin endpoints: 30/min per admin

Security Controls

- IP hashing: salted SHA-256 for `ip_hash` (salt in env secret)
- Input whitelisting for `sort`,`order`; strict schema validation for import
- Enforce content-type checks; reject files > 2MB at edge and > 5MB in DB
- HTTPS enforced at platform; HSTS recommended
- Use `Cache-Control` and ETags for public GETs (e.g., 60s TTL, revalidate on MV refresh)

## 4. Validation and Business Logic

Weekly Reports

- Validation
  - `slug` unique, `report_week` is generated from `published_at` (server-side; not client-provided)
  - Uniqueness on (`report_week`,`version`) and `slug`
- Business Logic
  - Exposed only via import; direct CRUD not provided to maintain invariants

Stock Picks

- Validation
  - `side` in {`long`,`short`}
  - `target_change_pct` within domain `pct_change` (−1000 ≤ value ≤ 1000)
  - Unique per report: (`report_id`,`ticker`,`side`)
- Business Logic
  - Created only through successful report import; read-only otherwise

Imports

- Validation
  - Filename regex `^\d{4}-\d{2}-\d{2}report\.json$`
  - JSON schema v1: required root fields and pick fields per PRD
  - Cross-check filename date with `published_at` and resulting `report_week`
  - Reject duplicates by `report_id`; optional checksum dedupe
- Business Logic
  - All-or-nothing transaction; write audit row with status/error
  - Refresh `picks_history` MV on success

Profiles

- Validation
  - `user_id` exists in `auth.users`
- Business Logic
  - Admin grants/revokes adjust `is_admin`; operations via privileged RPC or service role

Events

- Validation
  - `event_type` in allowed set
  - `dwell_seconds` required and ≥ 10 for `report_view`
  - `report_id` must be a valid UUID when provided
- Business Logic
  - `occurred_at` set by server; IP hashed; staff/bot flags via triggers
  - Partitions created monthly; retention policies applied out-of-band

Staff Networks

- Validation
  - `network` must be valid CIDR; unique PK
- Business Logic
  - Maintained by admins; used by triggers to flag staff IPs in events

Picks History (Materialized View)

- Validation
  - Read-only; reflects join of reports and picks
- Business Logic
  - Refreshed after successful imports for fast historical queries

Error Model (common)

- 200 OK (GET), 201 Created (POST create), 202 Accepted (event ingestion), 204 No Content (DELETE)
- 400 Bad Request (invalid query/body), 401 Unauthorized (missing/invalid token), 403 Forbidden (not admin), 404 Not Found, 409 Conflict (duplicate), 413 Payload Too Large, 422 Unprocessable Entity (schema/field validation), 429 Too Many Requests, 500 Internal Server Error

Implementation Notes (Astro + Supabase)

- Place handlers under `src/pages/api/**` using TypeScript; use Supabase JS server client.
- For admin checks, query `profiles` where `user_id = auth.uid()`.
- For RPCs, configure and call: `admin_import_report(payload, filename)` and `get_current_user_identity()`.
- Use MV `picks_history` for `/api/picks` with fallback to join if MV absent.
- Apply output shaping and RLS-safe selects; avoid over-fetching.
