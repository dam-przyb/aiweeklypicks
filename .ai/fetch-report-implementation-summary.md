## GET /api/reports/{slug} - Implementation Summary

### Overview
Successfully implemented a public REST API endpoint that fetches a single weekly report by its permalink slug, including all associated stock picks. The implementation follows the plan in `fetch-report-implementation-plan.md`.

### Files Created

#### 1. Validation Layer
- **`src/lib/validation/report-by-slug.ts`**
  - Zod schema for slug validation (lowercase, digits, hyphens; 1-120 chars)
  - `parseReportSlug()` helper that throws `bad_request` error on invalid input
  - Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`

#### 2. Service Layer
- **`src/lib/services/reportBySlug.ts`**
  - `getReportWithPicksBySlug()` function
  - Fetches report by slug using `.single()` query
  - Returns `null` for 404 (PGRST116 error code)
  - Fetches picks ordered by `ticker` asc, then `side` asc
  - Returns `ReportWithPicksDTO` shape

#### 3. API Route
- **`src/pages/api/reports/[slug].ts`**
  - `export const prerender = false`
  - Validates slug via `parseReportSlug()`
  - Calls service with `locals.supabase`
  - Returns 200 with report+picks, 404 if not found, 400 for invalid slug, 500 for errors
  - **ETag support**: Computes weak ETag from JSON payload hash; returns 304 when `If-None-Match` matches
  - Caching headers: `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120`

#### 4. Utility
- **`src/lib/hash.ts`**
  - `hashJSON()` function using Node's crypto to create SHA-256 digest
  - Used for ETag generation

### Files Modified

#### 1. Middleware
- **`src/middleware/index.ts`**
  - Changed rate limiting from exact route match to prefix matching
  - Now covers `/api/reports/*` including slug routes
  - Rate limit: 60 requests/min per IP for all public GET endpoints

### Testing

#### 1. Unit Tests
- **`src/lib/validation/report-by-slug.test.ts`** (18 tests)
  - Valid slugs: lowercase, digits, hyphens, single char, max length (120)
  - Invalid slugs: empty, too long (121+), uppercase, leading/trailing/consecutive hyphens, special chars, spaces, dots
  - `parseReportSlug()` error handling with `bad_request` code

#### 2. Integration Tests
- **`src/pages/api/reports/[slug].test.ts`** (7 tests)
  - 200 response with report and picks
  - 304 response when ETag matches (conditional GET)
  - 404 when slug doesn't exist
  - 400 for invalid/empty slug
  - 500 for unexpected service errors
  - Picks ordering verification
  - Proper headers (content-type, cache-control, etag)

#### 3. Test Infrastructure
- **`vitest.config.ts`** - Vitest configuration with path aliases
- **`package.json`** - Added test scripts (`test`, `test:ui`, `test:run`)
- Installed: `vitest`, `@vitest/ui`

### Test Results
✅ All 25 tests passing
- 18 validation tests
- 7 endpoint integration tests

### Security & Performance

#### Security
- Slug validation prevents injection attacks
- RLS policies apply (anon read allowed)
- Rate limiting: 60/min per IP
- Input sanitization via Zod

#### Performance
- Minimal column selection (only DTO fields)
- Leverages database indexes:
  - `weekly_reports(slug UNIQUE)`
  - `stock_picks(report_id)`
- HTTP caching with 60s TTL
- ETag support for conditional GET (304 responses save bandwidth)
- Stable ordering for deterministic responses

### Response Examples

#### Success (200)
```json
{
  "report": {
    "report_id": "uuid",
    "slug": "weekly-report-2025-w42",
    "report_week": "2025-W42",
    "published_at": "2025-10-20T00:00:00Z",
    "version": "v1",
    "title": "Weekly Report",
    "summary": "Market analysis...",
    "created_at": "2025-10-20T00:00:00Z"
  },
  "picks": [
    {
      "pick_id": "uuid",
      "report_id": "uuid",
      "ticker": "AAPL",
      "exchange": "NASDAQ",
      "side": "long",
      "target_change_pct": 5.5,
      "rationale": "Strong fundamentals",
      "created_at": "2025-10-20T00:00:00Z"
    }
  ]
}
```

#### Not Found (404)
```json
{
  "code": "not_found",
  "message": "report not found"
}
```

#### Bad Request (400)
```json
{
  "code": "bad_request",
  "message": "String must contain at least 1 character(s)"
}
```

#### Server Error (500)
```json
{
  "code": "server_error",
  "message": "unexpected error"
}
```

### Usage

#### Fetch a report
```bash
curl http://localhost:4321/api/reports/weekly-report-2025-w42
```

#### Conditional GET with ETag
```bash
# First request
curl -i http://localhost:4321/api/reports/weekly-report-2025-w42
# Returns: ETag: W/"abc123..."

# Subsequent request
curl -H 'If-None-Match: W/"abc123..."' http://localhost:4321/api/reports/weekly-report-2025-w42
# Returns: 304 Not Modified (no body)
```

### Implementation Quality

✅ All requirements from implementation plan met
✅ Clean separation of concerns (validation → service → route)
✅ Comprehensive error handling (400/404/500)
✅ Structured logging for debugging
✅ Full test coverage with unit + integration tests
✅ Performance optimizations (caching, ETag, minimal queries)
✅ Security hardening (validation, rate limiting, RLS)
✅ Follows project coding standards and patterns

### Next Steps (Optional Enhancements)

1. **Performance monitoring**: Add metrics for cache hit rate, response times
2. **OpenAPI/Swagger docs**: Document endpoint in API specification
3. **E2E tests**: Test against real Supabase instance
4. **Observability**: Add structured logging with correlation IDs
5. **Compression**: Add gzip/brotli for larger responses (though picks are typically small)

