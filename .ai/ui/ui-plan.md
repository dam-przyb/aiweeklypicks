## UI Architecture for AI Weekly Picks (MVP)

### 1. UI Structure Overview

- **Framework**: Astro SSR for core pages (SEO, fast FCP) with selective React islands for interactivity (sorting, timers, uploads, toasts).
- **Routing (public, auth, admin, legal)**:
  - `/` (Reports list), `/reports/[slug]` (Report detail), `/picks` (Historical picks)
  - `/auth/login`, `/auth/register`
  - `/admin/imports`, `/admin/imports/[import_id]`
  - `/legal/tos-en`, `/legal/tos-pl`, `/legal/privacy-en`, `/legal/privacy-pl`
- **Data fetching**: Server-first via Astro directly calling internal API endpoints; client fetch only for interactions (events, admin mutations) and small revalidations.
- **Caching**: Honor API `Cache-Control` and ETags (~60s TTL) on public GETs; SWR-style revalidation for admin lists as needed.
- **Auth and authorization**: Supabase Auth JWT on client; middleware guard for admin routes; role-aware navigation (admin links hidden for non-admins); friendly 401/403 flows.
- **A11y and UX**: WCAG AA, semantic headings, keyboard operability, focus rings, `aria-sort` for tables, responsive layout with table horizontal scroll/stack on mobile.
- **Security**: HTTPS enforced, admin-only routes guarded by middleware and server checks; rate-limit errors surfaced; no privileged actions without JWT.
- **Global chrome**: Header with role-aware nav, Footer with disclaimers and legal links; consistent tokens (Tailwind + Shadcn/ui) for typography, color, spacing.


### 2. View List

#### A) Reports List (Home)
- **View path**: `/`
- **Main purpose**: Publicly browse weekly reports in reverse publish date order and navigate to report details.
- **Key information**:
  - Report cards: `title`, `report_week`, `published_at`, `summary`, `slug`
  - Pagination (`page`, `page_size`)
  - Sorting (`sort` in `published_at|report_week|title`, `order` asc|desc) with defaults (`published_at desc`)
- **Key view components**:
  - `Header`, `Footer`
  - `ReportCard` list (SSR)
  - `SortControls` (React island; maps state to URL query params)
  - `PaginationControls` (SSR links; reflects URL params)
  - `EmptyState` and `ErrorBanner`
  - `SEOHead` for structured data/metadata
- **UX, accessibility, security**:
  - `aria-sort` on table/list headers when sortable
  - Keyboard-focusable sort controls with visible focus
  - Server errors mapped to friendly copy (400 invalid params); show retry
  - Public access; no auth required
- **API usage**: `GET /api/reports`
- **PRD mapping**: FR-030, FR-050, FR-051, FR-080, FR-040; US-001, US-016, US-020, US-025, US-027

#### B) Report Detail
- **View path**: `/reports/[slug]`
- **Main purpose**: Display full weekly report with all picks and record dwell-based engagement.
- **Key information**:
  - Report: `title`, `summary`, `report_week`, `published_at`, `version`
  - Picks: 1–5 items with `ticker`, `exchange`, `side`, `target_change_pct`, `rationale`
  - Disclaimer: Not investment advice; corporate actions note
- **Key view components**:
  - `Header`, `Footer`
  - `ReportHeader` (SSR)
  - `PicksList` (SSR)
  - `DisclaimerBlock` (SSR)
  - `DwellTimer` (React island; posts `report_view` after ≥10s with pause on `visibilitychange`)
  - `SEOHead`
- **UX, accessibility, security**:
  - Semantic headings (h1 report title, h2 sections)
  - Preserve keyboard accessibility for in-page navigation
  - Post `report_view` once per view; cancel on unload; guard `dwell_seconds ≥ 10`
  - Public access; 404 when slug not found; prefetch on hover from list
- **API usage**: `GET /api/reports/{slug}`; `POST /api/events` (report_view)
- **PRD mapping**: FR-031, FR-060, FR-051, FR-070 (>=10s), FR-080; US-002, US-015, US-016, US-018, US-021, US-026

#### C) Historical Picks
- **View path**: `/picks`
- **Main purpose**: Public table of all picks with simple sorting; record table view event.
- **Key information**:
  - Columns: `published_at` (Date), `report_week`, `ticker`, `exchange`, `side`, `target_change_pct`, link to report
  - Sorting on all columns; default Date desc; pagination
- **Key view components**:
  - `Header`, `Footer`
  - `PicksTable` (SSR table, responsive; horizontal scroll on small screens)
  - `SortableTableHeader` (React island for accessible sort toggles updating URL)
  - `PaginationControls`
  - `EmptyState`, `ErrorBanner`
- **UX, accessibility, security**:
  - `aria-sort` and `aria-live` updates for sort state
  - Keyboard operable headers; visible focus rings
  - Record `table_view` on page load (client-side `POST /api/events`)
  - Public access; cache 60s with ETag
- **API usage**: `GET /api/picks`; `POST /api/events` (table_view)
- **PRD mapping**: FR-032, FR-051, FR-070, FR-080; US-003, US-017, US-018

#### D) Auth: Login
- **View path**: `/auth/login`
- **Main purpose**: Authenticate user; set session; emit login event.
- **Key information**:
  - Email/password fields; validation; error feedback
  - Post-login redirect to return URL or `/`
- **Key view components**:
  - `Header`, `Footer`
  - `AuthForm` (React island with Zod validation)
  - `Toast` for success/error
- **UX, accessibility, security**:
  - Form labels, described-by error text; keyboard and screen reader friendly
  - Show rate-limit messages; prevent brute force with feedback
  - Secure token handling via Supabase; HTTPS only
- **API usage**: `POST /api/auth/login`; emits `login` event server-side
- **PRD mapping**: FR-020, FR-022, FR-070, FR-082; US-006, US-019, US-018

#### E) Auth: Register
- **View path**: `/auth/register`
- **Main purpose**: Create account; emit registration event; guide email verification.
- **Key information**:
  - Email/password fields; password policy hints; success state
- **Key view components**:
  - `Header`, `Footer`
  - `AuthForm` (React island with Zod validation)
  - `Toast` for success/error
- **UX, accessibility, security**:
  - Clear error messages; password policy guidance
  - Rate-limit feedback; secure handling of PII
- **API usage**: `POST /api/auth/register` (emits `registration_complete`)
- **PRD mapping**: FR-020, FR-070; US-005, US-018

#### F) Admin: Imports List & Upload
- **View path**: `/admin/imports`
- **Main purpose**: Admin-only page to upload JSON and view recent imports with statuses.
- **Key information**:
  - Upload form: accepts `.json` only; filename regex `YYYY-MM-DDreport.json`; client size ≤ 2MB
  - Imports list: `filename`, `status`, `started_at`, `finished_at`, `error_message`, link to detail
- **Key view components**:
  - `Header` (admin menu visible), `Footer`
  - `AdminGuard` (middleware + in-page friendly 403 fallback)
  - `FileUploadForm` (React island: multipart upload, progress bar, success link)
  - `ImportsTable` (SSR) with optional client polling (e.g., every 15–30s)
  - `Toast` and `InlineAlert` for errors (409, 413, 422)
- **UX, accessibility, security**:
  - Disable upload for invalid file type/size; inline validation errors
  - Keyboard accessible controls; focus management after upload
  - JWT attached to requests; 401 → redirect to login with return URL; friendly 403 for non-admins
- **API usage**: `POST /api/admin/imports`; `GET /api/admin/imports`
- **PRD mapping**: FR-010 to FR-015, FR-090 (hosting context), FR-081; US-009, US-010, US-011, US-012, US-014, US-023, US-029, US-030

#### G) Admin: Import Detail
- **View path**: `/admin/imports/[import_id]`
- **Main purpose**: Show a specific import audit with status and any error details; link to created report on success.
- **Key information**:
  - `import_id`, `filename`, `status`, `error_message`, `started_at`, `finished_at`, optional `report_id`/`report_slug`
- **Key view components**:
  - `Header` (admin menu), `Footer`
  - `AdminGuard`
  - `ImportAuditPanel` (SSR)
  - `Toast` for refresh feedback
- **UX, accessibility, security**:
  - Clear failure reasons (duplicate, schema errors, payload too large)
  - Admin-only access; JWT required
- **API usage**: `GET /api/admin/imports/{import_id}`
- **PRD mapping**: FR-012 to FR-015; US-011, US-012, US-023

#### H) Legal Pages
- **View paths**: `/legal/tos-en`, `/legal/tos-pl`, `/legal/privacy-en`, `/legal/privacy-pl`
- **Main purpose**: Provide legal content in EN/PL.
- **Key information**:
  - Static content blocks; language-specific slugs
- **Key view components**:
  - `Header`, `Footer`
  - `LegalContent` (SSR)
- **UX, accessibility, security**:
  - Semantic headings; readable typography; link from footer and header
  - Public access
- **API usage**: none (static)
- **PRD mapping**: FR-060; US-015

#### I) Error and Utility Views
- **401/Expired Session**: Redirect to `/auth/login?returnUrl=...` with toast
- **403**: Friendly admin-only page on `/admin/**` when not authorized
- **404**: For missing slugs or routes
- **500**: Generic error boundary with retry
- **PRD mapping**: FR-081, FR-082; US-024, US-025


### 3. User Journey Map

#### Primary flow: Guest discovers and reads a report
1) User lands on `/` → sees paginated, sortable list of reports (default published_at desc).
2) User optionally sorts/changes page; URL updates via query params; SSR reloads with cache.
3) User hovers and prefetches then clicks a report → `/reports/[slug]` loads (SSR).
4) On mount, `DwellTimer` starts (pauses on tab hide); after ≥10s, posts `report_view` to `/api/events` once.
5) User reads picks with disclaimer visible; can navigate back or proceed to `/picks`.

#### Secondary flow: Historical picks exploration
1) User opens `/picks`; `table_view` event posted.
2) User sorts by column headers; URL params update and SSR re-renders; table is responsive on mobile with horizontal scroll.

#### Auth flow: Register and login
1) From header, user selects Register or Login.
2) Form validates (Zod); on success, server emits `registration_complete` or `login` event.
3) Session persists; user is redirected to return URL or `/`.

#### Admin flow: Import report JSON
1) Admin opens `/admin/imports` (guarded). If unauthorized, sees 403 or login redirect.
2) Admin uploads `.json`; client validates filename regex and size ≤ 2MB.
3) Multipart form posts to `/api/admin/imports`; progress shown; on success, link to created report and `import_id` detail.
4) Admin views `/admin/imports/[import_id]` for full audit; list may auto-refresh at intervals.


### 4. Layout and Navigation Structure

- **Global header**:
  - Left: Logo linking to `/`
  - Primary nav: `Reports`, `Picks`, `Legal` (menu with ToS/Privacy EN/PL)
  - Right: `Login`/`Register` when signed out; `Logout` when signed in; `Admin` menu visible only if `profiles.is_admin = true`
  - Active route highlighting; all items keyboard focusable
- **Footer**:
  - Disclaimers: Not investment advice; corporate actions caveat
  - Links to legal pages; language switch for legal content
- **Responsive layout**:
  - Mobile-first; stacked layout; table horizontal scroll; generous tap targets
- **Middleware & guards**:
  - `src/middleware/index.ts` enforces admin access to `/admin/**`; 401 → login redirect with return URL, 403 → friendly page
  - Role-aware UI hides admin links for non-admins
- **Caching**:
  - Public pages: `Cache-Control` ~60s, ETags; revalidate on navigation
  - Admin pages: minimal caching; optional TanStack Query for client polling/revalidation


### 5. Key Components

- **Header**: Role-aware nav, active state, auth actions
- **Footer**: Disclaimers and legal links
- **SEOHead**: SSR meta, Open Graph, structured data
- **ReportCard**: Title, week, date, summary, link to detail
- **SortControls / SortableTableHeader**: Accessible sorting; reflects URL params; `aria-sort`
- **PaginationControls**: SSR links that preserve `page`, `page_size`, `sort`, `order`
- **PicksTable**: Responsive table with link to report; horizontal scroll on mobile
- **PicksList**: Compact list of picks for a report detail
- **DisclaimerBlock**: Not investment advice and corporate actions note
- **DwellTimer (island)**: Visibility-aware 10s timer posting `report_view`
- **PrefetchLink (island)**: Hover-based prefetch for report detail
- **AuthForm (island)**: Login/register with Zod validation; error mapping; toasts
- **FileUploadForm (island)**: JSON-only, filename regex, size checks; multipart upload with progress
- **ImportsTable / ImportAuditPanel**: Admin list and detail of imports; status and error display
- **Toast / InlineAlert / ErrorBanner**: Centralized error mapping (400/409/413/422/429)
- **EmptyState / Skeleton**: Empty data and loading placeholders
- **AdminGuard**: Client-side hinting; server-side enforced via middleware


### Compatibility and Mapping

- **Endpoints alignment**:
  - `/` → `GET /api/reports`
  - `/reports/[slug]` → `GET /api/reports/{slug}`, `POST /api/events` (report_view)
  - `/picks` → `GET /api/picks`, `POST /api/events` (table_view)
  - `/auth/login` → `POST /api/auth/login`
  - `/auth/register` → `POST /api/auth/register`
  - `/admin/imports` → `GET /api/admin/imports`, `POST /api/admin/imports`
  - `/admin/imports/[import_id]` → `GET /api/admin/imports/{import_id}`
- **Query param mapping**:
  - `page`, `page_size`, `sort`, `order` supported as documented; filters reserved for future (`week`, `version`, etc.)
- **User stories coverage**:
  - US-001, US-002, US-003, US-005, US-006, US-007, US-008, US-009, US-010, US-011, US-012, US-013, US-014, US-015, US-016, US-017, US-018, US-019, US-020, US-021, US-022, US-023, US-024, US-025, US-026, US-027, US-028, US-029, US-030
- **Requirements to UI elements**:
  - Sorting & pagination → `SortControls`, `SortableTableHeader`, `PaginationControls`
  - Disclaimers → `DisclaimerBlock` on report and picks pages
  - Event logging → `DwellTimer` and `table_view` trigger on `/picks`
  - Admin import → `FileUploadForm`, `ImportsTable`, `ImportAuditPanel`, `AdminGuard`
  - Auth flows → `AuthForm` with toasts and redirects
  - Error handling → `Toast`, `InlineAlert`, `ErrorBanner`, error routes


### Edge Cases and Error States

- **Report not found**: `/reports/[slug]` shows 404 with link back to `/`
- **Empty datasets**: `EmptyState` on `/` and `/picks` when no data
- **Invalid query params**: Map 400 errors to friendly UI with reset controls
- **Duplicate import**: Show 409 with clear copy; keep list visible
- **Payload too large**: 413 surfaced pre-submit (client) and post-submit (server)
- **Schema errors**: 422 with field-level messages in upload result
- **Auth issues**: 401 redirects to login with return URL; 403 admin-only page
- **Dwell nuances**: Handle `visibilitychange`, unload, bfcache restore; ensure single event per view
- **Performance**: Skeletons on initial load; prefetch on hover; respect cache headers


### Unresolved / Decisions to finalize

- **Slug source and 404 behavior**: Confirm server-generated slug contract and missing-slug UX.
- **Defaults for `page_size`**: Adopt API defaults (20) and max (100) consistently in UI.
- **Mobile prefetch strategy**: Consider no prefetch on mobile to save bandwidth.
- **Design tokens & dark mode**: Finalize tokens and whether to include dark mode in MVP.
- **Legal language switch UX**: Confirm approach for EN/PL selection beyond dedicated routes.
- **Admin list refresh**: Decide on polling interval (e.g., 30s) or manual refresh.



### Implementation Plans Index

- Reports List (`/`): `.ai/ui/reports-view-implementation-plan.md`
- Report Detail (`/reports/[slug]`): `.ai/ui/report-slug-view-implementation-plan.md`
- Historical Picks (`/picks`): `.ai/ui/historical-picks-view-implementation-plan.md`
- Auth Login (`/auth/login`): `.ai/ui/auth-login-view-implementation-plan.md`
- Auth Register (`/auth/register`): `.ai/ui/auth-register-view-implementation-plan.md`
- Admin Imports List & Upload (`/admin/imports`): `.ai/ui/admin-imports-view-implementation-plan.md`
- Admin Import Detail (`/admin/imports/[import_id]`): `.ai/ui/admin-import-detail-view-implementation-plan.md`
- Legal Pages (`/legal/*`): `.ai/ui/legal-pages-implementation-plan.md`
- Error & Utility Views (401/403/404/500): `.ai/ui/error-views-implementation-plan.md`