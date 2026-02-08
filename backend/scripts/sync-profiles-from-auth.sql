-- Sync profiles from auth.users
-- This creates missing profiles for all auth.users
-- Run in Supabase SQL Editor

-- Insert missing profiles
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  CASE
    -- Set specific users as ADMIN
    WHEN au.email IN ('blenderpromon@gmail.com', 'admin@example.com') THEN 'ADMIN'::public."Role"
    ELSE 'CUSTOMER'::public."Role"
  END as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Verify sync
SELECT
  'Synced!' as status,
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM public.profiles) as profiles,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN public.profiles p ON p.id = au.id WHERE p.id IS NULL) as still_missing;
