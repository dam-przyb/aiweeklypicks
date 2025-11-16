# View Implementation Plan – Reports List (Home)

## 1. Overview
A public, SEO-friendly list of weekly AI stock reports rendered at the home route. The page displays report cards with `title`, `report_week`, `published_at`, `version`, `summary`, and links into report details by `slug`. Users can change sorting (default `published_at desc`) and paginate. The page handles empty states and clear error messages for invalid query parameters.

## 2. View Routing
- Path: `/`
- File: `src/pages/index.astro`
- Rendering: SSR (Astro) with a small React island for sort controls.

## 3. Component Structure
- `src/pages/index.astro` (page)
  - `SEOHead` (astro/SSR) — metadata and structured data
  - `Header` (astro/SSR)
  - `ErrorBanner` (astro/SSR, conditional)
  - `SortControls` (React island)
  - `ReportList` (astro/SSR)
    - repeated `ReportCard` (astro/SSR)
  - `PaginationControls` (astro/SSR)
  - `EmptyState` (astro/SSR, conditional)
  - `Footer` (astro/SSR)

## 4. Component Details
### IndexPage (`src/pages/index.astro`)
- Purpose: Compose the view, fetch data from `GET /api/reports`, pass data and URL state into child components, handle errors/empty states.
- Main elements:
  - Server-side fetch from internal API using `Astro.url.searchParams`.
  - Conditional `ErrorBanner` and `EmptyState`.
  - `SortControls` island initialized from URL.
  - `ReportList` and `PaginationControls` rendered with fetched data.
- Handled interactions: None directly (delegated to children).
- Validation conditions:
  - Normalize incoming query params: ensure `page >= 1`, `page_size` within `[1,100]`, `sort` in allowed set, `order` in `asc|desc`.
  - Coerce invalid values to defaults before building links.
- Types: `ReportsListResponseDTO`, `ReportListItemDTO`, `ReportsListQuery`, `ReportListItemViewModel` (new, see Types).
- Props: N/A (page root). Receives data from API.

### SEOHead
- Purpose: Provide page `<title>`, meta description, and structured data.
- Main elements: `<title>`, meta tags, optional JSON-LD for list.
- Handled interactions: None.
- Validation: Ensure safe escaping of dynamic content.
- Types: none (string props only) — `title: string`, `description: string`.
- Props: `{ title, description }`.

### Header / Footer
- Purpose: Global shell for navigation and brand/footer info.
- Main elements: Semantic `<header>`/`<footer>` with nav links.
- Interactions: Standard navigation.
- Validation: A11y landmarks.
- Types: none.
- Props: none (or site metadata if already standardized).

### ErrorBanner
- Purpose: Display friendly error messages for invalid params (400) and server errors (500).
- Main elements: `<div role="alert">` with message and optional Reset Filters button.
- Interactions: Reset button clears sorting/pagination to defaults.
- Validation: Only renders when error is present.
- Types: `{ code?: 'bad_request'|'server_error', message?: string }`.
- Props: `{ errorCode?: string; errorMessage?: string; onReset?: () => void }`.

### SortControls (React island)
- Purpose: Allow sorting by `published_at|report_week|title` and order `asc|desc`.
- Main elements: Shadcn/ui `Select` for sort field, `Button` toggle for order; accessible labels and focus.
- Interactions:
  - Changing sort/order updates the URL query and triggers navigation for SSR reload.
- Validation:
  - Only allow valid options; if invalid in URL, initialize to defaults.
- Types: `ReportsListQuery` subset; `SortStateViewModel` (new, see Types).
- Props: `{ initialSort: 'published_at'|'report_week'|'title'; initialOrder: 'asc'|'desc'; otherParams: URLSearchParamsLike }`.

### ReportList
- Purpose: Render a list of report cards.
- Main elements: `<section>` containing multiple `ReportCard` components.
- Interactions: None.
- Validation: If `items.length === 0`, do not render; let `EmptyState` handle.
- Types: `ReportListItemViewModel[]`.
- Props: `{ items: ReportListItemViewModel[] }`.

### ReportCard
- Purpose: Display a single report summary and navigate to detail.
- Main elements: Card with `title` (link to `/reports/[slug]`), `report_week`, `published_at` (ISO string, UTC), `version`, `summary`.
- Interactions: Click title or CTA navigates to detail.
- Validation: Ensure required fields exist; fallback copy for missing summary.
- Types: `ReportListItemViewModel`.
- Props: `{ item: ReportListItemViewModel }`.

### PaginationControls
- Purpose: Navigate across pages, preserving other query params.
- Main elements: Prev/Next buttons and page indicators; accessible with `aria-label`s.
- Interactions: Click to navigate to `?page=N` while retaining `sort`, `order`, `week`, `version`, `published_*` filters.
- Validation:
  - Disable Prev when `page <= 1`.
  - Disable Next when `page >= total_pages`.
- Types: `{ page: number; page_size: number; total_pages: number; total_items: number; otherParams: URLSearchParamsLike }`.
- Props: Same as above.

### EmptyState
- Purpose: Friendly message when there are no reports.
- Main elements: Icon, title, short copy, and a button to reset filters.
- Interactions: Reset button clears query params to defaults.
- Validation: Only render when `items.length === 0` and not in error.
- Types: none.
- Props: `{ onReset?: () => void }`.

## 5. Types
Use the shared DTOs from `src/types.ts` and add minimal view models for formatting.

Existing:
- `ReportsListResponseDTO = Paginated<ReportListItemDTO>`
- `ReportListItemDTO` with: `report_id`, `slug`, `report_week`, `published_at`, `version`, `title`, `summary`, `created_at`.
- `ReportsListQuery` with: `page?`, `page_size?`, `sort?`, `order?`, `week?`, `version?`, `published_before?`, `published_after?`.

New (view-only):
- `type ReportListItemViewModel = {
  reportId: string; // UUID
  slug: string;
  title: string;
  reportWeek: string; // e.g., 2025-W42
  publishedAtIso: string; // UTC ISO YYYY-MM-DD
  publishedAtLocalTooltip: string; // localized datetime string for tooltip
  version: string;
  summary: string;
}`
- `type SortStateViewModel = {
  sort: 'published_at'|'report_week'|'title';
  order: 'asc'|'desc';
}`
- `type URLSearchParamsLike = Record<string, string | string[] | undefined>`

Mapping: Convert `ReportListItemDTO` into `ReportListItemViewModel` by formatting `published_at` to `YYYY-MM-DD` for display and computing a localized tooltip string for hover.

## 6. State Management
- SSR data: fetched in `index.astro` from `GET /api/reports` and passed to SSR children as plain props.
- Client state (React island): `SortControls` holds `sort` and `order` in local state initialized from URL, and updates URL on change using `history.replaceState` followed by `location.assign(location.href)` to trigger SSR reload (or use `location.search = ...`).
- No global state needed.

## 7. API Integration
- Endpoint: `GET /api/reports` (implemented in `src/pages/api/reports.ts`).
- Request query params (subset of `ReportsListQuery`):
  - `page` (default 1, min 1)
  - `page_size` (default 20, min 1, max 100)
  - `sort` in `published_at|report_week|title` (default `published_at`)
  - `order` in `asc|desc` (default `desc`)
  - Optionally: `week`, `version`, `published_before`, `published_after`
- Response: `ReportsListResponseDTO` with `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Server fetch: In `index.astro` frontmatter, build query from `Astro.url.searchParams`, coerce/validate, then call `await fetch(new URL('/api/reports' + '?' + qs, Astro.url))` and parse JSON.

## 8. User Interactions
- Sort field change: Updates `sort` query param, resets `page=1`, navigates to SSR-rendered page.
- Order toggle: Toggles `order`, resets `page=1`, navigates.
- Pagination click: Navigates to `?page=N` preserving other query params.
- Reset filters (from ErrorBanner/EmptyState): Clears `sort`, `order`, `page` to defaults.
- Report card click: Navigates to `/reports/[slug]` for detail page.

## 9. Conditions and Validation
- Query constraints applied before generating links and as initial state:
  - `page`: if missing or `<1`, use `1`.
  - `page_size`: if missing or out of range, use `20`.
  - `sort`: if not in allowed set, use `published_at`.
  - `order`: if not `asc|desc`, use `desc`.
- UI constraints:
  - `aria-disabled` and pointer-disabled on Prev/Next when at bounds.
  - `aria-sort` reflected via control labels; provide visible state for keyboard users.
- Display formatting:
  - Dates shown as ISO `YYYY-MM-DD` (UTC) with local time tooltip.

## 10. Error Handling
- 400 Bad Request (validation errors): Show `ErrorBanner` with the server message and a Reset button that rewrites URL to defaults.
- 500 Server Error or network errors: Show generic error copy with retry/Reset.
- Empty results: Show `EmptyState` with call to action to reset filters.
- Defensive rendering: Omit broken cards if required fields are missing; log to console in dev.

## 11. Implementation Steps
1. Create `src/pages/index.astro` with SSR frontmatter: read `Astro.url.searchParams`, normalize query, fetch `/api/reports`, branch on success/error.
2. Build `SEOHead` within the page with appropriate title and description.
3. Implement `ErrorBanner` (astro/SSR) with reset handler that navigates to `/` (no query).
4. Implement `SortControls` (React island) under `src/components/SortControls.tsx` using Shadcn/ui `Select` and `Button`:
   - Props: `initialSort`, `initialOrder`, `otherParams`.
   - On change: update URL params, reset `page=1`, navigate.
5. Implement `ReportList` (astro/SSR) in `src/components/ReportList.astro` that repeats `ReportCard` for items.
6. Implement `ReportCard` (astro/SSR) in `src/components/ReportCard.astro` with Tailwind layout and link to `/reports/[slug]`.
7. Implement `PaginationControls` (astro/SSR) in `src/components/PaginationControls.astro` that renders Prev/Next and page indicators; preserve query params.
8. Implement `EmptyState` (astro/SSR) with reset link to `/`.
9. Create types for view models under `src/types.ts` extensions or local `src/components/types.ts` (keep view-only types local to the view): `ReportListItemViewModel`, `SortStateViewModel`, `URLSearchParamsLike`.
10. Map DTO to VM in `index.astro` after fetch: format `published_at` to ISO `YYYY-MM-DD` and build `publishedAtLocalTooltip`.
11. Styling: Apply Tailwind 4 classes; use Shadcn/ui primitives only in the React island.
12. Accessibility: Ensure focus outlines, labels, and `aria-*` attributes on controls; keyboard operation ok.
13. Manual QA: Verify defaults (`published_at desc`), sorting changes, pagination, empty state, and error states for malformed URLs.
