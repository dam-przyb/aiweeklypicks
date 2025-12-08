## API Endpoint Implementation Plan: GET /api/admin/events

### 1. Endpoint Overview

Admin-only endpoint to query ingested events for operational analytics. Supports pagination and filters by event type, time range, report, and user. Returns a paginated list of events with sensitive fields like `ip_hash` included (hashed; no raw IP). Enforced via Supabase RLS with admin check (`profiles.is_admin = true`).

### 2. Request Details

- **HTTP Method**: GET
- **URL**: `/api/admin/events`
- **Headers**:
  - `Authorization: Bearer <access_token>` (required; must belong to an admin)
- **Query Parameters**
  - **Required**: none
  - **Optional**:
    - `page` (number; default 1; min 1)
    - `page_size` (number; default 20; min 1; max 100)
    - `event_type` (string | string[]): one or many of `registration_complete,login,report_view,table_view`
      - Accept as repeated params (`?event_type=a&event_type=b`) or comma-separated (`?event_type=a,b`)
    - `occurred_before` (ISO datetime)
    - `occurred_after` (ISO datetime)
    - `report_id` (UUID)
    - `user_id` (UUID)

Validation rules:

- Clamp `page_size` to [1, 100].
- `event_type` values must be from the allowed set; deduplicate.
- `occurred_before`/`occurred_after` must be valid datetimes; if both present, ensure `occurred_after <= occurred_before`.
- `report_id` and `user_id` must be valid UUIDs when provided.

### 3. Used Types

- From `src/types.ts`:
  - `AdminEventsListResponseDTO`
  - `AdminEventDTO`
  - `AdminEventsListQuery`

### 4. Response Details

- **200 OK**
  - Body: `AdminEventsListResponseDTO`
    - `items`: Array of `AdminEventDTO` with fields
      - `event_id, user_id, event_type, occurred_at, user_agent, ip_hash, dwell_seconds, metadata, is_staff_ip, is_bot, report_id`
    - `page, page_size, total_items, total_pages`
- **401 Unauthorized**
  - Missing/invalid bearer token
- **403 Forbidden**
  - Authenticated but not admin
- **400 Bad Request**
  - Invalid params (bad enums, UUIDs, date ordering violations)
- **500 Internal Server Error**
  - Unexpected server/database errors

Headers:

- `Cache-Control: no-store` (admin-only, not cacheable)

### 5. Data Flow

1. Middleware binds per-request Supabase client to the bearer token; handler uses `locals.supabase`.
2. Parse/validate query parameters with Zod; coerce `event_type` to an array when needed.
3. Verify admin via `profiles` check (`requireAdmin(supabase)`).
4. Build query against `events` selecting only `AdminEventDTO` fields with `{ count: 'exact' }`.
5. Apply filters:
   - `.in('event_type', eventTypes[])` when provided
   - `.gte('occurred_at', occurred_after)` / `.lte('occurred_at', occurred_before)`
   - `.eq('report_id', report_id)` / `.eq('user_id', user_id)`
6. Order by `occurred_at` desc (default).
7. Paginate with `.range(from, to)`.
8. Return paginated envelope with 200; errors mapped as specified.

### 6. Security Considerations

- **Authentication**: Require valid bearer token.
- **Authorization**: Enforce admin via `profiles.is_admin = true` for `auth.uid()`; return 403 otherwise.
- **RLS**: Ensure `events` SELECT is admin-only per policies; use server-side admin check and keep using RLS-safe selects.
- **Sensitive Data**: `ip_hash` is hashed; do not expose raw IP. Avoid logging sensitive metadata contents; log minimal context.
- **Rate Limiting**: 30/min per admin (per API plan). Implement in-memory limiter or rely on platform limits.
- **No caching**: `Cache-Control: no-store`.

### 7. Error Handling

- **400 Bad Request** for invalid enums, UUIDs, or date ordering.
- **401 Unauthorized** when token missing/invalid.
- **403 Forbidden** when not admin.
- **500 Internal Server Error** for unexpected DB errors.

Error JSON examples:

```json
{ "code": "bad_request", "message": "invalid query parameters" }
```

```json
{ "code": "unauthorized", "message": "missing or invalid token" }
```

```json
{ "code": "forbidden", "message": "admin required" }
```

```json
{ "code": "server_error", "message": "unexpected error" }
```

Server logging: `{ route: '/api/admin/events', admin_user_id, filters: {...}, total_items?, error? }`. Avoid logging full `metadata` or full `ip_hash` (use prefix only).

### 8. Performance

- Use selective columns only.
- Leverage indexes: `events(event_type, occurred_at desc)`, `events(report_id)`, partitions on `occurred_at`.
- Encourage clients to pass time range filters to prune partitions.
- Keep `page_size` ≤ 100.

### 9. Implementation Steps

1. Validation schema (new): `src/lib/validation/admin/events.ts`
   - Zod `adminEventsQuerySchema`:
     - `page` min 1 (default 1); `page_size` min 1 max 100 (default 20)
     - `event_type`: string or array of strings; normalize to array from allowed set
     - `occurred_before`/`occurred_after`: ISO datetimes; enforce `after <= before`
     - `report_id`, `user_id`: UUIDs
   - Helper: `parseAdminEventsQuery(url: URL): AdminEventsListQuery & { event_type?: string[] }`

2. Authorization service (existing/new): `src/lib/services/authz.ts`
   - `requireAdmin(supabase)` to assert admin via `profiles`.

3. Service (new): `src/lib/services/admin/events.ts`
   - `listAdminEvents(supabase, query): Promise<AdminEventsListResponseDTO>`
   - Applies filters, sorts by `occurred_at` desc, paginates, returns paginated envelope.

4. Rate limiting (existing/new): `src/lib/services/rateLimit.ts`
   - Use `limitPerKey({ key: 'admin:<user_id>', max: 30, windowMs: 60_000 })`.

5. API route (new): `src/pages/api/admin/events.ts`
   - `export const prerender = false`
   - `GET` handler:
     - Parse query via `parseAdminEventsQuery`
     - `await requireAdmin(supabase)`
     - Enforce rate limit per admin
     - Call `listAdminEvents`
     - Return 200 with `no-store` cache header

6. Tests
   - Unit: validation (arrays vs comma-separated `event_type`, dates, UUIDs)
   - Integration: admin vs non-admin access, filter combinations, pagination, rate limit behavior

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/admin/events.ts
export const prerender = false;

import type { APIRoute } from "astro";
import { parseAdminEventsQuery } from "@/lib/validation/admin/events";
import { requireAdmin } from "@/lib/services/authz";
import { limitPerKey } from "@/lib/services/rateLimit";
import { listAdminEvents } from "@/lib/services/admin/events";

export const GET: APIRoute = async (context) => {
  const { request, locals } = context;
  const supabase = locals.supabase;
  const url = new URL(request.url);
  try {
    const query = parseAdminEventsQuery(url);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ code: "unauthorized", message: "missing or invalid token" }), {
        status: 401,
      });
    }
    await requireAdmin(supabase);

    // Rate limit per admin user
    if (!limitPerKey({ key: `admin:${userRes.user.id}`, max: 30, windowMs: 60_000 })) {
      return new Response(JSON.stringify({ code: "rate_limited", message: "too many requests" }), { status: 429 });
    }

    const result = await listAdminEvents(supabase, query);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    if (err?.code === "bad_request") {
      return new Response(JSON.stringify({ code: "bad_request", message: err.message }), { status: 400 });
    }
    if (err?.code === "forbidden") {
      return new Response(JSON.stringify({ code: "forbidden", message: "admin required" }), { status: 403 });
    }
    return new Response(JSON.stringify({ code: "server_error", message: "unexpected error" }), { status: 500 });
  }
};
```

### 11. Service Outline

```ts
// src/lib/services/admin/events.ts
import type { AdminEventsListQuery, AdminEventsListResponseDTO, AdminEventDTO } from "@/types";

const COLUMNS = [
  "event_id",
  "user_id",
  "event_type",
  "occurred_at",
  "user_agent",
  "ip_hash",
  "dwell_seconds",
  "metadata",
  "is_staff_ip",
  "is_bot",
  "report_id",
] as const;

export async function listAdminEvents(
  supabase: App.Locals["supabase"],
  query: AdminEventsListQuery & { event_type?: string | string[] }
): Promise<AdminEventsListResponseDTO> {
  const { page = 1, page_size = 20, occurred_before, occurred_after, report_id, user_id } = query as any;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let req = supabase
    .from("events")
    .select(COLUMNS.join(","), { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, to);

  // Normalize event_type to array if provided
  const types = Array.isArray((query as any).event_type)
    ? (query as any).event_type
    : typeof (query as any).event_type === "string"
      ? [(query as any).event_type]
      : undefined;
  if (types && types.length) {
    req = req.in("event_type", types);
  }

  if (occurred_after) req = req.gte("occurred_at", occurred_after);
  if (occurred_before) req = req.lte("occurred_at", occurred_before);
  if (report_id) req = req.eq("report_id", report_id);
  if (user_id) req = req.eq("user_id", user_id);

  const { data, count, error } = await req;
  if (error) throw error;

  const items = (data ?? []) as unknown as AdminEventDTO[];
  const total_items = count ?? 0;
  const total_pages = Math.max(1, Math.ceil(total_items / page_size));
  return { items, page, page_size, total_items, total_pages };
}
```

### 12. Validation Outline

```ts
// src/lib/validation/admin/events.ts
import { z } from "zod";
import type { AdminEventsListQuery } from "@/types";

const eventTypeEnum = z.enum(["registration_complete", "login", "report_view", "table_view"]);
const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const adminEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    event_type: z.union([eventTypeEnum, z.array(eventTypeEnum)]).optional(),
    occurred_before: isoDate.optional(),
    occurred_after: isoDate.optional(),
    report_id: uuid.optional(),
    user_id: uuid.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.occurred_before && val.occurred_after) {
      if (new Date(val.occurred_after) > new Date(val.occurred_before)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "occurred_after must be <= occurred_before",
          path: ["occurred_after"],
        });
      }
    }
  });

export function parseAdminEventsQuery(url: URL): AdminEventsListQuery & { event_type?: string[] } {
  const sp = url.searchParams;
  // Accept repeated or comma-separated event_type
  const repeated = sp.getAll("event_type");
  const splitComma = repeated.flatMap((v) => v.split(",")).filter(Boolean);
  const obj: Record<string, unknown> = Object.fromEntries(sp.entries());
  if (splitComma.length) obj.event_type = splitComma;

  const parsed = adminEventsQuerySchema.safeParse(obj);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    const error: any = new Error(message);
    error.code = "bad_request";
    throw error;
  }
  const data = parsed.data as any;
  if (typeof data.event_type === "string") data.event_type = [data.event_type];
  return data;
}
```

### 13. Files to Add/Update

- New: `src/lib/validation/admin/events.ts`
- New: `src/lib/services/admin/events.ts`
- Update/Use: `src/lib/services/authz.ts` (`requireAdmin`)
- Update/Use: `src/lib/services/rateLimit.ts` (30/min per admin)
- New: `src/pages/api/admin/events.ts`
