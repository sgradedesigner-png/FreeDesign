-- Restore profiles for existing auth.users
-- Run this in Supabase SQL Editor

-- Insert profiles for all auth.users that don't have profiles yet
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  CASE
    WHEN au.email = 'Blenderpromon@gmail.com' THEN 'ADMIN'::public."Role"
    ELSE 'CUSTOMER'::public."Role"
  END as role,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Verify
SELECT id, email, role FROM public.profiles;
