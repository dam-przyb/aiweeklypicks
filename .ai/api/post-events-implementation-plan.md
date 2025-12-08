## API Endpoint Implementation Plan: POST /api/events

### 1. Endpoint Overview

This endpoint ingests client-side events into the `events` table for analytics and operational monitoring.  
It accepts a narrow, validated set of event types (`registration_complete`, `login`, `report_view`, `table_view`), enriches them with server-controlled metadata (timestamp, user agent, IP hash, optional `user_id` via Supabase Auth), and delegates persistence to a Supabase SECURITY DEFINER RPC that enforces RLS and privacy guarantees.  
The endpoint is publicly callable (no auth required) but will opportunistically associate authenticated users when a valid access token is present.  
The endpoint responds with an asynchronous-acceptance contract (`202 Accepted`) and an `event_id` that uniquely identifies the stored event.

### 2. Request Details

- **HTTP Method**: `POST`
- **URL Structure**: `/api/events`
- **AuthN/AuthZ**:
  - **Authentication**: Optional Bearer token via Supabase Auth.
    - If present and valid, `auth.uid()` will be associated with `events.user_id` by the RPC.
    - If absent or invalid, the event is still accepted as anonymous (subject to rate limiting).
  - **Authorization**: Public for inserts, but actual table writes are restricted via:
    - RLS on `events` allowing INSERT only via a SECURITY DEFINER RPC.
    - Endpoint calls this RPC; clients have no direct table access.

- **Parameters**
  - **Path parameters**: None.
  - **Query parameters**: None.
  - **Headers (relevant)**:
    - `Authorization: Bearer <access_token>` (optional).
    - `Content-Type: application/json` (required).
    - Implicit:
      - `User-Agent` (captured for analytics).
      - Network-related headers (for IP detection), e.g. `x-forwarded-for`, depending on hosting/CDN.

- **Request Body Structure**
  - Body is JSON corresponding to `PostEventCommand` (from `src/types.ts`) with additional runtime constraints:
    - **Required fields**:
      - **`event_type`**: `PublicEventType`  
        Allowed values:
        - `"registration_complete"`
        - `"login"`
        - `"report_view"`
        - `"table_view"`
    - **Optional fields**:
      - **`dwell_seconds?: number`**
        - Required for `event_type === "report_view"`.
        - Must be an integer or float `>= 10` for `report_view`.
        - For other event types:
          - If present, must be `>= 0`.
          - May be omitted.
      - **`report_id?: UUID`**
        - Optional overall.
        - For `report_view`, recommended but not strictly required per spec; when present:
          - Must be a syntactically valid UUID.
          - Must correspond to an existing `weekly_reports.report_id` if the RPC enforces FK; otherwise FK in DB will enforce referential integrity.
      - **`metadata?: Json`**
        - Optional JSON object containing additional attributes (e.g. UI context, AB test flags).
        - Must be JSON-serializable and reasonably sized (e.g. soft limit enforced in validation to prevent abuse, such as max ~16–64 KB).

- **Derived / Server-controlled fields (not in request body)**
  - `occurred_at`: Current server timestamp at ingestion time.
  - `user_agent`: From incoming request headers.
  - `ip_hash`: Salted hash of client IP (privacy-preserving).
  - `is_staff_ip` and `is_bot`: Set via database triggers using IP classification and user-agent heuristics.

- **Input Validation Rules**
  - JSON body must parse successfully.
  - `event_type` must be one of the allowed `PublicEventType` values.
  - Conditional rule:
    - If `event_type === "report_view"`:
      - `dwell_seconds` is required and must be `>= 10`.
      - If validation fails, respond with **422 Unprocessable Entity** (business rule violation).
  - `dwell_seconds`, when present for other event types, must be `>= 0`.
  - `report_id`, when present, must be a valid UUID string.
  - `metadata`, when present, must be a JSON object or value compatible with `Json` type; impose a maximum size threshold.
  - Reject extra top-level fields (optional but recommended) to avoid schema drift and reduce attack surface.

### 3. Used Types

- **Existing DTOs / Command Models (from `src/types.ts`)**
  - **`PublicEventType`**
    - Union of allowed strings:
      - `"registration_complete" | "login" | "report_view" | "table_view"`.
  - **`PostEventCommand`**
    - Shape expected from the client:
      - `event_type: PublicEventType;`
      - `dwell_seconds?: number;`
      - `report_id?: UUID;`
      - `metadata?: Json;`
    - Used as the compile-time type for request body, with Zod enforcing runtime validation.
  - **`PostEventAcceptedDTO`**
    - Response DTO for this endpoint:
      - `event_id: UUID;`
      - `accepted: true;`
  - **`EventEntity`**
    - Mapped from `Tables<"events">`; shape matches DB schema and underlies Supabase typings.
  - **`AdminEventDTO`**, **`AdminEventsListResponseDTO`**
    - Not directly used in this endpoint, but relevant for downstream admin analytics endpoints that consume the data written here.

- **Zod Schemas (to be created)**
  - **`postEventSchema`**
    - Zod representation of `PostEventCommand` that:
      - Validates `event_type` as enum/union of allowed values.
      - Validates `dwell_seconds` numeric constraints and conditional requirement for `report_view`.
      - Validates `report_id` as UUID when present.
      - Validates `metadata` as `z.any()` or a narrowed JSON schema, with additional size checks.
    - Produces a strongly typed `PostEventCommand` on success via `z.infer`.

- **Supabase RPC Input/Output Types (conceptual)**
  - RPC name (suggested): **`admin_post_event`** or **`public_post_event`**.
    - Input parameters:
      - `p_event_type text`
      - `p_dwell_seconds numeric`
      - `p_report_id uuid`
      - `p_metadata jsonb`
      - `p_user_agent text`
      - `p_ip_hash text`
      - (Optionally) `p_occurred_at timestamptz` (or just use `now()` inside function).
    - Output:
      - The inserted `event_id uuid`.
    - The ASTRO endpoint will model the returned data as `{ event_id: UUID }` inferred either via hand-written TypeScript interface or Supabase-generated types if RPC is included in `database.types`.

### 4. Response Details

- **Success**
  - **Status**: `202 Accepted` (as per spec; asynchronous-like ingestion).
  - **Body**: `PostEventAcceptedDTO`
    - Example:
      - `{ "event_id": "cbb5c3fe-7e91-4c28-989d-848b1f19e5af", "accepted": true }`
  - **Headers**:
    - `Content-Type: application/json; charset=utf-8`.
    - Optional: `Cache-Control: no-store` to prevent intermediaries from caching.

- **Client Errors**
  - **400 Bad Request**
    - Malformed JSON body (parse error).
    - Missing `Content-Type: application/json`.
    - Structural validation failures (type mismatches, invalid UUID format, unexpected fields) that do not require domain-specific semantics.
  - **401 Unauthorized**
    - Only when auth is required and missing/invalid; for this endpoint:
      - Typically this endpoint is public, so **401** is returned only if in the future we decide certain event types must be authenticated.
      - Current spec: no 401 for anonymous events; invalid tokens simply mean `user_id` is omitted, not a request failure.
  - **422 Unprocessable Entity**
    - Valid JSON, structurally correct, but domain rule failure:
      - `event_type === "report_view"` and:
        - `dwell_seconds` missing or `< 10`.
    - Potential extension: additional domain rules (e.g. invalid combinations of `event_type` and `report_id`) also mapped here.
  - **429 Too Many Requests**
    - Request exceeds rate-limit thresholds (e.g. per IP or token).
    - Returns a JSON error envelope containing rate-limit info and retry hints.

- **Server Errors**
  - **500 Internal Server Error**
    - Unexpected runtime exceptions in the Astro handler (e.g. IP extraction crash, hashing errors).
    - Supabase RPC errors not attributable to client input (e.g. transient network issues, DB outage).
    - Should be accompanied by a generic response body:
      - `{ "error": "internal_error", "message": "Something went wrong. Please try again later." }`
    - Detailed error context must be logged server-side but never exposed to the client.

### 5. Data Flow

1. **Request Reception (Astro API route)**
   - Client sends `POST /api/events` with JSON body and optional Authorization header.
   - Astro `POST` handler receives `Request` and `AstroGlobal` / `APIContext`, exposing:
     - `context.request` (body, headers).
     - `context.locals.supabase` (Supabase client using configured auth context, per project backend rules).

2. **Parsing and Basic Validation**
   - Handler verifies `Content-Type` is `application/json`.
   - Reads body via `await request.json()`, wrapped in `try/catch`:
     - On JSON parse error → early return with **400**.
   - Parsed body is passed to Zod `postEventSchema.safeParse`.
     - If `success === false`:
       - For structural/type errors → respond with **400** and a summarised validation error structure.
       - For domain errors (e.g. `report_view` dwell rule) Zod refinement should tag them as domain-level and map to **422**.

3. **Derived Metadata Enrichment**
   - **User identification**:
     - The Supabase client in `context.locals.supabase` is already bound to the incoming auth context.
     - No extra work is needed in the API handler; the RPC sees `auth.uid()` if a valid token was provided.
   - **IP extraction**:
     - Extract client IP from:
       - CDN/Reverse proxy header (e.g. `X-Forwarded-For`).
       - Fallback to `request` remote address if available in the hosting environment.
     - Decide on a canonical "client IP" extraction helper shared across endpoints.
   - **IP hashing**:
     - Retrieve secret salt from `import.meta.env.EVENT_IP_HASH_SALT` (or similar).
     - If IP is present:
       - Compute hash: `sha256(salt + "|" + clientIp)` using Node’s crypto API.
       - `ip_hash` is a hex-encoded or base64 string; ensure consistent format with DB expectations.
     - If IP is unavailable:
       - Use a sentinel (e.g. `unknown`) or skip hashing and let DB handle `NOT NULL` constraint by providing a default `ip_hash` (e.g. hash of `unknown`).
   - **User agent**:
     - Read from `request.headers.get("user-agent") ?? "unknown"`.
   - **Timestamp**:
     - Option A: Let the RPC or table default set `occurred_at = now()`; do not send it from the API.
     - Option B: Pass server timestamp explicitly when calling RPC.
     - Prefer Option A for simplicity and consistency (all events share DB server clock).

4. **RPC Invocation to Insert Event**
   - Using `context.locals.supabase`, call a SECURITY DEFINER RPC (e.g. `admin_post_event`):
     - `const { data, error } = await supabase.rpc("admin_post_event", { ...params });`
   - Parameters include:
     - Validated `event_type`.
     - `dwell_seconds` (or `null`).
     - `report_id` (or `null`).
     - `metadata` (or `null`).
     - `user_agent`.
     - `ip_hash`.
   - The RPC:
     - Performs `INSERT` into `events` table under RLS rules.
     - Uses `auth.uid()` for `user_id` when available.
     - Sets `occurred_at` as `now()`.
     - Returns the `event_id` of the inserted row.
     - Triggers on `events` table populate `is_staff_ip` and `is_bot`.

5. **RPC Result Handling**
   - If `error` is non-null:
     - Examine `error.code` or `error.details`:
       - If error clearly stems from client input (e.g. FK violation on `report_id`), may map to **400** or **422**.
       - Otherwise, treat as **500** and log the full context.
   - If `data` contains `event_id`:
     - Construct `PostEventAcceptedDTO` response.
     - Return with **202** and JSON body.

6. **Logging and Observability**
   - For validation failures and errors:
     - Log to server logs with:
       - Error message.
       - Event type and a redacted subset of payload (avoid PII).
       - IP hash, not raw IP.
   - There is no dedicated “error table” in the DB plan for this endpoint:
     - Do not create a new table unless required.
     - Rely on application logs and platform-level logging (e.g. DigitalOcean, Supabase logs).

### 6. Security Considerations

- **RLS and Supabase Usage**
  - `events` has RLS enabled and only allows INSERT via server-side function.
  - The RPC must be defined with `SECURITY DEFINER` and limited to necessary operations:
    - Ensure the function checks/normalizes inputs to prevent bypassing validation via direct DB calls.
    - Only expose this RPC to roles used by the Astro server, not directly from client SDKs in the browser.

- **Authentication Handling**
  - Endpoint is public by design:
    - Anonymous events are permitted; no 401 on missing auth.
  - If the request has a Bearer token:
    - Astro must pass the auth context through `context.locals.supabase` so that `auth.uid()` is available.
    - Do not parse or trust the JWT manually; rely on Supabase’s validation.

- **Input Validation (Defense in Depth)**
  - Strict Zod validation ensures only expected fields and types are accepted.
  - Enforce domain invariants (e.g. dwell rules) at the API layer and ideally mirrored in DB constraints or RPC logic.
  - Reject oversized payloads (especially `metadata`) to mitigate resource exhaustion.

- **IP & Privacy**
  - Do not persist plain IP addresses.
  - Hash IP with a secret salt stored in environment variables, not in code.
  - Ensure the salt is long, random, and rotated according to security policy.
  - Treat `ip_hash` as sensitive; log it only when necessary.

- **Rate Limiting and Abuse Prevention**
  - Implement per-IP and/or per-user rate limiting for `POST /api/events`:
    - Basic approach:
      - Use an in-memory or external cache (Redis, KV store) to track counts per `(ip_hash, event_type)` over sliding window (e.g. 1 minute).
      - When thresholds exceeded, return **429**.
    - Ensure rate-limiter itself is efficient and does not introduce significant latency.
  - Consider extra throttling for anonymous requests vs authenticated ones.

- **Injection and Serialization**
  - `metadata` is stored as JSONB; ensure the RPC uses typed parameters and parameterized queries.
  - Avoid string concatenation in SQL; use Supabase/PL/pgSQL parameters to prevent SQL injection.
  - Ensure logs do not include raw SQL or secrets.

- **CORS and CSRF**
  - Configure CORS appropriately for the frontend origin(s).
  - CSRF risk is lower for a non-mutating resource from the user’s perspective, but since this is a POST endpoint:
    - If the domain is same-origin with user-authenticated sessions, ensure CSRF protections exist at the app gateway level if needed.

### 7. Error Handling

- **Error Envelope Structure**
  - For non-2xx responses, respond with a simple JSON structure:
    - `{ "error": string; "message": string; "details"?: unknown }`
  - Avoid leaking stack traces or internal codes; log them server-side instead.

- **Validation Errors (400 / 422)**
  - On JSON parse failure:
    - **400 Bad Request**
    - `{ "error": "invalid_json", "message": "Request body must be valid JSON." }`
  - On structural Zod validation error (type mismatch, unknown fields, invalid UUID format):
    - **400 Bad Request**
    - `{ "error": "invalid_request", "message": "Request body failed validation.", "details": <pruned zod error> }`
  - On domain rule violations (e.g. `report_view` with `dwell_seconds < 10`):
    - **422 Unprocessable Entity**
    - `{ "error": "invalid_event_state", "message": "dwell_seconds must be at least 10 for report_view." }`

- **Rate Limit Errors (429)**
  - When rate limit exceeded:
    - **429 Too Many Requests**
    - `{ "error": "rate_limited", "message": "Too many events from this client. Please slow down." }`
    - Optionally include `retry_after` seconds or HTTP `Retry-After` header.

- **Supabase RPC Errors**
  - If RPC returns an error:
    - If error indicates client-side issue (e.g. missing required DB field, FK violation for `report_id`):
      - Map to **400** or **422**, mirroring the nature of the issue.
    - Otherwise:
      - Map to **500**, log the `error` object (code, details, hint) with correlation IDs.

- **Unexpected Server Errors (500)**
  - Catch any uncaught exceptions in the handler:
    - Log via centralized logger (or `console.error` as a fallback), including:
      - Error stack.
      - Sanitized request metadata (event_type if available, ip_hash, no raw IP).
    - Return a generic **500** JSON response as described above.
  - There is no dedicated error table for this endpoint:
    - If later required, consider a generic `error_logs` table with RLS + retention policies, but not in the current scope.

### 8. Performance Considerations

- **Low Latency and Lightweight Work**
  - Validation and hashing must be cheap operations.
  - Do not perform heavy computations or secondary lookups; RPC should be a single round-trip.
  - Keep response payload small (only `event_id` and `accepted`).

- **Database Load**
  - Events can be high volume:
    - Keep each insert O(1) with appropriate indexes as defined in the DB plan (`event_type`, `occurred_at`, `report_id`).
    - Rely on partitioning by month to keep indexes lean and enable efficient retention policies.
  - Ensure RPC logic is efficient and avoids unnecessary joins.

- **Scalability**
  - 202 semantics allow backend systems (DB, triggers) to handle work without forcing synchronous downstream processing.
  - For very high loads, you can:
    - Introduce buffering or queue-based ingestion behind the endpoint (future extension).
    - Maintain idempotency rules if needed (currently not required by spec).

- **Network and Serialization**
  - Request/response bodies are small; JSON serialization overhead is minimal.
  - Use `Response` streaming only if necessary; here a simple JSON response is sufficient.

### 9. Implementation Steps

1. **Create Astro API Route**
   - Add `src/pages/api/events.ts` (or `.astro` server route if that’s the established pattern).
   - Export:
     - `export const prerender = false;`
     - `export async function POST(context: APIContext) { ... }`
   - Ensure the route integrates with existing middleware and `context.locals.supabase` setup.

2. **Define Zod Schema for Request Validation**
   - In a shared validation module (e.g. `src/lib/validation/events.ts`), define:
     - `postEventSchema` mirroring `PostEventCommand` with:
       - `event_type`: `z.enum(["registration_complete", "login", "report_view", "table_view"])`.
       - `dwell_seconds`: `z.number().nonnegative().optional()`.
       - `report_id`: `z.string().uuid().optional()`.
       - `metadata`: `z.any().optional()` or a JSON-like schema.
     - Add `.superRefine` or `.refine` for:
       - Conditional requirement: `event_type === "report_view" -> dwell_seconds >= 10`.
       - Optionally tag domain errors separately to map them to **422**.

3. **Implement Request Parsing and Validation in Handler**
   - In `POST` handler:
     - Check `Content-Type` header and early-return **400** if not JSON.
     - Wrap `await request.json()` in `try/catch`:
       - On failure, return **400** with `invalid_json`.
     - Run `postEventSchema.safeParse(body)`:
       - If `success === false`:
         - Inspect errors; decide if they should be **400** or **422** (based on domain tags).
         - Return the appropriate status and error envelope.
     - If validation succeeds:
       - Get typed `command: PostEventCommand` from `result.data`.

4. **Implement IP Extraction and Hashing Helper**
   - Create helper in `src/lib/services/request-context.ts` (or similar):
     - `getClientIp(request: Request): string | null`
       - Inspect standard headers (`x-forwarded-for`, `cf-connecting-ip`, etc.) and environment-specific APIs.
     - `hashIp(ip: string | null, salt: string): string`
       - Uses Node’s `crypto` to compute SHA-256 hash of salt + IP (or a sentinel if IP is null).
   - Ensure helpers are reusable for other endpoints needing similar behavior.

5. **Enrich Command with Server Metadata**
   - In handler, after validation:
     - `const userAgent = request.headers.get("user-agent") ?? "unknown";`
     - `const clientIp = getClientIp(request);`
     - `const salt = import.meta.env.EVENT_IP_HASH_SALT;`
       - Guard clause: if salt is missing, log critical error and return **500** (do not proceed without privacy guarantees).
     - `const ipHash = hashIp(clientIp, salt);`

6. **Call Supabase RPC to Insert Event**
   - Retrieve Supabase client from context:
     - `const supabase = context.locals.supabase;`
   - Prepare RPC parameters:
     - Normalize optional fields to `null` when not provided to align with SQL.
     - Example payload:
       - `{ p_event_type: command.event_type, p_dwell_seconds: command.dwell_seconds ?? null, p_report_id: command.report_id ?? null, p_metadata: command.metadata ?? null, p_user_agent: userAgent, p_ip_hash: ipHash }`
   - Call RPC:
     - `const { data, error } = await supabase.rpc("admin_post_event", rpcParams);`

7. **Handle RPC Response and Map to HTTP Response**
   - If `error`:
     - Log error with context (event_type, ip_hash, but not raw IP or sensitive metadata).
     - If error clearly indicates a client-side issue (e.g. FK violation on `report_id`):
       - Return **400** or **422** with a suitable error code.
     - Otherwise:
       - Return **500** with `internal_error`.
   - If `data` is missing or does not include `event_id`:
     - Treat as **500** and log as an invariant violation.
   - If successful:
     - Construct `PostEventAcceptedDTO`:
       - `{ event_id: data.event_id, accepted: true }`
     - Return `new Response(JSON.stringify(dto), { status: 202, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })`.

8. **Implement Basic Rate Limiting**
   - Add a lightweight rate-limiter middleware or inline logic:
     - Keyed by `ipHash` (and optionally `event_type`).
     - E.g. max N events per minute per key.
   - On exceedance:
     - Return **429** with `rate_limited` error payload.
   - Ensure rate-limiter integrates cleanly with Astro middleware (e.g. `src/middleware/index.ts`) for reuse across endpoints.

9. **Add Logging and Monitoring**
   - Use a centralized logging utility (e.g. `src/lib/services/logger.ts`) to:
     - Log validation failures at `warn` level.
     - Log RPC/DB or unexpected errors at `error` level with correlation IDs.
   - Optionally add metrics hooks:
     - Count events per type, rejected events, and rate-limited requests.

10. **Testing**
    - **Unit tests** for:
      - `postEventSchema` including:
        - Valid payloads for each `event_type`.
        - `report_view` with `dwell_seconds` >= 10 passes; < 10 fails with domain error.
        - Invalid UUID in `report_id` fails.
      - IP hashing helper behavior.
    - **Integration tests** (if available in the project):
      - Successful `POST /api/events` for each `event_type`.
      - Validation errors returning 400/422.
      - Rate-limiting returning 429.
      - RPC failure path returning 500.
    - Ensure tests respect the RLS policies and use appropriate Supabase test configuration.

11. **Documentation**
    - Update API documentation to:
      - Describe request/response formats.
      - Document rate limits, status codes, and error shapes.
      - Clarify privacy behavior (IP hashing, no raw IP storage).
