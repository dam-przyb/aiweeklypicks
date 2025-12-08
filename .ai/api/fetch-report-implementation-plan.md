## API Endpoint Implementation Plan: GET /api/reports/{slug}

### 1. Endpoint Overview

Public endpoint that fetches a single weekly report by its permalink `slug`, including all associated stock picks. Anonymous access is allowed under RLS; bearer tokens (when present) are accepted but not required. Returns a `report` object and a `picks` array.

### 2. Request Details

- **HTTP Method**: GET
- **URL**: `/api/reports/{slug}`
- **Path Params**
  - `slug` (string): permalink of the report

Validation rules for `slug` (defensive hardening):

- Non-empty string, length 1..120
- Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase, digits, hyphens)

### 3. Used Types

- From `src/types.ts`:
  - `ReportWithPicksDTO` (response)
  - `ReportDTO` (report sub-object)
  - `StockPickDTO` (picks array items)
  - `ReportSlugParams` (path params)

### 4. Response Details

- **200 OK**
  - Body: `ReportWithPicksDTO` with fields
    - `report`: `{ report_id, slug, report_week, published_at, version, title, summary, created_at }`
    - `picks`: array of `{ pick_id, report_id, ticker, exchange, side, target_change_pct, rationale, created_at }`
- **404 Not Found**
  - When no report exists with the specified `slug`.
- **400 Bad Request**
  - When `slug` fails validation (empty or malformed).
- **500 Internal Server Error**
  - Unexpected server/database errors.

Caching headers:

- `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120`
- Optional: `ETag` based on a hash of `{ report.report_id, report.updated fields?, picks length + checksums }` (or simply JSON payload hash) to support conditional GET.

### 5. Data Flow

1. Extract and validate `slug` from `context.params.slug` using Zod.
2. Query `weekly_reports` for a single row by `slug`, selecting `ReportDTO` fields.
3. If not found → return 404.
4. Using the found `report_id`, query `stock_picks` for associated picks.
   - Apply a stable order (e.g., `ticker` asc, then `side` asc) for deterministic client rendering.
5. Return combined `{ report, picks }` in 200 response with caching headers.

### 6. Security Considerations

- **Authentication**: Not required; accept anon requests. Use `context.locals.supabase` which may be anon or user-bound.
- **Authorization**: RLS allows `SELECT` on `weekly_reports` and `stock_picks` for anon/auth roles.
- **Input Hardening**: Validate `slug` against a safe pattern and length limit; avoid passing unsanitized values to queries (Supabase query builder parameterizes).
- **Rate Limiting**: 60/min per IP for public GET; can be implemented as a lightweight in-memory limiter or via platform controls.

### 7. Error Handling

- **400 Bad Request** when `slug` is missing or invalid format.
- **404 Not Found** when the report does not exist.
- **500 Internal Server Error** for unexpected database or server failures.

Error body shape:

```json
{ "code": "bad_request", "message": "invalid slug" }
```

```json
{ "code": "not_found", "message": "report not found" }
```

```json
{ "code": "server_error", "message": "unexpected error" }
```

Server-side logging (structured): `{ route: '/api/reports/{slug}', slug, error }`.

### 8. Performance Considerations

- Select only required columns for `report` and `picks` to reduce payload.
- Indexes leveraged:
  - `weekly_reports(slug UNIQUE)` for O(1) report lookup.
  - `stock_picks(report_id)` for fast picks retrieval.
- Keep response caching with 60s TTL; consider `ETag` for conditional GET.
- Typical cardinality of picks per report is small; no pagination needed.

### 9. Implementation Steps

1. Validation schema (new): `src/lib/validation/report-by-slug.ts`
   - Zod schema `reportSlugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`.
   - Helper: `parseReportSlug(params: ReportSlugParams): string` that throws `bad_request` code on failure.

2. Service (new): `src/lib/services/reportBySlug.ts`
   - `getReportWithPicksBySlug(supabase, slug: string): Promise<ReportWithPicksDTO | null>`
   - Steps:
     - Fetch single report by slug; if no row, return `null`.
     - Fetch picks by `report_id` ordered by `ticker` asc, then `side` asc.
     - Shape and return `{ report, picks }`.

3. API route (new): `src/pages/api/reports/[slug].ts`
   - `export const prerender = false`.
   - `export async function GET(context)`:
     - Read `slug` from `context.params` and validate via `parseReportSlug`.
     - Call `getReportWithPicksBySlug(locals.supabase, slug)`.
     - If `null`, return 404 with `{ code: 'not_found', message: 'report not found' }`.
     - Else, return 200 with the DTO and caching headers.

4. Tests
   - Unit tests for slug validation (valid/invalid examples, boundaries).
   - Integration tests covering: existing slug, non-existing slug (404), picks ordering, caching headers presence.

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/reports/[slug].ts
export const prerender = false;

import type { APIRoute } from "astro";
import { parseReportSlug } from "@/lib/validation/report-by-slug";
import { getReportWithPicksBySlug } from "@/lib/services/reportBySlug";

export const GET: APIRoute = async (context) => {
  const { locals, params } = context;

  try {
    const slug = parseReportSlug({ slug: String(params?.slug ?? "") });
    const result = await getReportWithPicksBySlug(locals.supabase, slug);
    if (!result) {
      return new Response(JSON.stringify({ code: "not_found", message: "report not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err: any) {
    if (err?.code === "bad_request") {
      return new Response(JSON.stringify({ code: "bad_request", message: err.message || "invalid slug" }), {
        status: 400,
      });
    }
    return new Response(JSON.stringify({ code: "server_error", message: "unexpected error" }), { status: 500 });
  }
};
```

### 11. Service Outline

```ts
// src/lib/services/reportBySlug.ts
import type { ReportWithPicksDTO, ReportDTO, StockPickDTO } from "@/types";

const REPORT_COLUMNS = [
  "report_id",
  "slug",
  "report_week",
  "published_at",
  "version",
  "title",
  "summary",
  "created_at",
] as const;

const PICK_COLUMNS = [
  "pick_id",
  "report_id",
  "ticker",
  "exchange",
  "side",
  "target_change_pct",
  "rationale",
  "created_at",
] as const;

export async function getReportWithPicksBySlug(
  supabase: App.Locals["supabase"],
  slug: string
): Promise<ReportWithPicksDTO | null> {
  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS.join(","))
    .eq("slug", slug)
    .single();

  if (reportError?.code === "PGRST116" /* No rows */) return null; // Supabase PostgREST not found code
  if (reportError) throw reportError;
  if (!report) return null;

  const { data: picks, error: picksError } = await supabase
    .from("stock_picks")
    .select(PICK_COLUMNS.join(","))
    .eq("report_id", report.report_id)
    .order("ticker", { ascending: true })
    .order("side", { ascending: true });

  if (picksError) throw picksError;

  return { report: report as unknown as ReportDTO, picks: (picks ?? []) as unknown as StockPickDTO[] };
}
```

### 12. Validation Outline

```ts
// src/lib/validation/report-by-slug.ts
import { z } from "zod";
import type { ReportSlugParams } from "@/types";

export const reportSlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export function parseReportSlug(params: ReportSlugParams): string {
  const parsed = reportSlugSchema.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    const error: any = new Error(message || "invalid slug");
    error.code = "bad_request";
    throw error;
  }
  return parsed.data.slug;
}
```

### 13. Files to Add/Update

- New: `src/lib/validation/report-by-slug.ts`
- New: `src/lib/services/reportBySlug.ts`
- New: `src/pages/api/reports/[slug].ts`
- No middleware changes required for public GET; existing `locals.supabase` usage applies.
