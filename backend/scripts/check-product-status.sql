-- Check product is_published status
-- Run in Supabase SQL Editor

-- 1. Check all columns of your product
SELECT
    id,
    title,
    is_published,
    "categoryId",
    "createdAt"
FROM products
ORDER BY "createdAt" DESC
LIMIT 5;

-- 2. Check if categories exist
SELECT * FROM categories LIMIT 5;

-- 3. Check if product_variants exist for your product
SELECT
    pv.id,
    pv."productId",
    pv.name,
    pv.price,
    pv.stock,
    pv."isAvailable"
FROM product_variants pv
LIMIT 5;

-- 4. Manual test: Show what the view WOULD return (without filtering)
SELECT
    p.id,
    p.title,
    p.is_published,
    p."categoryId",
    c.name as category_name,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
GROUP BY p.id, p.title, p.is_published, p."categoryId", c.name;
