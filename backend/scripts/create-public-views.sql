-- Create public views for the e-commerce platform
-- These views expose only published products and available variants for public access

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
    c.name as category_name,
    c.slug as category_slug,
    p.rating,
    p.reviews,
    p.features,
    p.benefits,
    p."productDetails",
    p."createdAt",
    p."updatedAt",
    -- Aggregate variant information
    COUNT(DISTINCT pv.id) as variant_count,
    MIN(pv.price) as min_price,
    MAX(pv.price) as max_price,
    SUM(pv.stock) as total_stock,
    -- Check if any variant is available
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as has_available_variants
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p.is_published = true
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
    c.name as category_name,
    c.slug as category_slug,
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
    MIN(pv.price) as min_price,
    MAX(pv.price) as max_price,
    -- Stock availability
    SUM(pv.stock) as total_stock,
    BOOL_OR(pv."isAvailable" AND pv.stock > 0) as in_stock
FROM products p
INNER JOIN categories c ON p."categoryId" = c.id
LEFT JOIN product_variants pv ON p.id = pv."productId"
WHERE p.is_published = true
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
    pv.name as variant_name,
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
    p.title as product_title,
    p.slug as product_slug,
    p.subtitle as product_subtitle,
    p.description as product_description,
    p."categoryId",
    c.name as category_name,
    c.slug as category_slug,
    p.rating,
    p.reviews,
    p.features,
    p.benefits,
    p."productDetails",
    -- Availability check
    (pv."isAvailable" AND pv.stock > 0) as is_in_stock,
    pv."createdAt",
    pv."updatedAt"
FROM product_variants pv
INNER JOIN products p ON pv."productId" = p.id
INNER JOIN categories c ON p."categoryId" = c.id
WHERE p.is_published = true
  AND pv."isAvailable" = true;

-- Grant select permissions to public (if using RLS, adjust accordingly)
COMMENT ON VIEW v_products_public IS 'Public view of published products with aggregated variant data';
COMMENT ON VIEW v_products_public_list IS 'Lightweight public view for product listings and grids';
COMMENT ON VIEW v_product_variants_public IS 'Public view of available product variants for published products';
