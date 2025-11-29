-- =============================================================================
-- FIX: Infinite Recursion in Profiles RLS Policies
-- =============================================================================
-- Problem: profiles_select_admin policy creates infinite recursion
-- When checking if user is admin, it queries profiles table, which triggers
-- the same policy again, causing infinite loop.
--
-- Solution: Simplify policies to allow users to always read their own profile
-- =============================================================================

-- Drop the problematic recursive admin policy
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;

-- Keep the simple "users can read their own profile" policy
-- This policy should already exist, but we'll recreate it to be sure
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- For admin operations (INSERT, UPDATE, DELETE), we'll handle authorization
-- in application code via requireAdmin() function instead of RLS
-- This avoids the infinite recursion issue

-- Keep INSERT as admin-only but without recursive check
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;

CREATE POLICY "profiles_insert_admin"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Block all inserts via RLS, handle in admin code

-- Keep UPDATE as admin-only but without recursive check  
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_update_admin"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (false)  -- Block all updates via RLS, handle in admin code
  WITH CHECK (false);

-- Keep DELETE as admin-only but without recursive check
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

CREATE POLICY "profiles_delete_admin"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (false); -- Block all deletes via RLS, handle in admin code

-- =============================================================================
-- Verification Query
-- =============================================================================
-- Check that policies are correctly set up

SELECT 
  '=== Current RLS Policies on profiles table ===' as info;

SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN '✓ Should allow users to read own profile'
    WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN '✓ Should be blocked by RLS (handled in app)'
    ELSE 'Other'
  END as expected_behavior
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- =============================================================================
-- Test Query
-- =============================================================================
-- This should now work without infinite recursion

SELECT 
  '=== Testing profile query (should work now) ===' as test;

SELECT 
  user_id,
  is_admin,
  created_at
FROM profiles
WHERE user_id = '73160ab7-5343-4206-af08-231690476bd4';

-- Expected result: Should return the profile row without error
-- =============================================================================

