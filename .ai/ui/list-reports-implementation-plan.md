## API Endpoint Implementation Plan: GET /api/reports

### 1. Endpoint Overview

Public endpoint that lists weekly reports with pagination, sorting, and filtering. Results are ordered by `published_at` (default `desc`) and shaped to the minimal fields needed by the UI. Anonymous access is allowed under RLS; bearer tokens, when present, are accepted but not required.

### 2. Request Details

- **HTTP Method**: GET
- **URL**: `/api/reports`
- **Query Parameters**
  - **Required**: none
  - **Optional** (all strings in URL; validated and coerced):
    - `page` (number; default 1; min 1)
    - `page_size` (number; default 20; min 1; max 100)
    - `sort` in `{ published_at, report_week, title }` (default `published_at`)
    - `order` in `{ asc, desc }` (default `desc`)
    - `week` (ISO week string; e.g., `2025-W42`)
    - `version` (string)
    - `published_before` (ISO datetime)
    - `published_after` (ISO datetime)

Validation rules:
- Clamp `page_size` to [1, 100].
- Reject invalid `sort`/`order` values.
- `week` must match `^\d{4}-W\d{2}$`.
- `published_before`/`published_after` must parse to valid datetimes; if both are provided, ensure `published_after <= published_before`.

### 3. Used Types

- From `src/types.ts`:
  - `ReportListItemDTO`
  - `ReportsListResponseDTO`
  - `ReportsListQuery`
  - `SortOrder`

### 4. Response Details

- **200 OK**
  - Body: `ReportsListResponseDTO`
    - `items`: Array of `ReportListItemDTO` with fields
      - `report_id, slug, report_week, published_at, version, title, summary, created_at`
    - `page, page_size, total_items, total_pages`
- **400 Bad Request**
  - Invalid or conflicting query params (e.g., bad ISO week/date, out-of-range values, `published_after > published_before`).
- **500 Internal Server Error**
  - Unexpected server/database errors.

Caching headers for public content:
- `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120`
- Optional: `ETag` computed from a stable hash of the response payload for conditional requests.

### 5. Data Flow

1. Parse query params from `context.request.url` and validate with Zod.
2. Build a Supabase query against `weekly_reports` selecting only `ReportListItemDTO` fields with `{ count: 'exact' }` to obtain total count.
3. Apply filters:
   - `eq('report_week', week)` when provided.
   - `eq('version', version)` when provided.
   - `gte('published_at', published_after)` when provided.
   - `lte('published_at', published_before)` when provided.
4. Apply sorting and pagination:
   - Whitelist and map `sort` to DB columns exactly.
   - `.order(sort, { ascending: order === 'asc' })`
   - Compute `from = (page - 1) * page_size`, `to = from + page_size - 1`, use `.range(from, to)`.
5. Execute the query; on success, compute `total_pages = Math.ceil(total_items / page_size)`.
6. Shape and return `ReportsListResponseDTO` with 200 and caching headers.

### 6. Security Considerations

- **Authentication**: Not required; public endpoint under RLS. Accept bearer tokens if present; do not require them.
- **Authorization**: RLS allows `SELECT` to anon/auth roles on `weekly_reports`.
- **Input Hardening**:
  - Strictly whitelist `sort` columns; never interpolate untrusted column names.
  - Clamp `page_size` to 100 to limit load.
  - Validate dates and ISO week format to avoid unexpected query shapes.
- **Rate Limiting**: 60/min per IP (documented; implement simple in-memory limiter or rely on platform).

### 7. Error Handling

- **400 Bad Request** for:
  - Non-numeric or out-of-range `page`/`page_size`.
  - Invalid `sort`/`order`.
  - Malformed `week` or invalid `published_before`/`published_after`.
  - `published_after > published_before`.
- **500 Internal Server Error** for:
  - Database errors (network, unexpected failures).

Error body shape (consistent minimal contract):
```json
{ "code": "bad_request", "message": "<human-readable>" }
```
```json
{ "code": "server_error", "message": "unexpected error" }
```

Logging:
- Log structured errors server-side with context `{ route: '/api/reports', query, error }`. No dedicated error table is defined for public queries.

### 8. Performance Considerations

- Use selective columns only (DTO Pick) to reduce payload size and IO.
- Leverage indexes:
  - `weekly_reports(published_at DESC)` for default ordering.
  - Uniques on `slug` and (`report_week`,`version`) do not affect list but ensure integrity.
- Keep `page_size` ≤ 100; default 20.
- Consider response caching (60s TTL) and optional `ETag` for conditional GETs.
- `count: 'exact'` can be heavier on large tables; acceptable initially. If needed, consider approximate counts or capped result windows.

### 9. Implementation Steps

1. Validation schema (new): `src/lib/validation/reports.ts`
   - Zod schema `reportsListQuerySchema` that:
     - Coerces and validates `page`, `page_size`, `sort`, `order`.
     - Validates `week` via regex `^\d{4}-W\d{2}$`.
     - Validates `published_before`/`published_after` as ISO datetimes and ensures ordering when both present.
     - Provides defaults: `page=1`, `page_size=20`, `sort='published_at'`, `order='desc'`.
   - Helper: `parseReportsListQuery(url: URL): ReportsListQuery`.

2. Service (new): `src/lib/services/reports.ts`
   - `listReports(supabase, query: ReportsListQuery): Promise<ReportsListResponseDTO>`
   - Implements select with explicit columns, filters, ordering, pagination, and `count: 'exact'`.
   - Returns shaped DTO and pagination metadata.

3. API route (new): `src/pages/api/reports.ts`
   - `export const prerender = false`.
   - `export async function GET(context)`:
     - Parse/validate query using `parseReportsListQuery`.
     - `const supabase = context.locals.supabase` (works for anon and auth).
     - Call `listReports(supabase, query)`.
     - Return 200 with JSON body and caching headers; on validation error return 400; on unexpected error return 500.

4. Optional IP rate limiting
   - Lightweight in-memory token bucket keyed by IP for 60/min to align with plan.
   - Return 429 with `{ code: 'rate_limited', message: 'too many requests' }` if implemented.

5. Tests
   - Unit tests for `reportsListQuerySchema` (valid/invalid, clamping, date order checks).
   - Integration tests for DB query via Supabase emulator or test schema: basic listing, filters, sorting, pagination, boundaries.

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/reports.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { parseReportsListQuery } from '@/lib/validation/reports';
import { listReports } from '@/lib/services/reports';

export const GET: APIRoute = async (context) => {
  const { request, locals } = context;
  const url = new URL(request.url);

  try {
    const query = parseReportsListQuery(url);
    const result = await listReports(locals.supabase, query);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err: any) {
    if (err?.code === 'bad_request') {
      return new Response(JSON.stringify({ code: 'bad_request', message: err.message }), { status: 400 });
    }
    return new Response(JSON.stringify({ code: 'server_error', message: 'unexpected error' }), { status: 500 });
  }
};
```

### 11. Service Outline

```ts
// src/lib/services/reports.ts
import type { ReportsListQuery, ReportsListResponseDTO, ReportListItemDTO } from '@/types';

const COLUMNS = [
  'report_id', 'slug', 'report_week', 'published_at', 'version', 'title', 'summary', 'created_at',
] as const;

export async function listReports(supabase: App.Locals['supabase'], query: ReportsListQuery): Promise<ReportsListResponseDTO> {
  const { page = 1, page_size = 20, sort = 'published_at', order = 'desc', week, version, published_before, published_after } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let request = supabase
    .from('weekly_reports')
    .select(COLUMNS.join(','), { count: 'exact' })
    .order(sort, { ascending: order === 'asc' })
    .range(from, to);

  if (week) request = request.eq('report_week', week);
  if (version) request = request.eq('version', version);
  if (published_after) request = request.gte('published_at', published_after);
  if (published_before) request = request.lte('published_at', published_before);

  const { data, count, error } = await request;
  if (error) throw error;

  const items = (data ?? []) as unknown as ReportListItemDTO[];
  const total_items = count ?? 0;
  const total_pages = Math.max(1, Math.ceil(total_items / page_size));

  return { items, page, page_size, total_items, total_pages };
}
```

### 12. Validation Outline

```ts
// src/lib/validation/reports.ts
import { z } from 'zod';
import type { ReportsListQuery } from '@/types';

const sortValues = z.enum(['published_at', 'report_week', 'title']);
const orderValues = z.enum(['asc', 'desc']);
const isoWeek = z.string().regex(/^\d{4}-W\d{2}$/);
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const reportsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort: sortValues.default('published_at'),
  order: orderValues.default('desc'),
  week: isoWeek.optional(),
  version: z.string().min(1).optional(),
  published_before: isoDate.optional(),
  published_after: isoDate.optional(),
}).superRefine((val, ctx) => {
  if (val.published_before && val.published_after) {
    if (new Date(val.published_after) > new Date(val.published_before)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'published_after must be <= published_before', path: ['published_after'] });
    }
  }
});

export function parseReportsListQuery(url: URL): ReportsListQuery {
  const obj = Object.fromEntries(url.searchParams.entries());
  const parsed = reportsListQuerySchema.safeParse(obj);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => i.message).join('; ');
    const error: any = new Error(message);
    error.code = 'bad_request';
    throw error;
  }
  return parsed.data;
}
```

### 13. Files to Add/Update

- New: `src/lib/validation/reports.ts`
- New: `src/lib/services/reports.ts`
- New: `src/pages/api/reports.ts`
- No middleware changes required for public GET; existing `locals.supabase` usage applies.

