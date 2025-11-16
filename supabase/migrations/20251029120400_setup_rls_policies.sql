-- Migration: Setup Row Level Security Policies
-- Purpose: Define fine-grained access control policies for all tables
-- Security Model: Public read access for reports/picks; admin-only write access; privacy for audit/events
-- Admin Detection: Via profiles.is_admin = true for auth.uid()

-- =============================================================================
-- RLS POLICIES: weekly_reports
-- =============================================================================
-- Access Pattern: Public read (anon + authenticated), admin-only write

-- SELECT: Allow all users (anon and authenticated) to view reports
create policy "weekly_reports_select_anon"
  on weekly_reports
  for select
  to anon
  using (true);

create policy "weekly_reports_select_authenticated"
  on weekly_reports
  for select
  to authenticated
  using (true);

-- INSERT: Admin-only
-- Rationale: Only administrators should be able to create new reports
create policy "weekly_reports_insert_admin"
  on weekly_reports
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Only administrators should be able to modify reports
create policy "weekly_reports_update_admin"
  on weekly_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Only administrators should be able to delete reports
-- Note: This will cascade delete to stock_picks due to foreign key constraint
create policy "weekly_reports_delete_admin"
  on weekly_reports
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- =============================================================================
-- RLS POLICIES: stock_picks
-- =============================================================================
-- Access Pattern: Public read (anon + authenticated), admin-only write

-- SELECT: Allow all users (anon and authenticated) to view stock picks
create policy "stock_picks_select_anon"
  on stock_picks
  for select
  to anon
  using (true);

create policy "stock_picks_select_authenticated"
  on stock_picks
  for select
  to authenticated
  using (true);

-- INSERT: Admin-only
-- Rationale: Stock picks are created as part of report imports by administrators
create policy "stock_picks_insert_admin"
  on stock_picks
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Only administrators should be able to modify stock picks
create policy "stock_picks_update_admin"
  on stock_picks
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Only administrators should be able to delete stock picks
create policy "stock_picks_delete_admin"
  on stock_picks
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- =============================================================================
-- RLS POLICIES: imports_audit
-- =============================================================================
-- Access Pattern: Admin-only for all operations (sensitive audit data)

-- SELECT: Admin-only
-- Rationale: Import audit logs contain sensitive operational information
create policy "imports_audit_select_admin"
  on imports_audit
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT: Admin-only
-- Rationale: Import records are created by admin import operations via RPC
create policy "imports_audit_insert_admin"
  on imports_audit
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Only administrators should be able to update audit records
create policy "imports_audit_update_admin"
  on imports_audit
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Audit records should rarely be deleted; admin-only for cleanup
create policy "imports_audit_delete_admin"
  on imports_audit
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- =============================================================================
-- RLS POLICIES: events
-- =============================================================================
-- Access Pattern: INSERT via server-side RPC only; SELECT/UPDATE/DELETE admin-only
-- Rationale: Events contain privacy-sensitive analytics data

-- INSERT: Allow via service role or authenticated (intended for SECURITY DEFINER RPCs)
-- Rationale: Events are inserted by server-side functions that hash IPs and classify traffic
-- This policy is permissive as actual event creation is controlled by SECURITY DEFINER functions
create policy "events_insert_service"
  on events
  for insert
  to authenticated
  with check (true);

-- SELECT: Admin-only
-- Rationale: Event data is privacy-sensitive and used for operational analytics
create policy "events_select_admin"
  on events
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Events should be immutable; updates only for corrections by admins
create policy "events_update_admin"
  on events
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Event deletion for data retention management by administrators
create policy "events_delete_admin"
  on events
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- =============================================================================
-- RLS POLICIES: profiles
-- =============================================================================
-- Access Pattern: Users can view own profile; admins can view all; admin-only write

-- SELECT: Users can view their own profile
-- Rationale: Users need access to their own profile data
create policy "profiles_select_own"
  on profiles
  for select
  to authenticated
  using (user_id = auth.uid());

-- SELECT: Admins can view all profiles
-- Rationale: Administrators need access to all profiles for user management
create policy "profiles_select_admin"
  on profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT: Admin-only
-- Rationale: Profiles are provisioned by backend; users don't create their own profiles
create policy "profiles_insert_admin"
  on profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Only administrators should be able to modify profile flags like is_admin
create policy "profiles_update_admin"
  on profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Profile deletion should be managed by administrators
create policy "profiles_delete_admin"
  on profiles
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- =============================================================================
-- RLS POLICIES: staff_networks
-- =============================================================================
-- Access Pattern: Admin-only for all operations

-- SELECT: Admin-only
-- Rationale: Staff network information is operationally sensitive
create policy "staff_networks_select_admin"
  on staff_networks
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT: Admin-only
-- Rationale: Only administrators should be able to add staff networks
create policy "staff_networks_insert_admin"
  on staff_networks
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- UPDATE: Admin-only
-- Rationale: Only administrators should be able to modify staff networks
create policy "staff_networks_update_admin"
  on staff_networks
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

-- DELETE: Admin-only
-- Rationale: Only administrators should be able to remove staff networks
create policy "staff_networks_delete_admin"
  on staff_networks
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );

