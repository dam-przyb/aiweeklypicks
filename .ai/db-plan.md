## 1. List of tables with columns, data types, and constraints

### Global: Extensions, Domains, and Enums
- Extensions
  - pgcrypto: required for `gen_random_uuid()`.

- Domains
  - `pct_change` = NUMERIC(10,2) CHECK (VALUE BETWEEN -1000 AND 1000)

- Enums
  - `side_enum` = ('long','short')
  - `import_status_enum` = ('success','failed')

---

### System Table: `auth`.`users` (Managed by Supabase Auth)
- `id` UUID PRIMARY KEY  -- acts as `user_id`
- `email` TEXT NULL  -- managed by Supabase; may be NULL for some providers
- `created_at` TIMESTAMPTZ NOT NULL

Constraints
- PK: (`id`)

Notes
- This table is owned and managed by Supabase Auth. Do not modify via app migrations.
- Credentials (password hashes, providers) are managed internally by Supabase and are not duplicated elsewhere.
- Application code should access identity via Supabase Auth APIs or secured RPCs; avoid granting direct SELECT on `auth.users` to anon/auth roles.

---

### Table: `profiles`
- `user_id` UUID PRIMARY KEY REFERENCES `auth`.`users`(`id`) ON DELETE CASCADE NOT NULL
- `is_admin` BOOLEAN NOT NULL DEFAULT false
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints
- PK: (`user_id`)

Notes
- `profiles` is an app-managed, 1:1 extension of `auth.users` for application roles/flags.
- Do NOT duplicate `email` or any credential material here; use `auth.users` as the single source of truth.

---

### Table: `weekly_reports`
- `report_id` UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()
- `published_at` TIMESTAMPTZ NOT NULL
- `report_week` TEXT GENERATED ALWAYS AS (to_char(published_at, 'IYYY-"W"IW')) STORED
- `version` TEXT NOT NULL DEFAULT 'v1'
- `source_checksum` TEXT NULL
- `title` TEXT NOT NULL
- `summary` TEXT NOT NULL
- `slug` TEXT NOT NULL UNIQUE
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints
- PK: (`report_id`)
- UNIQUE: (`report_week`, `version`)

---

### Table: `stock_picks`
- `pick_id` UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()
- `report_id` UUID NOT NULL REFERENCES `weekly_reports`(`report_id`) ON DELETE CASCADE
- `ticker` TEXT NOT NULL
- `exchange` TEXT NOT NULL
- `side` `side_enum` NOT NULL
- `target_change_pct` `pct_change` NOT NULL
- `rationale` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints
- PK: (`pick_id`)
- UNIQUE: (`report_id`, `ticker`, `side`)  -- prevent intra-report duplicates

---

### Table: `imports_audit`
- `import_id` UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()
- `uploaded_by_user_id` UUID NULL REFERENCES `auth`.`users`(`id`) ON DELETE SET NULL
- `filename` TEXT NOT NULL
- `source_checksum` TEXT NULL
- `schema_version` TEXT NOT NULL  -- e.g., 'v1'
- `status` `import_status_enum` NOT NULL
- `error_message` TEXT NULL
- `source_json` JSONB NULL
- `started_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `finished_at` TIMESTAMPTZ NULL

Constraints
- PK: (`import_id`)
- CHECK: `octet_length(source_json::text) <= 5 * 1024 * 1024`  -- ≤ 5MB

---

### Table: `events` (Monthly Range-Partitioned by `occurred_at`)
- `event_id` UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()
- `user_id` UUID NULL REFERENCES `auth`.`users`(`id`) ON DELETE SET NULL
- `event_type` TEXT NOT NULL CHECK (event_type IN (
  'registration_complete','login','report_view','table_view'
))
- `occurred_at` TIMESTAMPTZ NOT NULL
- `user_agent` TEXT NULL
- `ip_hash` TEXT NOT NULL  -- salted SHA-256 of ip
- `dwell_seconds` NUMERIC NULL
- `metadata` JSONB NULL
- `is_staff_ip` BOOLEAN NOT NULL DEFAULT false
- `is_bot` BOOLEAN NOT NULL DEFAULT false
- `report_id` UUID NULL REFERENCES `weekly_reports`(`report_id`) ON DELETE SET NULL

Partitioning
- Parent table `events` is defined with `PARTITION BY RANGE (occurred_at)`.
- Monthly child partitions (e.g., `events_2025_10`) are created per month.

---

### Table: `staff_networks`
- `network` CIDR PRIMARY KEY
- `label` TEXT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints
- PK: (`network`)

---

### Materialized View: `picks_history`
Columns
- `published_at` TIMESTAMPTZ NOT NULL (from `weekly_reports`)
- `report_week` TEXT NOT NULL (from `weekly_reports`)
- `ticker` TEXT NOT NULL
- `exchange` TEXT NOT NULL
- `side` `side_enum` NOT NULL
- `target_change_pct` `pct_change` NOT NULL
- `report_id` UUID NOT NULL

Notes
- Populated by joining `weekly_reports` with `stock_picks`.
- Refreshed after successful imports to optimize historical table rendering.

---

## 2. Relationships between tables
- `weekly_reports` (1) — (N) `stock_picks`
  - `stock_picks.report_id` → `weekly_reports.report_id` ON DELETE CASCADE
- `imports_audit.uploaded_by_user_id` → `auth.users.id` ON DELETE SET NULL (optional association)
- `profiles.user_id` → `auth.users.id` (1:1; admin flag source)
- `events.user_id` → `auth.users.id` ON DELETE SET NULL (optional)
- `events.report_id` → `weekly_reports.report_id` ON DELETE SET NULL (optional; used for report_view joins)
- `staff_networks` is standalone; used by triggers for staff IP detection

Cardinality
- `weekly_reports` to `stock_picks`: One-to-Many
- `auth.users` to `profiles`: One-to-One
- `auth.users` to `imports_audit`: One-to-Many (nullable)
- `auth.users` to `events`: One-to-Many (nullable)

---

## 3. Indexes

### `profiles`
- PK on (`user_id`)
- Optional: BTREE on (`is_admin`) for admin lookups

### `weekly_reports`
- PK on (`report_id`)
- UNIQUE on (`report_week`, `version`)
- UNIQUE on (`slug`)
- BTREE on (`published_at` DESC) to support default ordering

### `stock_picks`
- PK on (`pick_id`)
- UNIQUE on (`report_id`, `ticker`, `side`)
- BTREE on (`report_id`) for join performance
- BTREE on (`ticker`) for historical lookups

### `imports_audit`
- PK on (`import_id`)
- BTREE on (`uploaded_by_user_id`)
- BTREE on (`started_at` DESC)
- Optional: BTREE on (`status`)

### `events` (parent; local indexes on each partition)
- PK on (`event_id`)
- Composite BTREE on (`event_type`, `occurred_at` DESC)
- BTREE on (`report_id`)
- Optional: GIN on (`metadata`) if query patterns emerge

### `staff_networks`
- PK on (`network`)

### `picks_history` (materialized view)
- BTREE on (`published_at` DESC)
- BTREE on (`ticker`)

---

## 4. PostgreSQL policies (RLS)

General
- Enable RLS on all user-facing tables: `profiles`, `weekly_reports`, `stock_picks`, `imports_audit`, `events`, `staff_networks`.
- Admin identification via `profiles.is_admin = true` for `auth.uid()`.
- `auth.users` is managed by Supabase Auth; do not alter. Prefer secured RPCs for any identity lookups needed by the app.

Policies
- `weekly_reports`
  - SELECT: allow for all roles (anon, authenticated)
  - INSERT/UPDATE/DELETE: allow only when `exists (select 1 from profiles p where p.user_id = auth.uid() and p.is_admin)`

- `stock_picks`
  - SELECT: allow for all roles
  - INSERT/UPDATE/DELETE: admin-only as above

- `imports_audit`
  - SELECT: admin-only
  - INSERT: admin-only (performed via import RPC)
  - UPDATE/DELETE: admin-only

- `events` (parent; partitions inherit policies)
  - INSERT: allow via server-side function only; policy permits when `auth.uid()` is not required or when a secure RPC role is used
  - SELECT: deny to non-admins; admin-only for operational analytics
  - UPDATE/DELETE: admin-only

- `profiles`
  - SELECT: user can select own row; admins can select all
  - INSERT/UPDATE/DELETE: admin-only (provisioned by backend)

- `staff_networks`
  - SELECT: admin-only
  - INSERT/UPDATE/DELETE: admin-only

Notes
- Use SECURITY DEFINER RPCs to perform privileged operations under RLS (see Additional Notes).
  - Provide `get_current_user_identity()` (SECURITY DEFINER) that returns `{ user_id, email, created_at }` for `auth.uid()` by querying `auth.users`.

---

## 5. Additional notes or explanations

- Report week consistency
  - `weekly_reports.report_week` is a stored generated column derived from `published_at` using ISO week format to prevent drift.
  - Uniqueness is enforced via (`report_week`, `version`). `version` is NOT NULL with default 'v1'.

- Slug strategy
  - `weekly_reports.slug` is UNIQUE and intended to be derived from `report_week` and a slugified `title`. Treat as immutable after creation for permalink stability.

- Import workflow
  - Provide a SECURITY DEFINER function `admin_import_report(payload JSONB, filename TEXT)` that:
    - Validates filename against `^\d{4}-\d{2}-\d{2}report\.json$`
    - Validates JSON schema (v1), UUIDs, enums, and duplicates
    - Cross-validates filename date with `published_at` and generated `report_week`
    - Executes all inserts in a single transaction
    - Writes an `imports_audit` row with status and error (if any)
    - Optionally refreshes the `picks_history` materialized view on success

- Events privacy and classification
  - `ip_hash` is a salted SHA-256 of the request IP; store salt in a secure secret.
  - Maintain `staff_networks` and a trigger to set `events.is_staff_ip`.
  - Simple user-agent heuristics can set `events.is_bot` in an insert trigger.
  - Partition `events` monthly; create local indexes on each partition; implement retention by dropping older partitions per policy.

- Performance considerations
  - Indexes selected to support default sorts and common lookups: `weekly_reports(published_at)`, `stock_picks(report_id, ticker)`, `events(event_type, occurred_at)`.
  - `picks_history` materialized view provides fast rendering for the historical picks table when joins become heavy; refresh after successful imports.

- Data integrity
  - Use domains and enums to enforce value ranges and stable enums.
  - Prevent duplicate picks within a report via UNIQUE `(report_id, ticker, side)`.


