-- Migration: Fix infinite recursion in profiles RLS policies
-- Date: 2024-12-01
-- Issue: profiles_select_admin policy causes infinite recursion when checking admin status
-- Solution: Remove recursive admin check, allow users to read their own profile only

-- Drop all existing profiles policies
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

-- Recreate SELECT policy: Users can ONLY read their own profile
-- This is safe and doesn't cause recursion
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Block INSERT/UPDATE/DELETE at RLS level
-- Admin operations will be handled in application code via requireAdmin()
-- This prevents the infinite recursion issue

CREATE POLICY "profiles_insert_blocked"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "profiles_update_blocked"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "profiles_delete_blocked"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (false);

