# View Implementation Plan Historical Picks

## 1. Overview

A public, server-rendered table at `/picks` listing all historical stock picks. It supports simple sorting on all columns and paginated navigation. On page load, it emits a `table_view` engagement event. The table is responsive (horizontal scroll on small screens) and accessible (keyboard-operable headers, `aria-sort`, `aria-live` announcements).

## 2. View Routing

- Path: `/picks`
- Rendering: Astro SSR page (server-first data fetch) with a small React island for sortable headers and event emission.

## 3. Component Structure

- `src/pages/picks.astro`
  - `Header`
  - `SEOHead`
  - `PicksTable` (SSR)
    - `SortableTableHeader` (React island)
  - `DisclaimerBlock` (SSR)
  - `PaginationControls` (SSR)
  - `EmptyState` (SSR)
  - `ErrorBanner` (SSR)
  - `TableViewEventClient` (React island; posts `table_view` on mount)
  - `Footer`

## 4. Component Details

### PicksTable (SSR)

- Component description: Renders the historical picks table using data fetched server-side from `GET /api/picks`. Displays: `published_at`, `report_week`, `ticker`, `exchange`, `side`, `target_change_pct`, and a link to the related report.
- Main elements: `<table>` with `<thead>` and `<tbody>`; responsive wrapper `<div class="overflow-x-auto">` for horizontal scroll on mobile.
- Handled interactions:
  - None directly; header interactions delegated to `SortableTableHeader`.
- Handled validation:
  - Expects a sanitized dataset. If empty: render `EmptyState` instead of table body.
- Types:
  - Input: `PicksListResponseDTO` with `items: PicksHistoryItemDTO[]`.
  - View model per row: `PicksRowVM` (see Types section).
- Props:
  - `data: PicksListResponseDTO`
  - `query: PicksListQuery` (current, sanitized)

### SortableTableHeader (React island)

- Component description: Accessible sort controls in table headers; toggles `sort` and `order` via URL updates to trigger SSR reload. Announces changes via `aria-live`.
- Main elements: `<button>` or `<a>` in `<th>` with `aria-sort`, visually indicating current sort and direction; hidden `<span aria-live="polite">` announcer.
- Handled interactions:
  - Click on a header: toggles direction if already sorted by that column; otherwise sets `sort` to that column and `order` to default desc for `published_at`, asc otherwise.
  - Keyboard: headers focusable; Enter/Space triggers toggle.
- Handled validation:
  - Clamp next `sort` to allowed set: `published_at|ticker|exchange|side|target_change_pct`.
  - Clamp next `order` to `asc|desc`.
- Types:
  - `SortableColumn = PicksListQuery["sort"]` (narrowed union)
- Props:
  - `currentSort: NonNullable<PicksListQuery['sort']>`
  - `currentOrder: SortOrder`
  - `buildHref: (next: Partial<PicksListQuery>) => string` (preserve other params)

### PaginationControls (SSR)

- Component description: Renders Prev/Next and numeric pages, preserving `sort`, `order`, and `page_size` in links.
- Main elements: `<nav role="navigation" aria-label="Pagination">` with page links.
- Handled interactions:
  - Link navigation only; server re-renders.
- Handled validation:
  - Disable/omit Prev at page 1; disable/omit Next at last page.
- Types:
  - Uses `Paginated<unknown>` envelope fields.
- Props:
  - `page: number`
  - `total_pages: number`
  - `buildHref: (next: Partial<PicksListQuery>) => string`

### EmptyState (SSR)

- Component description: Friendly message when no picks exist.
- Main elements: `<section>` with iconography and copy; link to `/`.
- Handled interactions: None.
- Handled validation: N/A.
- Types: None.
- Props: Optional `resetHref?: string` to clear query params.

### ErrorBanner (SSR)

- Component description: Inline error display when API returns non-200 or parse/validation fails.
- Main elements: `<div role="alert">` with message and a “Reset” link.
- Handled interactions: Clicking reset navigates to sanitized defaults.
- Handled validation:
  - Shows mapped messages for 400 (invalid params); generic copy for 500.
- Types: `ErrorViewModel`.
- Props:
  - `code?: 'bad_request' | 'server_error' | string`
  - `message: string`
  - `resetHref: string`

### DisclaimerBlock (SSR)

- Component description: Legal notices required by the PRD; appears on the picks page to reinforce “Not investment advice” and corporate actions caveat.
- Main elements: `<aside>` with small text content including both disclaimers.
- Handled interactions: None.
- Handled validation:
  - Always rendered on the page regardless of data/error state.
- Types: none (static content).
- Props: none (or optional `variant?: "compact"|"default"` if reused across pages).

### TableViewEventClient (React island)

- Component description: On mount, POSTs `{ event_type: 'table_view' }` to `/api/events` and silently ignores failures.
- Main elements: none (headless component).
- Handled interactions: none; runs effect once.
- Handled validation:
  - Ensures single fire per mount; guards duplicate posts using a ref.
- Types: `PostEventCommand`, `PostEventAcceptedDTO`.
- Props: none.

## 5. Types

- Backend DTOs (existing in `src/types.ts`):
  - `PicksHistoryItemDTO`: `{ published_at, report_week, ticker, exchange, side, target_change_pct, report_id }`
  - `PicksListResponseDTO`: `Paginated<PicksHistoryItemDTO>`
  - `PicksListQuery`: `{ page?, page_size?, sort?, order?, ticker?, exchange?, side?, date_before?, date_after? }`
  - `SortOrder`: `'asc' | 'desc'`
  - `Side`: `'long' | 'short'`
  - Events: `PostEventCommand`, `PostEventAcceptedDTO`, `PublicEventType`

- New ViewModels:
  - `PicksRowVM`:
    - `publishedDateISO: string` // YYYY-MM-DD formatted
    - `reportWeek: string`
    - `ticker: string`
    - `exchange: string`
    - `side: Side`
    - `targetChangePctDisplay: string` // e.g., `12.34%`
    - `reportLinkHref: string` // see challenge note about slug vs id
  - `ErrorViewModel`:
    - `code?: string`
    - `message: string`

## 6. State Management

- Server state: Data fetched in `picks.astro` using current URL params; no client cache needed.
- Client state (React islands only):
  - `SortableTableHeader`: derives next sort/order; maintains `aria-live` announcement message transiently.
  - `TableViewEventClient`: internal ref to avoid duplicate posts.
- No global client state; all meaningful state represented in URL query params.

## 7. API Integration

- GET `/api/picks`
  - Query: `PicksListQuery`
    - `page` (default 1; min 1)
    - `page_size` (default 20; max 100)
    - `sort` in `{ 'published_at','ticker','exchange','side','target_change_pct' }` (default `published_at`)
    - `order` in `{ 'asc','desc' }` (default `desc`)
    - Filters (not surfaced in UI for MVP): `ticker`, `exchange`, `side`, `date_before`, `date_after`
  - Response: `200 OK` with `PicksListResponseDTO`
  - Cache: API sets `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=120`

- POST `/api/events`
  - Request JSON (for table view): `{ event_type: 'table_view' } as PostEventCommand`
  - Response: `202 Accepted` with `PostEventAcceptedDTO`
  - Error mapping: ignore non-fatal failures; do not block UI

## 8. User Interactions

- Click table headers: toggles sort; URL updates; page reloads SSR; focus remains on the activated header after navigation (use `id` + `#fragment` or `autofocus` pattern).
- Pagination link clicks: navigate preserving `sort`, `order`, `page_size`.
- Initial page load: fires `table_view` event once.

## 9. Conditions and Validation

- URL Params (component-level checks before calling API):
  - `page`: parse int ≥ 1; default to 1 if invalid.
  - `page_size`: parse int ∈ [1,100]; default to 20 if invalid.
  - `sort`: whitelist to allowed fields; default `published_at`.
  - `order`: whitelist to `asc|desc`; default `desc`.
- Rendering conditions:
  - If `items.length === 0`: show `EmptyState` and hide table/pagination.
  - If API returns 400: show `ErrorBanner` with reset link to sanitized defaults.

## 10. Error Handling

- 400 Bad Request (invalid params): show `ErrorBanner` with message “Invalid parameters. Showing defaults.” and a Reset action.
- 500 Server Error: show `ErrorBanner` with retry guidance; link preserves current params.
- Network failures (GET): show `ErrorBanner`; do not attempt client retry.
- Event POST failure: swallow error (log to console in dev); no UI impact.

## 11. Implementation Steps

1. Create `src/pages/picks.astro` that:
   - Parses URL params; sanitizes into `PicksListQuery`.
   - Server-fetches `GET /api/picks` with sanitized params.
   - If non-200: map to `ErrorBanner`; else render `PicksTable` and `PaginationControls`.
   - Includes `TableViewEventClient` island and `SEOHead`.
2. Implement `PicksTable` SSR partial (co-located in `src/components/picks/PicksTable.astro`):
   - Accepts `data` and `query` props.
   - Maps `PicksHistoryItemDTO` to `PicksRowVM` (format date and percent to two decimals).
   - Renders responsive `<table>` with `aria` attributes.
3. Implement `SortableTableHeader` React island (e.g., `src/components/picks/SortableTableHeader.tsx`):
   - Props: `currentSort`, `currentOrder`, `buildHref`.
   - Emits correct hrefs and manages `aria-live` announcements.
4. Implement `PaginationControls` SSR partial (e.g., `src/components/common/PaginationControls.astro`):
   - Renders Prev/Next and page numbers; disables as needed; uses `buildHref`.
5. Implement `EmptyState` and `ErrorBanner` SSR components (reusable under `src/components/common`).
6. Implement `TableViewEventClient` (e.g., `src/components/analytics/TableViewEventClient.tsx`):
   - `useEffect` on mount; POST `/api/events` with `{ event_type: 'table_view' }`.
   - Guard double-sends with a ref; ignore failures.
7. Wire layout:
  - Ensure `Header`, `DisclaimerBlock`, and `Footer` are included; `DisclaimerBlock` satisfies PRD FR-060.
8. A11y & UX polish:
   - `aria-sort` reflects state; focus styles visible; add `aria-live` announcements.
   - Horizontal scroll wrapper on small viewports.
9. Testing and validation:
   - Verify default sort is Date desc.
   - Verify all headers toggle correctly and URL reflects state.
   - Verify pagination preserves sort/order.
   - Verify `table_view` event fires once per page view.

### Notes on Report Link

- The picks API returns `report_id` but not `slug`. Options:
  - Preferred: extend `picks_history`/`/api/picks` to include `slug` for direct link to `/reports/[slug]`.
  - Alternative: create a detail route `/reports/id/[report_id]` that fetches by ID and renders the same view.
  - Interim: link to `/reports?id={report_id}` with server-side redirect to slug (if supported).


