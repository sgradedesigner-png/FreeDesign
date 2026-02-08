-- Restore sample categories and products
-- Run in Supabase SQL Editor

-- 1. Insert Categories
INSERT INTO public.categories (id, name, slug, "imageUrl", description, "createdAt", "updatedAt") VALUES
('cat-shoes', 'Shoes', 'shoes', 'https://example.com/shoes.jpg', 'Athletic and casual footwear', NOW(), NOW()),
('cat-clothing', 'Clothing', 'clothing', 'https://example.com/clothing.jpg', 'Apparel and sportswear', NOW(), NOW()),
('cat-accessories', 'Accessories', 'accessories', 'https://example.com/accessories.jpg', 'Sports accessories', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Sample Products
INSERT INTO public.products (id, title, slug, "isPublished", subtitle, description, "basePrice", "categoryId", rating, reviews, features, benefits, "productDetails", "createdAt", "updatedAt") VALUES
('prod-nike-dunk', 'Nike Dunk Low Big Kids Shoes', 'nike-dunk-low-big-kids-shoes', true,
 'Classic basketball style for kids',
 'The Nike Dunk Low brings retro basketball style to your everyday rotation. Leather upper with classic color blocking for a premium look.',
 102.00, 'cat-shoes', 4.5, 128,
 ARRAY['Leather and synthetic upper', 'Foam midsole', 'Rubber outsole'],
 ARRAY['Classic basketball style', 'Comfortable fit', 'Durable construction'],
 ARRAY['Color: Pink Foam/Light Crimson/Summit White', 'Style: DV7421-600'],
 NOW(), NOW()),

('prod-jordan-heir', 'Jordan Heir Series 2 Womens Basketball Shoes', 'jordan-heir-series-2-womens-basketball-shoes', true,
 'Performance basketball for women',
 'Built for explosive moves on the court, these shoes combine style with performance.',
 345.00, 'cat-shoes', 4.8, 64,
 ARRAY['Breathable mesh upper', 'Zoom Air cushioning', 'Herringbone traction'],
 ARRAY['Responsive cushioning', 'Superior grip', 'Lightweight design'],
 ARRAY['Color: White/Black/Light Lucid Green/Pink Blast', 'Style: FB9924-146'],
 NOW(), NOW()),

('prod-jordan-retro', 'Air Jordan 1 Retro Low Medium Olive and Summit White Big Kids Shoes', 'air-jordan-1-retro-low-olive-kids-shoes', true,
 'Iconic Air Jordan 1 in kids sizes',
 'The Air Jordan 1 Retro Low brings the timeless design of the original in a new colorway.',
 120.00, 'cat-shoes', 4.7, 95,
 ARRAY['Leather upper', 'Air-Sole unit', 'Rubber outsole with pivot circle'],
 ARRAY['Iconic Jordan style', 'Premium materials', 'All-day comfort'],
 ARRAY['Color: Medium Olive/Summit White/Sail/Black', 'Style: 553560-209'],
 NOW(), NOW()),

('prod-nike-tech-jacket', 'Nike Tech Mens Fleece Windrunner Full-Zip Jacket', 'nike-tech-mens-fleece-windrunner-jacket', true,
 'Modern fleece with thermal warmth',
 'Stay warm and dry in the Nike Tech Fleece Windrunner with lightweight insulation.',
 140.00, 'cat-clothing', 4.6, 52,
 ARRAY['Premium Tech Fleece fabric', 'Full-zip closure', 'Side pockets'],
 ARRAY['Thermal warmth without bulk', 'Moisture-wicking', 'Modern fit'],
 ARRAY['Color: Dark Grey Heather/Black', 'Style: FB8002-063'],
 NOW(), NOW()),

('prod-nike-vomero', 'Nike Vomero Premium Mens Road Running Shoes', 'nike-vomero-premium-mens-running-shoes', true,
 'Premium cushioning for long runs',
 'Experience plush comfort with the Nike Vomero, designed for road running.',
 230.00, 'cat-shoes', 4.9, 143,
 ARRAY['ZoomX foam', 'Engineered mesh upper', 'Waffle outsole'],
 ARRAY['Maximum cushioning', 'Responsive ride', 'Breathable comfort'],
 ARRAY['Color: Alabaster/Citron Pulse/Hyper Violet/Blue', 'Style: DV3865-101'],
 NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Sample Product Variants
INSERT INTO public.product_variants (id, "productId", name, sku, price, "originalPrice", sizes, "imagePath", "galleryPaths", stock, "isAvailable", "sortOrder", "createdAt", "updatedAt") VALUES
('var-nike-dunk-pink', 'prod-nike-dunk', 'Pink Foam/Light Crimson/Summit White', 'NIKE-DUNK-PINK-01', 102.00, NULL,
 ARRAY['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7'],
 'https://example.com/nike-dunk-pink.jpg',
 ARRAY['https://example.com/nike-dunk-pink-1.jpg', 'https://example.com/nike-dunk-pink-2.jpg'],
 25, true, 1, NOW(), NOW()),

('var-jordan-heir-white', 'prod-jordan-heir', 'White/Black/Light Lucid Green/Pink Blast', 'JORDAN-HEIR-WHITE-01', 345.00, NULL,
 ARRAY['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'],
 'https://example.com/jordan-heir-white.jpg',
 ARRAY['https://example.com/jordan-heir-white-1.jpg'],
 15, true, 1, NOW(), NOW()),

('var-jordan-retro-olive', 'prod-jordan-retro', 'Medium Olive/Summit White/Sail/Black', 'JORDAN-RETRO-OLIVE-01', 120.00, NULL,
 ARRAY['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7'],
 'https://example.com/jordan-retro-olive.jpg',
 ARRAY['https://example.com/jordan-retro-olive-1.jpg', 'https://example.com/jordan-retro-olive-2.jpg'],
 30, true, 1, NOW(), NOW()),

('var-nike-tech-grey', 'prod-nike-tech-jacket', 'Dark Grey Heather/Black', 'NIKE-TECH-GREY-01', 140.00, NULL,
 ARRAY['S', 'M', 'L', 'XL', 'XXL'],
 'https://example.com/nike-tech-grey.jpg',
 ARRAY['https://example.com/nike-tech-grey-1.jpg'],
 20, true, 1, NOW(), NOW()),

('var-nike-vomero-white', 'prod-nike-vomero', 'Alabaster/Citron Pulse/Hyper Violet/Blue', 'NIKE-VOMERO-WHITE-01', 230.00, NULL,
 ARRAY['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12'],
 'https://example.com/nike-vomero-white.jpg',
 ARRAY['https://example.com/nike-vomero-white-1.jpg', 'https://example.com/nike-vomero-white-2.jpg'],
 18, true, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Verify restoration
SELECT
  (SELECT COUNT(*) FROM public.categories) as categories,
  (SELECT COUNT(*) FROM public.products) as products,
  (SELECT COUNT(*) FROM public.product_variants) as variants;

-- 5. Show sample data
SELECT
  c.name as category,
  COUNT(p.id) as product_count
FROM public.categories c
LEFT JOIN public.products p ON p."categoryId" = c.id
GROUP BY c.name
ORDER BY c.name;
