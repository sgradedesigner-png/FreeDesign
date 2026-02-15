import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createViews() {
  console.log('📦 Creating views...');

  const viewSql = `
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
`;

  try {
    await prisma.$executeRawUnsafe(viewSql);
    console.log('✅ v_products_public_list created');
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }

  await prisma.$disconnect();
}

createViews();
