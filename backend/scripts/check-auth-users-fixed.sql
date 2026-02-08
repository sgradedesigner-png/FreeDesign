-- Check auth.users vs public.profiles (FIXED VERSION)
-- Run in Supabase SQL Editor

-- 1. Count users in auth.users (Supabase Auth)
SELECT
  'auth.users' as table_name,
  COUNT(*) as total_users
FROM auth.users;

-- 2. Count users in public.profiles (Custom table)
SELECT
  'public.profiles' as table_name,
  COUNT(*) as total_profiles
FROM public.profiles;

-- 3. Show auth.users sample (actual accounts)
SELECT
  id::text as user_id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 4. Show which users have NO profile (FIXED - added ::text cast)
SELECT
  au.id::text as user_id,
  au.email,
  'NO PROFILE' as status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id::text
WHERE p.id IS NULL;

-- 5. Summary (FIXED)
SELECT
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM public.profiles) as profiles,
  (SELECT COUNT(*)
   FROM auth.users au
   LEFT JOIN public.profiles p ON p.id = au.id::text
   WHERE p.id IS NULL) as missing_profiles;
