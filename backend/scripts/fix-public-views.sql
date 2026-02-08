-- Fix public views - Use camelCase column names to match actual database schema
-- Run in Supabase SQL Editor

-- 1. v_products_public: Full product details view for public access
CREATE OR REPLACE VIEW v_products_public AS
SELECT
    p.id,
    p.title,
    p.slug,
    p.subtitle,
    p.description,
    p."basePrice",
    p."categoryId",
    c.name as "categoryName",
    c.slug as "categorySlug",
    p.rating,
    p.reviews,
    p.features,
    p.benefits,
    p."productDetails",
    p."createdAt",
    p."updatedAt",
    -- Aggregate variant information
    COUNT(DISTINCT pv.id) as "variantCount",
    MIN(pv.price) as "minPrice",
    MAX(pv.price) as "maxPrice",
    SUM(pv.stock) as "totalStock",
    -- Check if any variant is available
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as "hasAvailableVariants"
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p."isPublished" = true
GROUP BY
    p.id,
    p.title,
    p.slug,
    p.subtitle,
    p.description,
    p."basePrice",
    p."categoryId",
    c.name,
    c.slug,
    p.rating,
    p.reviews,
    p.features,
    p.benefits,
    p."productDetails",
    p."createdAt",
    p."updatedAt";

-- 2. v_products_public_list: Lightweight product list view for listings/grids
CREATE OR REPLACE VIEW v_products_public_list AS
SELECT
    p.id,
    p.title,
    p.slug,
    p.subtitle,
    p."categoryId",
    c.name as "categoryName",
    c.slug as "categorySlug",
    p.rating,
    p.reviews,
    p."createdAt",
    -- Get first variant's image as thumbnail
    (SELECT pv."imagePath"
     FROM product_variants pv
     WHERE pv."productId" = p.id
     ORDER BY pv."sortOrder" ASC, pv."createdAt" ASC
     LIMIT 1) as thumbnail,
    -- Price range
    MIN(pv.price) as "minPrice",
    MAX(pv.price) as "maxPrice",
    -- Stock availability
    SUM(pv.stock) as "totalStock",
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as "inStock"
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p."isPublished" = true
GROUP BY
    p.id,
    p.title,
    p.slug,
    p.subtitle,
    p."categoryId",
    c.name,
    c.slug,
    p.rating,
    p.reviews,
    p."createdAt";

-- 3. v_product_variants_public: Product variants view for public access
CREATE OR REPLACE VIEW v_product_variants_public AS
SELECT
    pv.id,
    pv."productId",
    pv.name as "variantName",
    pv.sku,
    pv.price,
    pv."originalPrice",
    pv.sizes,
    pv."imagePath",
    pv."galleryPaths",
    pv.stock,
    pv."isAvailable",
    pv."sortOrder",
    -- Product information
    p.title as "productTitle",
    p.slug as "productSlug",
    p.subtitle as "productSubtitle",
    p.description as "productDescription",
    p."categoryId",
    c.name as "categoryName",
    c.slug as "categorySlug",
    p.rating,
    p.reviews,
    p.features,
    p.benefits,
    p."productDetails",
    -- Availability check
    (pv."isAvailable" AND pv.stock > 0) as "isInStock",
    pv."createdAt",
    pv."updatedAt"
FROM product_variants pv
INNER JOIN products p ON pv."productId" = p.id
INNER JOIN categories c ON p."categoryId" = c.id
WHERE p."isPublished" = true
  AND pv."isAvailable" = true;

-- Verify views are working
SELECT 'v_products_public' as view_name, COUNT(*) as row_count FROM v_products_public
UNION ALL
SELECT 'v_products_public_list', COUNT(*) FROM v_products_public_list
UNION ALL
SELECT 'v_product_variants_public', COUNT(*) FROM v_product_variants_public;

-- Show sample data from v_products_public_list
SELECT
    id,
    title,
    "categoryName",
    "minPrice",
    "maxPrice",
    "totalStock",
    "inStock"
FROM v_products_public_list
ORDER BY "createdAt" DESC
LIMIT 5;
