-- Migration: Add RLS Policy for picks_history Materialized View
-- Purpose: Allow anonymous and authenticated users to query the picks_history view
-- Security Model: Public read access (same as source tables weekly_reports and stock_picks)
-- Note: Materialized views require their own RLS policies separate from base tables

-- =============================================================================
-- RLS POLICIES: picks_history (materialized view)
-- =============================================================================
-- Access Pattern: Public read (anon + authenticated), no write operations
-- Rationale: Materialized view is read-only; source data is already public

-- SELECT: Allow anonymous users to view picks history
create policy "picks_history_select_anon"
  on picks_history
  for select
  to anon
  using (true);

-- SELECT: Allow authenticated users to view picks history
create policy "picks_history_select_authenticated"
  on picks_history
  for select
  to authenticated
  using (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

comment on policy "picks_history_select_anon" on picks_history is 
  'Allow anonymous users to query the picks history materialized view for public consumption';

comment on policy "picks_history_select_authenticated" on picks_history is 
  'Allow authenticated users to query the picks history materialized view for public consumption';

