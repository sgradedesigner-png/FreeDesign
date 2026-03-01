-- Auto-create profile when user signs up in Supabase Auth
-- This trigger ensures every auth.users record has a corresponding public.profiles record

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, "createdAt", "updatedAt")
  VALUES (
    NEW.id::text,  -- Cast UUID to TEXT
    NEW.email,
    'CUSTOMER', -- Default role for new signups
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Skip if profile already exists

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Create profiles for existing auth users that don't have profiles yet
INSERT INTO public.profiles (id, email, role, "createdAt", "updatedAt")
SELECT
  au.id::text,  -- Cast UUID to TEXT
  au.email,
  'CUSTOMER' as role,
  au.created_at,
  NOW() as "updatedAt"
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id::text  -- Cast for comparison
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
