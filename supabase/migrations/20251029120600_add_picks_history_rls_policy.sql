-- Migration: Grant SELECT on picks_history Materialized View
-- Purpose: Allow anonymous and authenticated users to query the picks_history view
-- Security Model: Public read access (same as source tables weekly_reports and stock_picks)
-- Note: Row Level Security is not supported on materialized views. Use GRANTs instead.

-- =============================================================================
-- PRIVILEGES: picks_history (materialized view)
-- =============================================================================
-- Access Pattern: Public read (anon + authenticated), no write operations
-- Rationale: Materialized view is read-only; source data is already public

-- Ensure the materialized view exists before granting
-- (Will error if not present; ordering ensures MV is created in prior migration)

grant select on table picks_history to anon;
grant select on table picks_history to authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

comment on materialized view picks_history is 
  'Public read access via GRANTs for anon and authenticated roles';

