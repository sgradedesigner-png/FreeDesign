-- Verify RLS is enabled on Phase 0 target tables
DO $$
DECLARE
  missing_tables text;
BEGIN
  SELECT string_agg(target.table_name, ', ' ORDER BY target.table_name)
    INTO missing_tables
  FROM (
    VALUES
      ('categories'),
      ('products'),
      ('product_variants'),
      ('orders'),
      ('customization_assets')
  ) AS target(table_name)
  LEFT JOIN pg_class c
    ON c.relname = target.table_name
  LEFT JOIN pg_namespace n
    ON n.oid = c.relnamespace
   AND n.nspname = 'public'
  WHERE c.relrowsecurity IS DISTINCT FROM true;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled for: %', missing_tables;
  END IF;
END $$;

-- Show policies for manual inspection
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('categories', 'products', 'product_variants', 'orders', 'customization_assets')
ORDER BY tablename, policyname;
