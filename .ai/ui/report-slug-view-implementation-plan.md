# View Implementation Plan Report Detail (/reports/[slug])

## 1. Overview

Public report-detail page that renders a single weekly report and its 1–5 stock picks. The page is server-rendered for performance and SEO, with a lightweight React island to capture a dwell-based engagement event (`report_view`) after at least 10 seconds of active viewing. It must prominently display disclaimers and format dates and percentages per PRD.

## 2. View Routing

- Path: `/reports/[slug]`
- File: `src/pages/reports/[slug].astro`
- Access: Public (no auth required). Returns 404 for unknown slug.

## 3. Component Structure

- `src/pages/reports/[slug].astro` (SSR)
  - `Header` (SSR)
  - `SEOHead` (SSR)
  - `ReportHeader` (SSR)
  - `PicksList` (SSR)
  - `DisclaimerBlock` (SSR)
  - `DwellTimer` (React island)
  - `Footer` (SSR)

## 4. Component Details

### ReportHeader (SSR)

- Component description: Displays report title, summary, ISO week, published date (UTC), and version. Establishes semantic headings for the page.
- Main elements: `header`, `h1` (title), `p` (summary), definition list or inline meta (`report_week`, `published_at`, `version`).
- Handled interactions: None.
- Handled validation:
  - Ensure `title` is non-empty; fallback to slug in rare cases (should not occur given API contract).
  - Format `published_at` as `YYYY-MM-DD` (UTC) and optionally show a user-local time tooltip.
- Types:
  - Props: `ReportHeaderProps = { report: ReportMetaVM }`.
- Props:
  - `report`: View model containing formatted fields (see Types section).

### PicksList (SSR)

- Component description: Renders 1–5 stock picks with ticker, exchange, side, target change percentage (2 decimals), and rationale.
- Main elements: `section` with `h2` (e.g., "Picks"), list of items using `article` per pick; semantic labels and bolded tickers.
- Handled interactions: None (read-only).
- Handled validation:
  - If `picks.length === 0`, display a friendly empty state per US-020.
  - Display `target_change_pct` to two decimals, with sign, e.g., `+12.34%`.
  - Side must be `"long" | "short"`.
- Types:
  - Props: `PicksListProps = { picks: PickItemVM[] }`.
- Props:
  - `picks`: Array of pick view models (see Types section).

### DisclaimerBlock (SSR)

- Component description: Legal notices required by PRD; appears on every report page.
- Main elements: `aside` with small text; include Not investment advice and corporate actions note.
- Handled interactions: None.
- Handled validation:
  - Always rendered, regardless of data state.
- Types:
  - Props: none (or optional `variant?: "compact"|"default"`).
- Props:
  - None (default rendering).

### DwellTimer (React island)

- Component description: Tracks active view time. Posts a `report_view` event via `POST /api/events` once when `dwell_seconds >= 10`. Pauses when the tab is hidden and on page visibility changes; ensures a single post per view.
- Main elements: React functional component rendered as an island; no visible UI by default.
- Handled interactions:
  - `visibilitychange`: pause/resume timer.
  - `pagehide`/`beforeunload`/`freeze` events: stop timers and prevent late posts.
- Handled validation:
  - Only send event if accumulated active time >= 10 seconds.
  - Include `report_id` in payload when available.
  - Send at threshold (e.g., fire once at 10s) to avoid unload losses.
- Types:
  - Props: `DwellTimerProps = { reportId: UUID; thresholdSeconds?: number }`.
  - Uses `PostEventCommand` and expects `PostEventAcceptedDTO` on 202.
- Props:
  - `reportId`: UUID from report DTO.
  - `thresholdSeconds`: default 10.

### SEOHead (SSR)

- Component description: Page `<head>` metadata for SEO/OG/Twitter. Uses report title and summary.
- Main elements: `title`, `meta[name=description]`, OpenGraph tags, canonical URL.
- Handled interactions: None.
- Handled validation:
  - Ensure title/description lengths are reasonable and escaped.
- Types:
  - Props: `{ title: string; description?: string; canonicalPath: string }`.
- Props:
  - `title`, `description`, `canonicalPath`.

## 5. Types

Leverage existing DTOs from `src/types.ts`, and add lightweight view models for formatting.

- Existing DTOs
  - `ReportWithPicksDTO = { report: ReportDTO; picks: StockPickDTO[] }`
  - `ReportDTO = Pick<WeeklyReportEntity, "report_id"|"slug"|"report_week"|"published_at"|"version"|"title"|"summary"|"created_at">`
  - `StockPickDTO = Pick<StockPickEntity, "pick_id"|"report_id"|"ticker"|"exchange"|"side"|"target_change_pct"|"rationale"|"created_at">`
  - Events: `PostEventCommand`, `PostEventAcceptedDTO`, `PublicEventType`

- New View Models (for SSR shaping)
  - `type ReportMetaVM = {
  reportId: UUID;
  slug: string;
  title: string;
  summary: string;
  reportWeek: string; // e.g., 2025-W42
  publishedAtUtc: string; // ISO
  publishedDateDisplay: string; // YYYY-MM-DD
  version: string;
}`
  - `type PickItemVM = {
  pickId: UUID;
  ticker: string;
  exchange: string;
  side: "long" | "short";
  targetChangePct: number; // raw
  targetChangePctDisplay: string; // e.g., +12.34%
  rationale: string;
}`
  - `type ReportWithPicksVM = { report: ReportMetaVM; picks: PickItemVM[] }`

- Component Props
  - `ReportHeaderProps = { report: ReportMetaVM }`
  - `PicksListProps = { picks: PickItemVM[] }`
  - `DisclaimerBlockProps = {}` (optional variant)
  - `DwellTimerProps = { reportId: UUID; thresholdSeconds?: number }`
  - `SEOHeadProps = { title: string; description?: string; canonicalPath: string }`

## 6. State Management

- SSR page has no client-side state.
- `DwellTimer` island manages local state:
  - `elapsedMs: number` — accumulated visible time.
  - `hasPosted: boolean` — prevents duplicate event posts.
  - `isActive: boolean` — whether timer is running (based on Page Visibility API and lifecycle events).
- A custom hook `useDwellTimer({ thresholdSeconds, onThresholdReached })` can encapsulate the timer logic, pause/resume, and visibility handling.

## 7. API Integration

- GET (SSR): `GET /api/reports/{slug}`
  - Request: `slug` from route params
  - Response 200: `ReportWithPicksDTO`
    - `report`: `{ report_id, slug, report_week, published_at, version, title, summary, created_at }`
    - `picks`: `StockPickDTO[]`
  - Response 404: `{ code: "not_found", message: "report not found" }`
  - Cache: Server respects `Cache-Control` and ETag headers; SSR fetch does not need client handling.

- POST (client, island): `POST /api/events`
  - Request JSON (`PostEventCommand`):
    - `event_type`: `"report_view"`
    - `dwell_seconds`: number (>= 10)
    - `report_id`: UUID
    - `metadata`: optional
  - Response 202: `{ event_id: UUID, accepted: true }`
  - Errors: 400 invalid, 422 dwell < 10, 429 rate limit. On failure, log and do not retry aggressively.

## 8. User Interactions

- Page load: User views report content; no input required.
- Dwell capture: After 10s of active viewing (tab visible), a single `report_view` is posted.
- Navigation: Browser back/forward; ensure timer pauses on hidden and does not fire if threshold not met.

## 9. Conditions and Validation

- Slug presence: If SSR fetch returns 404, render a 404 page with a link to `/`.
- Picks count: If `picks.length === 0`, show an inline empty state under the picks section.
- Formatting:
  - Dates: Display `published_at` as `YYYY-MM-DD` (UTC), optionally a local time tooltip.
  - Numbers: `target_change_pct` formatted to two decimals with sign and trailing `%`.
- Event posting:
  - Only when `dwell_seconds >= 10` and only once per view.
  - Include `report_id` from DTO.

## 10. Error Handling

- 404 Not Found: Show a friendly 404 page with a CTA back to Reports List.
- 500/Network errors (SSR fetch): Render an error boundary or inline `ErrorBanner` with a retry link to reload.
- Event post failure (client): Log to console at `warn` level; no user-facing error; do not block reading experience.
- Data anomalies (unexpected fields): Fail softly by omitting the field or applying defaults; never crash the page.

## 11. Implementation Steps

1. Create page: `src/pages/reports/[slug].astro`.
   - Fetch `GET /api/reports/{slug}` server-side using `Astro.fetch`.
   - On 404, set status and render 404 template.
   - Shape DTO to VM for `ReportHeader`, `PicksList`, and `DwellTimer` props.
2. Implement `src/components/report/ReportHeader.astro` (SSR).
   - Render semantic `h1` for title; summary; meta row with ISO week, date, and version.
3. Implement `src/components/report/PicksList.astro` (SSR).
   - Render `h2` heading; map picks to `article` items; show formatted percentage and rationale.
   - Show empty state if no picks.
4. Implement `src/components/common/DisclaimerBlock.astro` (SSR).
   - Include Not investment advice and corporate actions note.
5. Add `SEOHead.astro` (or reuse existing) to set title, description, canonical path.
6. Create React island `src/components/islands/DwellTimer.tsx`.
   - Props: `{ reportId: UUID; thresholdSeconds?: number }`.
   - Implement `useDwellTimer` hook to accumulate visible time; fire a single POST at threshold with `{ event_type: "report_view", dwell_seconds, report_id }`.
   - Pause/resume on `visibilitychange`; guard against duplicates; cleanup timers on unmount.
7. Styling with Tailwind 4 and Shadcn/ui primitives.
   - Ensure responsive typography and spacing; maintain accessible contrast and focus outlines.
8. Accessibility
   - Headings: `h1` for report title; `h2` for Picks; `aria-live` unnecessary as page is SSR static.
   - Keyboard navigation: Ensure links are focusable and visible.
9. Testing and validation
   - Verify 404 flow with invalid slug.
   - Confirm date/percentage formats.
   - Simulate visibility changes to validate timer behavior and single event post.
   - Check headers/footers and disclaimer visibility on all viewports.
10. Performance

- Keep island minimal; no heavy dependencies.
- Confirm SSR uses API caching headers implicitly; no client fetch for content.

---

- Tech alignment: Astro 5, TypeScript 5, React 19 islands, Tailwind 4, Shadcn/ui.
- PRD/User Stories coverage: FR-031 (content), FR-060 (disclaimer), FR-051 (numeric formatting), FR-070 (>=10s event), FR-080 (performance); US-002, US-015, US-016, US-018, US-021, US-026.
