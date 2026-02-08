-- Fix admin role for blenderpromon@gmail.com
-- Run in Supabase SQL Editor

UPDATE public.profiles
SET role = 'ADMIN'::public."Role"
WHERE email = 'blenderpromon@gmail.com';

-- Verify
SELECT email, role FROM public.profiles;
