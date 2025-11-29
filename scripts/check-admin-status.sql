-- Script to check and fix admin status for user
-- Run this in your Supabase SQL Editor

-- Step 1: Check if your user exists in auth.users
SELECT 
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE id = '73160ab7-5343-4206-af08-231690476bd4';

-- Step 2: Check if profile exists
SELECT 
  user_id,
  is_admin,
  created_at
FROM profiles 
WHERE user_id = '73160ab7-5343-4206-af08-231690476bd4';

-- Step 3: If profile doesn't exist or is_admin is false, create/fix it
INSERT INTO profiles (user_id, is_admin, created_at)
VALUES ('73160ab7-5343-4206-af08-231690476bd4', true, now())
ON CONFLICT (user_id) 
DO UPDATE SET is_admin = true;

-- Step 4: Verify the fix worked
SELECT 
  u.id as user_id,
  u.email,
  p.is_admin,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.id = '73160ab7-5343-4206-af08-231690476bd4';

