-- =============================================================================
-- COMPREHENSIVE ADMIN DEBUG AND FIX SCRIPT
-- =============================================================================
-- Run this entire script in Supabase SQL Editor to diagnose and fix admin issues
-- User ID: 73160ab7-5343-4206-af08-231690476bd4

-- =============================================================================
-- STEP 1: Check if user exists in auth.users
-- =============================================================================
SELECT '=== STEP 1: Checking auth.users ===' as step;

SELECT 
  id as user_id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✓ Email confirmed'
    ELSE '✗ Email NOT confirmed - you must verify email first!'
  END as status
FROM auth.users 
WHERE id = '73160ab7-5343-4206-af08-231690476bd4';

-- If no results: User doesn't exist - check if you're using the correct user ID

-- =============================================================================
-- STEP 2: Check if profile exists
-- =============================================================================
SELECT '=== STEP 2: Checking profiles table ===' as step;

SELECT 
  user_id,
  is_admin,
  created_at,
  CASE 
    WHEN is_admin = true THEN '✓ Admin privileges enabled'
    ELSE '✗ Admin privileges NOT enabled'
  END as status
FROM profiles 
WHERE user_id = '73160ab7-5343-4206-af08-231690476bd4';

-- If no results: Profile doesn't exist - will create in next step

-- =============================================================================
-- STEP 3: Create or update profile to grant admin access
-- =============================================================================
SELECT '=== STEP 3: Creating/updating profile with admin privileges ===' as step;

-- This will either INSERT a new profile or UPDATE existing one to is_admin=true
INSERT INTO profiles (user_id, is_admin, created_at)
VALUES ('73160ab7-5343-4206-af08-231690476bd4', true, now())
ON CONFLICT (user_id) 
DO UPDATE SET is_admin = true;

-- Verify the change
SELECT 
  '✓ Profile created/updated successfully' as result,
  user_id,
  is_admin,
  created_at
FROM profiles 
WHERE user_id = '73160ab7-5343-4206-af08-231690476bd4';

-- =============================================================================
-- STEP 4: Final verification - join auth.users with profiles
-- =============================================================================
SELECT '=== STEP 4: Final verification ===' as step;

SELECT 
  u.id as user_id,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmed,
  COALESCE(p.is_admin, false) as is_admin,
  p.created_at as profile_created_at,
  CASE 
    WHEN u.email_confirmed_at IS NULL THEN '✗ FAIL: Email not confirmed'
    WHEN p.user_id IS NULL THEN '✗ FAIL: Profile not found'
    WHEN p.is_admin = false THEN '✗ FAIL: is_admin is false'
    WHEN p.is_admin = true THEN '✓ SUCCESS: User is admin'
    ELSE '✗ FAIL: Unknown issue'
  END as final_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.id = '73160ab7-5343-4206-af08-231690476bd4';

-- =============================================================================
-- STEP 5: Check RLS policies (diagnostic only - just to see what exists)
-- =============================================================================
SELECT '=== STEP 5: Checking RLS policies on profiles table ===' as step;

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================
-- After running this script, you should see:
-- 
-- Step 1: User exists with confirmed email
-- Step 2: Profile exists (may be missing before step 3)
-- Step 3: Profile created/updated with is_admin = true
-- Step 4: final_status = '✓ SUCCESS: User is admin'
-- Step 5: List of RLS policies (should include profiles_select_own and profiles_select_admin)
-- 
-- If Step 4 shows SUCCESS, then:
-- 1. Log out of your application completely
-- 2. Clear browser cookies for localhost:3000
-- 3. Log back in
-- 4. Admin links should now appear in the header
-- =============================================================================

