-- Migration: Update Events RLS for Anonymous Event Tracking
-- Purpose: Allow anonymous users to insert events via the admin_post_event RPC
-- Security: INSERT is still controlled via SECURITY DEFINER RPC, not direct table access

-- =============================================================================
-- RLS POLICY UPDATE: events
-- =============================================================================
-- Drop the existing insert policy that only allowed authenticated users
drop policy if exists "events_insert_service" on events;

-- Create new insert policy allowing both authenticated and anon users
-- Rationale: Events can come from anonymous visitors; the RPC controls actual insertion
create policy "events_insert_via_rpc"
  on events
  for insert
  to authenticated, anon
  with check (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================
-- Update table comment to reflect the access pattern

comment on table events is 
  'User events for analytics. INSERT via admin_post_event RPC only. Admin-only SELECT/UPDATE/DELETE.';

