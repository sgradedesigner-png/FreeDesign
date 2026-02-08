-- Check products table actual schema
-- Run in Supabase SQL Editor

-- 1. Show ALL columns in products table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- 2. Check if is_published column exists
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'products'
              AND column_name = 'is_published'
        ) THEN 'is_published EXISTS ✅'
        ELSE 'is_published NOT FOUND ❌'
    END as status;

-- 3. Check if isPublished (camelCase) exists instead
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'products'
              AND column_name = 'isPublished'
        ) THEN 'isPublished (camelCase) EXISTS ✅'
        ELSE 'isPublished NOT FOUND ❌'
    END as status;
