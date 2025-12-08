# Product Requirements Document (PRD) - AI Weekly Picks (MVP)

## 1. Product Overview

AI Weekly Picks is a lightweight web application that curates 1–5 U.S. stock ideas each week for intermediate retail investors with 500–50,000 PLN of deployable capital. It solves information overload by publishing a concise weekly report sourced from an external AI engine. The MVP ingests a versioned JSON file (admin-uploaded), stores results in Supabase Postgres, and exposes two user-facing experiences: a blog-style list of weekly reports and a historical picks table with simple sorting. For the MVP, all content is publicly visible to both guests and registered users. Authentication enables account creation and an admin-only import workflow.

Key objectives

- Publish weekly AI-selected picks with clear reasoning and minimal friction.
- Reduce time-to-insight for users via a clean reading experience.
- Validate initial user interest and engagement without adding payment or advanced features.

Target users

- Intermediate retail investors seeking time-efficient, objective, data-driven ideas.
- Admin operators who upload validated report JSON files.

Primary platforms and tech

- Frontend: Astro with React islands where beneficial.
- Backend: Supabase (Postgres, Auth, Storage if needed).
- Hosting: CDN-backed platform (e.g., Vercel or DigitalOcean App Platform) with automatic SSL.

## 2. User Problem

Problem statement

- Intermediate investors face information overload from news, research, and social media. Performing their own 1–3 month swing/investment research is time-consuming and requires specialized expertise. Users need succinct, trustworthy selections with clear reasoning.

Constraints and considerations

- Users want low-friction access in a web app without tool fatigue.
- They expect clear disclosures and locale-appropriate legal material.
- U.S. equities only for MVP; USD display; dates in ISO format.

How the MVP solves it

- Weekly, concise report with 1–5 AI-selected U.S. stocks, delivered as readable blog posts and a historical table. Admin uploads a validated JSON. App persists the content and renders it consistently with minimal latency.

## 3. Functional Requirements

Notation

- Requirements are labeled FR-xxx for traceability.

Data and schema

- FR-001: Database
  - Use Supabase Postgres.
  - Tables (minimum):
    - weekly_reports
      - report_id (UUID, PK)
      - report_week (ISO week, string such as 2025-W42)
      - published_at (UTC timestamp)
      - version (string, e.g., v1)
      - source_checksum (text, nullable for MVP)
      - title (text)
      - summary (text)
      - created_at (timestamp, default now())
    - stock_picks
      - pick_id (UUID, PK)
      - report_id (UUID, FK -> weekly_reports.report_id, on delete cascade)
      - ticker (text)
      - exchange (text)
      - side (enum: long|short)
      - target_change_pct (numeric)
      - rationale (text)
      - created_at (timestamp, default now())
    - imports_audit
      - import_id (UUID, PK)
      - uploaded_by_user_id (UUID referencing auth.users.id)
      - filename (text)
      - source_checksum (text, nullable)
      - started_at (timestamp)
      - finished_at (timestamp)
      - status (enum: success|failed)
      - error_message (text, nullable)
  - Indices/constraints:
    - weekly_reports.report_id unique PK; consider unique (report_week, version) to avoid duplicates.
    - stock_picks.pick_id PK; FK to weekly_reports with cascade.
- FR-002: JSON schema (v1)
  - Root-level fields: report_id (UUID), report_week (ISO week), published_at (UTC ISO datetime), version (string), source_checksum (string), title (string), summary (string), picks (array of pick objects).
  - Pick fields: pick_id (UUID), ticker (string), exchange (string), side (long|short), target_change_pct (number), rationale (string).
  - Validation: Strict schema validation at import. Reject files missing required fields or invalid enums/UUIDs.

Import and admin workflow

- FR-010: Admin-only import UI
  - Provide a protected admin page to upload a JSON file.
  - Only users with admin role may access and execute imports.
- FR-011: Filename convention and mapping
  - Enforce filename pattern: YYYY-MM-DDreport.json.
  - Map filename date to published_at (UTC midnight unless explicitly provided), and ensure report_week is consistent with published_at (ISO week). If both are provided and inconsistent, reject.
- FR-012: Atomic import and audit
  - Entire import executes in a single transaction: all-or-nothing.
  - Write an audit row for every import with timing, filename, user, status, and any error.
- FR-013: Validation and uniqueness
  - Enforce uniqueness by report_id.
  - Optionally enforce uniqueness by (report_week, version) if provided.
  - If a report with the same report_id already exists, reject the import with a clear error.
- FR-014: Idempotency and checksum (MVP minimal)
  - Store source_checksum if provided; do not require checksum for MVP.
  - If provided and matches an existing successful import’s checksum and report_id, reject as duplicate.
  - Dry-run preview is deferred beyond MVP.
- FR-015: Error handling
  - If schema validation fails, surface the exact field errors.
  - If any DB write fails, rollback and mark audit as failed.
  - Large file (>2MB) or malformed JSON returns a clear error.

Authentication and authorization

- FR-020: Registration and login
  - Email/password registration via Supabase Auth.
  - Email verification and password reset flows are supported.
  - Basic rate limiting on auth endpoints.
- FR-021: Roles
  - Admin role grants access to import UI and operations.
  - Regular users have standard viewing access (same content as guests for MVP).
- FR-022: Session management
  - Persist sessions according to Supabase best practices. Logout available.

User-facing UI

- FR-030: Reports list (blog view)
  - Public page lists weekly reports with title, week, publish date, and short summary.
  - Default order: published_at desc.
  - Pagination or lazy-load if needed.
- FR-031: Report detail page
  - Shows full report content and all picks (1–5) with ticker, exchange, side, target_change_pct, rationale.
  - Prominent Not investment advice disclaimer.
  - Record report_view event after 10 seconds dwell time.
- FR-032: Historical picks table
  - Public table of all picks with columns: Date (published_at), Ticker, Exchange, Side, Target change %.
  - Default sort: Date desc; allow simple sorting by each column.
  - Record table_view event on page view.

Access policy (MVP)

- FR-040: Public access
  - All reports and picks are visible to guests and logged-in users.
  - The prior 30-day gating idea is deferred to post-MVP.

Access policy (Post‑MVP update)

- FR-041: Gated access rules
  - Signed-in users: Full access to all weekly reports (list and detail) and the historical stock picks table.
  - Guests (unsigned users):
    - Reports: Can view and access only reports with `published_at <= current_date - 30 days` (list and detail).
    - Historical picks table: No access; surface a clear login/register CTA.
  - Enforcement:
    - Middleware guards the table route to require authentication.
    - Reports page data loaders filter by `published_at` cutoff for guests; signed-in users bypass the filter.
    - For direct linking to newer reports by guests, render a gated message with sign-in CTA or redirect to login with `redirectTo`.

Localization and formatting

- FR-050: Currency and dates
  - Display currency values in USD (if any appear in text).
  - Format dates as ISO YYYY-MM-DD; display publish time in UTC with a user-local time tooltip.
- FR-051: Numeric display
  - Display target_change_pct to two decimal places (e.g., 12.34%). Store raw values as provided.

Legal and compliance

- FR-060: Disclaimers and policies
  - Not investment advice disclaimer on every report page and pick presentation.
  - ToS and Privacy Policy available in Polish and English; jurisdiction Poland.
  - Cookie banner only if/when analytics sets cookies (not used for MVP).

Analytics and measurement (without third-party platform)

- FR-070: Event capture
  - Persist events in Postgres table events with fields: event_id (UUID), user_id (nullable), event_type (registration_complete|login|report_view|table_view), occurred_at (timestamp), user_agent (text), ip_hash (text), dwell_seconds (numeric, nullable), metadata (JSONB), is_staff_ip (boolean), is_bot (boolean).
  - Exclude staff IPs and obvious bots from KPI queries.
  - Record report_view only if dwell_seconds >= 10.
- FR-071: KPI queries
  - Provide SQL views or stored queries to compute success metrics as defined in section 6.

Non-functional

- FR-080: Performance
  - First contentful paint under 2.5s on typical broadband for report pages and the table page.
- FR-081: Reliability
  - Define minimal DB backup cadence (daily automated backups via Supabase). Error logging can rely on platform logs for MVP.
- FR-082: Security
  - Enforce HTTPS. Restrict admin routes. Basic brute-force mitigation for login.

Deployment

- FR-090: Hosting and SSL
  - Host Astro on CDN-backed platform (e.g., Vercel or DigitalOcean App Platform). Enable automatic SSL.

## 4. Product Boundaries

In scope (MVP)

- Public blog list of weekly reports and report detail pages.
- Historical picks table with simple sorting and default sort by date desc.
- Supabase Postgres storage for reports and picks; admin-only import of JSON.
- Supabase Auth (email/password) with email verification and password reset.
- Public access to all content (no 30-day gating for MVP).
- Legal pages (ToS, Privacy) in PL and EN; disclaimers on every report/pick.
- ISO date formatting, UTC publish time with local tooltip; USD display.
- Event logging in Postgres for minimal measurement of KPIs.

Out of scope (MVP)

- AI engine development, hosting, or real-time integration.
- Advanced table features (filters beyond simple sorts, search, export).
- Payments, subscriptions, or paywalls.
- Extended user profiles, avatars, settings.
- Notifications (email/push) for new reports.
- Data visualizations (charts, performance analytics).
- Third-party analytics tooling.

Assumptions and open items

- 30-day gating is enabled post-MVP: guests are limited to reports older than 30 days and cannot access the picks table.
- Idempotency: checksum stored when provided; strict duplicate prevention via report_id uniqueness. Dry-run preview deferred.
- Corporate actions: values are not adjusted for splits/dividends; disclaimer clarifies this for MVP.
- Filename-to-week mapping: filename date must align with report_week and published_at in UTC; mismatch causes rejection.
- Backups and error logging: daily DB backups; platform logs suffice for MVP; Sentry optional later.
- Authentication details: email verification and password reset included; basic rate limiting applied.

## 5. User Stories

US-001: Guest views reports list

- Title: Browse weekly reports
- Description: As a guest, I want to see a list of weekly reports so I can choose one to read.
- Acceptance Criteria:
  - Reports list is publicly accessible.
  - Shows title, week, publish date, and summary for each report.
  - Sorted by published_at desc.

US-002: Guest views report detail

- Title: Read a full report
- Description: As a guest, I want to open a weekly report and read all included picks.
- Acceptance Criteria:
  - Report page displays all picks and rationales.
  - Not investment advice disclaimer is visible.
  - report_view event recorded only if dwell >= 10s.

US-003: Guest views historical table

- Title: Review historical picks
- Description: As a guest, I want to view a table of all historical picks with simple sorting.
- Acceptance Criteria:
  - Table is publicly accessible and defaults to Date desc.
  - Columns: Date, Ticker, Exchange, Side, Target change %.
  - Users can sort by any visible column.
  - table_view event recorded on page load.

US-004: Registered user views reports

- Title: Browse reports while logged in
- Description: As a logged-in user, I want to browse and open any report.
- Acceptance Criteria:
  - Same content and access as guests.
  - Session persists across refresh per Supabase defaults.

US-005: Registration

- Title: Create an account
- Description: As a visitor, I want to register with email and password to create an account.
- Acceptance Criteria:
  - Registration form validates required fields and password policy.
  - On success, registration_complete event is recorded.
  - Email verification is sent; unverified users can log in per Supabase defaults or policy.

US-006: Login

- Title: Log in to my account
- Description: As a user, I want to log in so my session is saved and I can access any future restricted areas.
- Acceptance Criteria:
  - Login errors are clear for wrong credentials.
  - login event recorded on success.
  - Basic rate limiting is applied.

US-007: Logout

- Title: Log out
- Description: As a user, I want to log out to end my session.
- Acceptance Criteria:
  - Session tokens cleared; user returned to a public page.

US-008: Password reset

- Title: Reset password
- Description: As a user, I want to reset my password if I forget it.
- Acceptance Criteria:
  - Password reset email can be requested and completed.
  - Errors surfaced for invalid/expired token.

US-009: Admin access control

- Title: Restrict admin import UI
- Description: As an admin, I want only authorized admins to see and use the import page.
- Acceptance Criteria:
  - Non-admin users receive 403 for admin routes.
  - Admin users can access the import page.

US-010: Admin imports JSON file

- Title: Upload weekly report JSON
- Description: As an admin, I want to upload a JSON file to import a new weekly report and picks.
- Acceptance Criteria:
  - Only .json files accepted.
  - Filename must match YYYY-MM-DDreport.json; otherwise show a blocking error.
  - On success, a new weekly_report and associated stock_picks are created atomically.
  - imports_audit row is created with success status.

US-011: Import validation errors

- Title: See detailed validation errors
- Description: As an admin, I want precise schema and field-level errors when the JSON is invalid.
- Acceptance Criteria:
  - Invalid UUIDs/enums/required fields produce clear messages.
  - No DB changes are committed on failure.
  - imports_audit row records failure with error message.

US-012: Prevent duplicate reports

- Title: Duplicate protection
- Description: As an admin, I want the system to reject a duplicate report to avoid double entries.
- Acceptance Criteria:
  - If report_id already exists, import is rejected.
  - If source_checksum provided and matches a previous successful import with same report_id, reject.
  - Audit row shows failed with duplicate reason.

US-013: Filename-week consistency

- Title: Filename and week alignment
- Description: As an admin, I want the filename date to align with report_week/published_at so metadata is consistent.
- Acceptance Criteria:
  - If filename date conflicts with provided published_at/report_week, import is rejected.
  - Error explains the mismatch.

US-014: Large or malformed file handling

- Title: Handle large/malformed JSON
- Description: As an admin, I need clear errors when the file is too large or malformed.
- Acceptance Criteria:
  - Files over the size threshold are rejected with size message.
  - Malformed JSON results in clear parsing error; no writes occur.

US-015: Legal and disclaimers

- Title: Show disclaimers and policies
- Description: As a user, I want to see a Not investment advice disclaimer and access ToS/Privacy in PL and EN.
- Acceptance Criteria:
  - Disclaimer visible on report and picks views.
  - ToS and Privacy are available in PL and EN and linkable.

US-016: Localization and formatting

- Title: Locale-friendly formats
- Description: As a user, I want ISO dates and consistent numeric formatting.
- Acceptance Criteria:
  - Dates rendered as YYYY-MM-DD; publish time shown in UTC with local tooltip.
  - Target change % is shown to two decimal places.

US-017: Historical table sorting

- Title: Sortable picks table
- Description: As a user, I want to sort by each column to quickly scan the table.
- Acceptance Criteria:
  - Clicking a column header toggles sort direction.
  - Default is Date desc.

US-018: Event logging for engagement

- Title: Capture engagement events
- Description: As the operator, I want to log key events to measure KPIs without third-party analytics.
- Acceptance Criteria:
  - registration_complete, login, report_view (>=10s), table_view persisted in events table.
  - Obvious bots and staff IPs flagged and excluded from KPI queries.

US-019: Session persistence

- Title: Stay logged in
- Description: As a user, I want my session to persist so I do not need to re-login frequently.
- Acceptance Criteria:
  - Session persists per Supabase defaults until logout or expiry.

US-020: Error states and empty content

- Title: Graceful handling of empty/missing content
- Description: As a user, I want clear messages when no reports or picks exist.
- Acceptance Criteria:
  - Reports list shows an empty state when no reports exist.
  - Individual report page shows a clear message if picks array is empty.

US-021: Corporate actions disclaimer

- Title: Corporate actions handling
- Description: As a user, I want clarity on whether figures are adjusted for splits/dividends.
- Acceptance Criteria:
  - Disclaimer states values are not adjusted for corporate actions in MVP.

US-022: Security and HTTPS

- Title: Secure transport and brute-force mitigation
- Description: As a user, I want my interactions secured via HTTPS and basic protection from brute-force attacks.
- Acceptance Criteria:
  - HTTPS enforced.
  - Basic rate limiting on login endpoint.

US-023: Admin audit visibility

- Title: View import audit results
- Description: As an admin, I want to see a summary of recent imports and their statuses.
- Acceptance Criteria:
  - Admin page lists recent imports with filename, times, status, and error (if any).

US-024: Logout edge case

- Title: Expired sessions
- Description: As a user, I want to be redirected to a safe public page if my session expires.
- Acceptance Criteria:
  - Expired session triggers a transparent re-auth or redirect with a friendly message.

US-025: Access policy clarity

- Title: Public content affirmation
- Description: As a guest, I want confirmation that reports are publicly accessible during MVP.
- Acceptance Criteria:
  - No paywall or gating banners appear.
  - Public routes remain accessible when signed out.

US-026: Report permalink

- Title: Shareable report URL
- Description: As a user, I want a stable URL to share a report.
- Acceptance Criteria:
  - Each report has a unique permalink that resolves consistently.

US-027: Pagination or load more

- Title: Navigate long lists
- Description: As a user, I want to navigate the reports list when many reports exist.
- Acceptance Criteria:
  - Pagination or load-more control appears when the list exceeds the threshold.

US-028: Accessibility basics

- Title: Readable and navigable interface
- Description: As a user, I want accessible navigation and text for comfortable reading.
- Acceptance Criteria:
  - Sufficient color contrast and semantic headings.
  - Keyboard navigation works for core actions (open report, sort table).

US-029: Admin duplicate pick_id handling

- Title: Prevent duplicate picks per import
- Description: As an admin, I want the import to reject duplicate pick_id values within the same JSON.
- Acceptance Criteria:
  - Duplicate pick_id within a file causes validation failure and rollback.

US-030: Filename size and type checks

- Title: Guardrails on upload
- Description: As an admin, I want the UI to prevent obviously invalid uploads.
- Acceptance Criteria:
  - Frontend restricts to .json; warns on oversized files before submission when possible.

US-031: Gated access for recent reports (guest)

- Title: Guest sees gating for recent reports
- Description: As a guest, I want a clear message and CTA when I try to access a report published within the last 30 days.
- Acceptance Criteria:
  - Guests attempting to open a report with `published_at > current_date - 30 days` see a gated message with Login/Register CTA (or are redirected to `/auth/login?redirectTo=...`).
  - Older reports remain accessible in list and detail.

US-032: Picks table requires login

- Title: Table access denied to guests
- Description: As a guest, I should be asked to sign in before accessing the historical picks table.
- Acceptance Criteria:
  - Accessing the picks table route while signed out redirects to Login with `redirectTo`.
  - No table data is leaked to unauthenticated users.

US-033: Full access for signed-in users

- Title: Signed-in user sees all content
- Description: As a signed-in user, I want to access all reports (regardless of publish date) and the historical picks table.
- Acceptance Criteria:
  - All reports (list/detail) are visible when signed in.
  - Historical picks table is fully accessible and sortable.

## 6. Success Metrics

Technical execution

- Deployed Astro frontend with automatic SSL on a CDN-backed host.
- Supabase Postgres set up with weekly_reports, stock_picks, and imports_audit; event logging table available.
- Admin import validated, atomic, and audited; reports and picks display correctly.

Business/user validation

- Acquisition: At least 10 registered users.
- Engagement: At least 50% of registered users, within 14 days of registration, both
  - view at least one full report (report_view with dwell_seconds >= 10), and
  - visit the historical picks table at least once (table_view).

Measurement approach (no third-party analytics)

- registration_complete and login events recorded on auth actions.
- report_view recorded after 10s dwell on a report detail page.
- table_view recorded on loading the historical table page.
- KPI queries exclude is_bot = true and is_staff_ip = true rows.
- 14-day window computed from registration timestamp to occurred_at of engagement events.
