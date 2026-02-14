-- Phase 0: RLS + Public Views Baseline

-- Enable RLS on core tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_assets ENABLE ROW LEVEL SECURITY;

-- Catalog read policies
DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS products_public_read_published ON public.products;
CREATE POLICY products_public_read_published ON public.products
  FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS product_variants_public_read_published_product ON public.product_variants;
CREATE POLICY product_variants_public_read_published_product ON public.product_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = public.product_variants."productId"
        AND p.is_published = true
    )
  );

-- Owner policies for orders
DROP POLICY IF EXISTS orders_owner_select ON public.orders;
CREATE POLICY orders_owner_select ON public.orders
  FOR SELECT
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS orders_owner_insert ON public.orders;
CREATE POLICY orders_owner_insert ON public.orders
  FOR INSERT
  TO PUBLIC
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS orders_owner_update ON public.orders;
CREATE POLICY orders_owner_update ON public.orders
  FOR UPDATE
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId")
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS orders_owner_delete ON public.orders;
CREATE POLICY orders_owner_delete ON public.orders
  FOR DELETE
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

-- Owner policies for customization assets
DROP POLICY IF EXISTS customization_assets_owner_select ON public.customization_assets;
CREATE POLICY customization_assets_owner_select ON public.customization_assets
  FOR SELECT
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS customization_assets_owner_insert ON public.customization_assets;
CREATE POLICY customization_assets_owner_insert ON public.customization_assets
  FOR INSERT
  TO PUBLIC
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS customization_assets_owner_update ON public.customization_assets;
CREATE POLICY customization_assets_owner_update ON public.customization_assets
  FOR UPDATE
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId")
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

DROP POLICY IF EXISTS customization_assets_owner_delete ON public.customization_assets;
CREATE POLICY customization_assets_owner_delete ON public.customization_assets
  FOR DELETE
  TO PUBLIC
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = "userId");

-- Public catalog views (for Supabase anon/authenticated read)
-- Reset existing public views to avoid column-shape conflicts
DROP VIEW IF EXISTS public.v_product_variants_public;
DROP VIEW IF EXISTS public.v_products_public_list;
DROP VIEW IF EXISTS public.v_categories_public;
CREATE OR REPLACE VIEW public.v_products_public_list AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.subtitle,
  p.description,
  p."basePrice" AS "basePrice",
  p."categoryId" AS "categoryId",
  p.product_family AS "productFamily",
  p.product_subfamily AS "productSubfamily",
  p.requires_upload AS "requiresUpload",
  p.requires_builder AS "requiresBuilder",
  p.upload_profile_id AS "uploadProfileId",
  p."isCustomizable" AS "isCustomizable",
  p."mockupImagePath" AS "mockupImagePath",
  p.rating,
  p.reviews,
  p.features,
  p.benefits,
  p."productDetails" AS "productDetails",
  p."createdAt" AS "createdAt",
  p."updatedAt" AS "updatedAt",
  c.name AS "categoryName",
  c.slug AS "categorySlug"
FROM public.products p
JOIN public.categories c ON c.id = p."categoryId"
WHERE p.is_published = true;

CREATE OR REPLACE VIEW public.v_product_variants_public AS
SELECT
  v.id,
  v."productId" AS "productId",
  v.name,
  v.sku,
  v.price,
  v."originalPrice" AS "originalPrice",
  v.sizes,
  v."imagePath" AS "imagePath",
  v."galleryPaths" AS "galleryPaths",
  v.stock,
  v."isAvailable" AS "isAvailable",
  v."sortOrder" AS "sortOrder",
  v."createdAt" AS "createdAt",
  v."updatedAt" AS "updatedAt"
FROM public.product_variants v
JOIN public.products p ON p.id = v."productId"
WHERE p.is_published = true;

CREATE OR REPLACE VIEW public.v_categories_public AS
SELECT
  c.id,
  c.name,
  c.slug
FROM public.categories c
WHERE EXISTS (
  SELECT 1
  FROM public.products p
  WHERE p."categoryId" = c.id
    AND p.is_published = true
);

-- Restrict direct catalog table access; expose only via views
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.categories, public.products, public.product_variants, public.orders, public.customization_assets FROM anon';
    EXECUTE 'GRANT SELECT ON TABLE public.v_categories_public, public.v_products_public_list, public.v_product_variants_public TO anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.categories, public.products, public.product_variants FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public.orders, public.customization_assets FROM authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.v_categories_public, public.v_products_public_list, public.v_product_variants_public TO authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders, public.customization_assets TO authenticated';
  END IF;
END $$;



