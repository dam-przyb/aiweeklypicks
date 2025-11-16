## API Endpoint Implementation Plan: GET /api/picks

### 1. Endpoint Overview

Public endpoint that returns a historical table of stock picks with pagination, sorting, and filtering. It should use the `picks_history` materialized view when available (preferred for performance). If the MV is missing, fall back to a join between `weekly_reports` and `stock_picks` to produce the same shape. Anonymous access is allowed under RLS.

### 2. Request Details

- **HTTP Method**: GET
- **URL**: `/api/picks`
- **Query Parameters**
  - **Required**: none
  - **Optional** (validated and coerced):
    - `page` (number; default 1; min 1)
    - `page_size` (number; default 20; min 1; max 100)
    - `sort` in `{ published_at, ticker, exchange, side, target_change_pct }` (default `published_at`)
    - `order` in `{ asc, desc }` (default `desc`)
    - `ticker` (string; exact match; case-insensitive)
    - `exchange` (string; exact match; case-insensitive)
    - `side` in `{ long, short }`
    - `date_before` (ISO datetime; filters `published_at <= date_before`)
    - `date_after` (ISO datetime; filters `published_at >= date_after`)

Validation rules:
- Clamp `page_size` to [1, 100].
- Whitelist `sort`/`order` to allowed values.
- `side` strictly matches enum values.
- `date_before`/`date_after` must be valid datetimes; if both present, ensure `date_after <= date_before`.

### 3. Used Types

- From `src/types.ts`:
  - `PicksHistoryItemDTO`
  - `PicksListResponseDTO`
  - `PicksListQuery`
  - `Side`

### 4. Response Details

- **200 OK**
  - Body: `PicksListResponseDTO`
    - `items`: Array of `PicksHistoryItemDTO` with fields
      - `published_at, report_week, ticker, exchange, side, target_change_pct, report_id`
    - `page, page_size, total_items, total_pages`
- **400 Bad Request**
  - Invalid parameters, bad enum values, date constraints violated.
- **500 Internal Server Error**
  - Unexpected server/database errors.

Caching headers for public content:
- `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120`
- Optional: `ETag` based on stable hash of response body for conditional GETs.

### 5. Data Flow

1. Parse query params from `context.request.url` and validate with Zod.
2. Try querying `picks_history` with select of `PicksHistoryItemDTO` columns and `{ count: 'exact' }`.
3. Apply filters:
   - `ticker` → case-insensitive: `.ilike('ticker', ticker)` with exact match normalization (e.g., uppercase compare or `ilike(ticker)` if DB data is normalized).
   - `exchange` → case-insensitive equality via `.ilike('exchange', exchange)`.
   - `side` → `.eq('side', side)`.
   - `published_at` → `.gte('published_at', date_after)`, `.lte('published_at', date_before)`.
4. Apply sorting and pagination:
   - `.order(sort, { ascending: order === 'asc' })` on `picks_history`.
   - Compute `from = (page - 1) * page_size`, `to = from + page_size - 1`; use `.range(from, to)`.
5. If the `picks_history` relation is missing (e.g., PGRST error code for relation not found) or returns an error clearly indicating absence, fall back to join:
   - Base: `from('stock_picks')` with `select('ticker,exchange,side,target_change_pct,report_id,weekly_reports(published_at,report_week)')` using an inner join on FK `report_id`.
   - Filters: apply to `stock_picks` columns; for date filters, apply to `weekly_reports.published_at` via `.gte('published_at', date_after, { foreignTable: 'weekly_reports' })` and similar for `lte`.
   - Sorting: when `sort === 'published_at'`, use `.order('published_at', { foreignTable: 'weekly_reports', ascending })`; otherwise order by local columns on `stock_picks`.
   - Map rows to `PicksHistoryItemDTO` shape.
   - For `count`, use `{ count: 'exact' }` on the joined select (Supabase counts after join).
6. Build pagination envelope and return 200 with caching headers.

### 6. Security Considerations

- **Authentication**: Not required; accept anon requests.
- **Authorization**: RLS allows `SELECT` on `picks_history` (read-only) and source tables for fallback.
- **Input Hardening**:
  - Strictly whitelist sort columns; never interpolate raw input into column names.
  - Clamp `page_size` to 100.
  - Validate dates and enum `side` to avoid malformed queries.
- **Rate Limiting**: 60/min per IP (documented; can be implemented in middleware/platform).

### 7. Error Handling

- **400 Bad Request** for:
  - Non-numeric or out-of-range `page`/`page_size`.
  - Invalid `sort`/`order` or `side` outside enum.
  - Malformed `date_before`/`date_after` or `date_after > date_before`.
- **500 Internal Server Error** for unexpected DB errors.

Error JSON examples:
```json
{ "code": "bad_request", "message": "invalid query parameters" }
```
```json
{ "code": "server_error", "message": "unexpected error" }
```

Server-side logging: `{ route: '/api/picks', query, error }`.

### 8. Performance Considerations

- Prefer `picks_history` MV for performance; DB indexes on `published_at` and `ticker` support common sorts/filters.
- Keep `page_size` ≤ 100.
- Use selective columns only.
- Cache responses for 60s; consider `ETag`.
- `count: 'exact'` can be heavier; acceptable initially. Consider approximate counts in future if needed.

### 9. Implementation Steps

1. Validation schema (new): `src/lib/validation/picks.ts`
   - Zod `picksListQuerySchema`:
     - `page` min 1, `page_size` min 1 max 100; defaults 1/20.
     - `sort` enum: `published_at|ticker|exchange|side|target_change_pct`; default `published_at`.
     - `order` enum: `asc|desc`; default `desc`.
     - `ticker`, `exchange` optional strings; optionally normalize casing.
     - `side` enum `long|short` optional.
     - `date_before`, `date_after` as ISO datetimes; cross-validate ordering.
   - Helper: `parsePicksListQuery(url: URL): PicksListQuery`.

2. Service (new): `src/lib/services/picks.ts`
   - `listPicks(supabase, query: PicksListQuery): Promise<PicksListResponseDTO>`
   - Attempts MV first; on specific relation-missing error, falls back to join query.
   - Applies filters, sorting, pagination, and returns DTO envelope.

3. API route (new): `src/pages/api/picks.ts`
   - `export const prerender = false`.
   - `export async function GET(context)`:
     - Parse/validate with `parsePicksListQuery`.
     - Call `listPicks(locals.supabase, query)`.
     - Return 200 with JSON and caching headers; 400 on validation error; 500 on unexpected errors.

4. Tests

   - Unit tests for `picksListQuerySchema` (valid/invalid parameters, clamping, date ordering).
   - Integration tests for listing with MV present; simulate MV missing and validate fallback join path.
   - Sorting and filter combinations (ticker, exchange, side, date ranges).

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/picks.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { parsePicksListQuery } from '@/lib/validation/picks';
import { listPicks } from '@/lib/services/picks';

export const GET: APIRoute = async (context) => {
  const { request, locals } = context;
  const url = new URL(request.url);
  try {
    const query = parsePicksListQuery(url);
    const result = await listPicks(locals.supabase, query);
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
// src/lib/services/picks.ts
import type { PicksListQuery, PicksListResponseDTO, PicksHistoryItemDTO } from '@/types';

const COLUMNS = [
  'published_at', 'report_week', 'ticker', 'exchange', 'side', 'target_change_pct', 'report_id',
] as const;

function applyCommonFilters(request: any, q: PicksListQuery, fallbackJoin = false) {
  if (q.ticker) request = request.ilike('ticker', q.ticker);
  if (q.exchange) request = request.ilike('exchange', q.exchange);
  if (q.side) request = request.eq('side', q.side);
  if (q.date_after) request = request.gte('published_at', q.date_after, fallbackJoin ? { foreignTable: 'weekly_reports' } : undefined as any);
  if (q.date_before) request = request.lte('published_at', q.date_before, fallbackJoin ? { foreignTable: 'weekly_reports' } : undefined as any);
  return request;
}

export async function listPicks(supabase: App.Locals['supabase'], query: PicksListQuery): Promise<PicksListResponseDTO> {
  const { page = 1, page_size = 20, sort = 'published_at', order = 'desc' } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  try {
    let req = supabase
      .from('picks_history')
      .select(COLUMNS.join(','), { count: 'exact' });

    req = applyCommonFilters(req, query, false);
    req = req.order(sort, { ascending: order === 'asc' }).range(from, to);

    const { data, count, error } = await req;
    if (error) throw error;

    const items = (data ?? []) as unknown as PicksHistoryItemDTO[];
    const total_items = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total_items / page_size));
    return { items, page, page_size, total_items, total_pages };
  } catch (e: any) {
    // If relation missing or similar, fall back to join
    const relationMissing = typeof e?.message === 'string' && /relation .* does not exist|not found/i.test(e.message);
    if (!relationMissing) throw e;

    const select = [
      'ticker', 'exchange', 'side', 'target_change_pct', 'report_id',
      'weekly_reports(published_at,report_week)'
    ].join(',');

    let req = supabase
      .from('stock_picks')
      .select(select, { count: 'exact' });

    req = applyCommonFilters(req, query, true);

    // Sorting (published_at lives on weekly_reports in fallback)
    if (sort === 'published_at') {
      req = req.order('published_at', { ascending: order === 'asc', foreignTable: 'weekly_reports' });
    } else {
      req = req.order(sort, { ascending: order === 'asc' });
    }

    req = req.range(from, to);

    const { data, count, error } = await req;
    if (error) throw error;

    const mapped = (data ?? []).map((row: any) => ({
      published_at: row.weekly_reports?.published_at,
      report_week: row.weekly_reports?.report_week,
      ticker: row.ticker,
      exchange: row.exchange,
      side: row.side,
      target_change_pct: row.target_change_pct,
      report_id: row.report_id,
    })) as PicksHistoryItemDTO[];

    const total_items = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total_items / page_size));
    return { items: mapped, page, page_size, total_items, total_pages };
  }
}
```

### 12. Validation Outline

```ts
// src/lib/validation/picks.ts
import { z } from 'zod';
import type { PicksListQuery } from '@/types';

const sortValues = z.enum(['published_at', 'ticker', 'exchange', 'side', 'target_change_pct']);
const orderValues = z.enum(['asc', 'desc']);
const sideEnum = z.enum(['long', 'short']);
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const picksListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort: sortValues.default('published_at'),
  order: orderValues.default('desc'),
  ticker: z.string().min(1).optional(),
  exchange: z.string().min(1).optional(),
  side: sideEnum.optional(),
  date_before: isoDate.optional(),
  date_after: isoDate.optional(),
}).superRefine((val, ctx) => {
  if (val.date_before && val.date_after) {
    if (new Date(val.date_after) > new Date(val.date_before)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date_after must be <= date_before', path: ['date_after'] });
    }
  }
});

export function parsePicksListQuery(url: URL): PicksListQuery {
  const obj = Object.fromEntries(url.searchParams.entries());
  const parsed = picksListQuerySchema.safeParse(obj);
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

- New: `src/lib/validation/picks.ts`
- New: `src/lib/services/picks.ts`
- New: `src/pages/api/picks.ts`
- No middleware changes required for public GET; use `locals.supabase`.

