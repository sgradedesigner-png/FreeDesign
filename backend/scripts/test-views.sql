-- Test if views are returning data now
-- Run in Supabase SQL Editor

-- 1. Count products in each view
SELECT 'products table' as source, COUNT(*) as count FROM products
UNION ALL
SELECT 'v_products_public' as source, COUNT(*) FROM v_products_public
UNION ALL
SELECT 'v_products_public_list' as source, COUNT(*) FROM v_products_public_list
UNION ALL
SELECT 'v_product_variants_public' as source, COUNT(*) FROM v_product_variants_public;

-- 2. Show actual data from v_products_public_list (what Store uses)
SELECT
    id,
    title,
    category_name,
    min_price,
    total_stock,
    in_stock
FROM v_products_public_list
LIMIT 5;

-- 3. Check if views are filtering correctly
SELECT
    p.id,
    p.title,
    p.is_published,
    'Should appear in view' as status
FROM products p
WHERE p.is_published = true;
