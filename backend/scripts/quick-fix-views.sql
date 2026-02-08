-- Quick fix: Just change is_published to "isPublished"
-- Run in Supabase SQL Editor

-- Fix v_products_public
CREATE OR REPLACE VIEW v_products_public AS
SELECT
    p.id, p.title, p.slug, p.subtitle, p.description,
    p."basePrice", p."categoryId",
    c.name as category_name, c.slug as category_slug,
    p.rating, p.reviews, p.features, p.benefits, p."productDetails",
    p."createdAt", p."updatedAt",
    COUNT(DISTINCT pv.id) as variant_count,
    MIN(pv.price) as min_price, MAX(pv.price) as max_price,
    SUM(pv.stock) as total_stock,
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as has_available_variants
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p."isPublished" = true  -- FIXED: was is_published
GROUP BY p.id, p.title, p.slug, p.subtitle, p.description, p."basePrice",
         p."categoryId", c.name, c.slug, p.rating, p.reviews, p.features,
         p.benefits, p."productDetails", p."createdAt", p."updatedAt";

-- Fix v_products_public_list
CREATE OR REPLACE VIEW v_products_public_list AS
SELECT
    p.id, p.title, p.slug, p.subtitle, p."categoryId",
    c.name as category_name, c.slug as category_slug,
    p.rating, p.reviews, p."createdAt",
    (SELECT pv."imagePath" FROM product_variants pv
     WHERE pv."productId" = p.id
     ORDER BY pv."sortOrder" ASC LIMIT 1) as thumbnail,
    MIN(pv.price) as min_price, MAX(pv.price) as max_price,
    SUM(pv.stock) as total_stock,
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as in_stock
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p."isPublished" = true  -- FIXED: was is_published
GROUP BY p.id, p.title, p.slug, p.subtitle, p."categoryId",
         c.name, c.slug, p.rating, p.reviews, p."createdAt";

-- Fix v_product_variants_public
CREATE OR REPLACE VIEW v_product_variants_public AS
SELECT
    pv.id, pv."productId", pv.name as variant_name, pv.sku,
    pv.price, pv."originalPrice", pv.sizes, pv."imagePath", pv."galleryPaths",
    pv.stock, pv."isAvailable", pv."sortOrder",
    p.title as product_title, p.slug as product_slug,
    p.subtitle as product_subtitle, p.description as product_description,
    p."categoryId", c.name as category_name, c.slug as category_slug,
    p.rating, p.reviews, p.features, p.benefits, p."productDetails",
    (pv."isAvailable" AND pv.stock > 0) as is_in_stock,
    pv."createdAt", pv."updatedAt"
FROM product_variants pv
INNER JOIN products p ON pv."productId" = p.id
INNER JOIN categories c ON p."categoryId" = c.id
WHERE p."isPublished" = true AND pv."isAvailable" = true;  -- FIXED: was is_published

-- Verify
SELECT COUNT(*) as products FROM v_products_public_list;
