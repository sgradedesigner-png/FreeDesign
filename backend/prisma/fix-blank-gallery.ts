/**
 * fix-blank-gallery.ts
 * Prepends imagePath to galleryPaths for all BLANKS variants
 * where the main image is missing from the gallery.
 *
 * Run: ts-node --require dotenv/config prisma/fix-blank-gallery.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.productVariant.findMany({
    where: { product: { productFamily: 'BLANKS' } },
    select: {
      id: true,
      imagePath: true,
      galleryPaths: true,
      product: { select: { title: true } },
    },
  });

  let fixed = 0;
  for (const v of variants) {
    if (!v.imagePath) continue;
    if (v.galleryPaths.includes(v.imagePath)) {
      console.log(`⏭  "${v.product.title}" — front already in gallery`);
      continue;
    }

    // Prepend imagePath (front view) to the gallery
    await prisma.productVariant.update({
      where: { id: v.id },
      data:  { galleryPaths: [v.imagePath, ...v.galleryPaths] },
    });

    console.log(`✅ Fixed "${v.product.title}" — added front image to gallery (total: ${1 + v.galleryPaths.length})`);
    fixed++;
  }

  console.log(`\n🎉 Done — fixed ${fixed} variant(s)`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
