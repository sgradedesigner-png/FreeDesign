-- Verify public catalog views exist and include expected columns
DO $$
DECLARE
  missing_views text;
BEGIN
  SELECT string_agg(view_name, ', ' ORDER BY view_name)
    INTO missing_views
  FROM (
    VALUES
      ('v_categories_public'),
      ('v_products_public_list'),
      ('v_product_variants_public')
  ) AS expected(view_name)
  LEFT JOIN information_schema.views v
    ON v.table_schema = 'public'
   AND v.table_name = expected.view_name
  WHERE v.table_name IS NULL;

  IF missing_views IS NOT NULL THEN
    RAISE EXCEPTION 'Missing public views: %', missing_views;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'v_products_public_list'
      AND column_name = 'productFamily'
  ) THEN
    RAISE EXCEPTION 'v_products_public_list is missing productFamily column';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.v_products_public_list vp
    JOIN public.products p ON p.id = vp.id
    WHERE p.is_published = false
  ) THEN
    RAISE EXCEPTION 'v_products_public_list exposes unpublished products';
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM public.v_categories_public) AS categories_count,
  (SELECT count(*) FROM public.v_products_public_list) AS products_count,
  (SELECT count(*) FROM public.v_product_variants_public) AS variants_count;
