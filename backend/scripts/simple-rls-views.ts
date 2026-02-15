import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function apply() {
  console.log('📦 Enabling RLS on Phase 0 tables...');

  const tables = ['categories', 'products', 'product_variants', 'orders', 'customization_assets'];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      console.log(`✓ RLS enabled on ${table}`);
    } catch (e: any) {
      console.log(`⚠ ${table}: ${e.message}`);
    }
  }

  console.log('\n📦 Creating public views...');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW public.v_products_public_list AS
      SELECT
        p.id,
        p.title,
        p.slug,
        p.subtitle,
        p.description,
        p."basePrice",
        p."categoryId",
        p.product_family AS "productFamily",
        p.product_subfamily AS "productSubfamily",
        p.requires_upload AS "requiresUpload",
        p.requires_builder AS "requiresBuilder",
        p.upload_profile_id AS "uploadProfileId",
        p."isCustomizable",
        p."mockupImagePath",
        p.rating,
        p.reviews,
        p.features,
        p.benefits,
        p."productDetails",
        p."createdAt",
        p."updatedAt",
        c.name AS "categoryName",
        c.slug AS "categorySlug"
      FROM public.products p
      JOIN public.categories c ON c.id = p."categoryId"
      WHERE p.is_published = true;
    `);
    console.log('✓ v_products_public_list created');
  } catch (e: any) {
    console.error('✗ v_products_public_list:', e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW public.v_product_variants_public AS
      SELECT
        v.id,
        v."productId",
        v.name,
        v.sku,
        v.price,
        v."originalPrice",
        v.sizes,
        v."imagePath",
        v."galleryPaths",
        v.stock,
        v."isAvailable",
        v."sortOrder",
        v."createdAt",
        v."updatedAt"
      FROM public.product_variants v
      JOIN public.products p ON p.id = v."productId"
      WHERE p.is_published = true;
    `);
    console.log('✓ v_product_variants_public created');
  } catch (e: any) {
    console.error('✗ v_product_variants_public:', e.message);
  }

  console.log('\n✅ Done!');
  await prisma.$disconnect();
}

apply();
