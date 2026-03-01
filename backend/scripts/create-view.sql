-- Create simple public product list view
CREATE OR REPLACE VIEW public.v_products_public_list AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.description,
  p."basePrice",
  p."categoryId",
  p."createdAt",
  p."updatedAt",
  c.name AS "categoryName",
  c.slug AS "categorySlug"
FROM public.products p
JOIN public.categories c ON c.id = p."categoryId"
WHERE p.is_published = true;
