/**
 * seed-blank-products.ts
 * Uploads blank garment images from apps/admin/Blank Print Products/
 * to Cloudinary and creates 7 BLANKS products in the database.
 *
 * Run: ts-node --require dotenv/config prisma/seed-blank-products.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure:     true,
});

const IMAGES_DIR = path.resolve(__dirname, '../../apps/admin/Blank Print Products');

// Category slug for blank garments — created if missing
const BLANKS_CATEGORY_SLUG = 'blanks';

async function uploadImage(productId: string, filename: string): Promise<string> {
  const filePath = path.join(IMAGES_DIR, filename);
  const buffer   = fs.readFileSync(filePath);
  const ext      = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `products/${productId}`,
        public_id:     baseName.replace(/\s+/g, '-').toLowerCase(),
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('No result'));
        console.log(`  ✓ Uploaded ${filename}`);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

interface ProductDef {
  title:      string;
  slug:       string;
  subtitle:   string;
  price:      number;
  sizes:      string[];
  sku:        string;
  mainImage:  string;           // filename from IMAGES_DIR
  gallery:    string[];         // filenames from IMAGES_DIR (may include mainImage)
}

const PRODUCTS: ProductDef[] = [
  {
    title:      'Basketball Jersey – Blank',
    slug:       'blank-basketball-jersey',
    subtitle:   'DTF хэвлэлд тохирсон хоосон баскетбол дээл',
    price:      35000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    sku:        'BLANK-BBALL-JERSEY-001',
    mainImage:  'BasketBall Jersey Front.png',
    gallery:    ['BasketBall Jersey Front.png', 'BasketBall Jersey Back.png'],
  },
  {
    title:      'Hoodie – Blank',
    slug:       'blank-hoodie',
    subtitle:   'DTF хэвлэлд тохирсон хоосон hoods',
    price:      55000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    sku:        'BLANK-HOODIE-001',
    mainImage:  'Hoodie Front.png',
    gallery:    ['Hoodie Front.png', 'Hoodie Back.png', 'Hoode Left.png', 'Hoodie Right.png'],
  },
  {
    title:      'Polo Shirt – Blank',
    slug:       'blank-polo-shirt',
    subtitle:   'DTF хэвлэлд тохирсон хоосон поло цамц',
    price:      45000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    sku:        'BLANK-POLO-001',
    mainImage:  'Polo Front.png',
    gallery:    ['Polo Front.png', 'Polo Back.png', 'Polo Left.png', 'Polo Right.png'],
  },
  {
    title:      'Soccer Jersey – Blank',
    slug:       'blank-soccer-jersey',
    subtitle:   'DTF хэвлэлд тохирсон хоосон хөлбөмбөгийн трикот',
    price:      35000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    sku:        'BLANK-SOCCER-JERSEY-001',
    mainImage:  'Soccer Jersey Front.png',
    gallery:    ['Soccer Jersey Front.png', 'Soccer Jersey Back.png'],
  },
  {
    title:      'Sweatshirt – Blank',
    slug:       'blank-sweatshirt',
    subtitle:   'DTF хэвлэлд тохирсон хоосон свит ширт',
    price:      50000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    sku:        'BLANK-SWEATSHIRT-001',
    mainImage:  'Sweatshirt Front.png',
    gallery:    ['Sweatshirt Front.png', 'Sweatshirt Back.png', 'Sweatshirt Left.png', 'Sweatshirt Right.png'],
  },
  {
    title:      'Tank Top – Blank',
    slug:       'blank-tank-top',
    subtitle:   'DTF хэвлэлд тохирсон хоосон тэнк топ',
    price:      30000,
    sizes:      ['XS', 'S', 'M', 'L', 'XL'],
    sku:        'BLANK-TANKTOP-001',
    mainImage:  'TankTop Front.png',
    gallery:    ['TankTop Front.png', 'TankTop Back.png'],
  },
  {
    title:      'Tote Bag – Blank',
    slug:       'blank-tote-bag',
    subtitle:   'DTF хэвлэлд тохирсон хоосон тоот уут',
    price:      25000,
    sizes:      [],
    sku:        'BLANK-TOTE-BAG-001',
    mainImage:  'Tote Bag.png',
    gallery:    ['Tote Bag.png'],
  },
];

async function main() {
  console.log('🚀 Starting blank products seed...\n');

  // Ensure "Blanks" category exists
  const blanksCategory = await prisma.category.upsert({
    where:  { slug: BLANKS_CATEGORY_SLUG },
    update: { name: 'Blanks' },
    create: { name: 'Blanks', slug: BLANKS_CATEGORY_SLUG },
  });
  console.log(`📂 Category: ${blanksCategory.name} (${blanksCategory.id})\n`);

  for (const def of PRODUCTS) {
    // Check slug uniqueness — skip if already seeded
    const existing = await prisma.product.findUnique({ where: { slug: def.slug } });
    if (existing) {
      console.log(`⏭  Skipping "${def.title}" — already exists`);
      continue;
    }

    console.log(`\n📦 Creating: ${def.title}`);

    // Generate a stable product ID so Cloudinary folder matches
    const { randomUUID } = await import('crypto');
    const productId = randomUUID();

    // Upload images
    console.log('  Uploading images...');
    const mainUrl = await uploadImage(productId, def.mainImage);

    const uniqueGallery = [...new Set(def.gallery)];
    const galleryUrls: string[] = [];
    for (const filename of uniqueGallery) {
      // Reuse already-uploaded main image URL when filename matches
      if (filename === def.mainImage) {
        galleryUrls.push(mainUrl);
      } else {
        galleryUrls.push(await uploadImage(productId, filename));
      }
    }

    // Gallery includes ALL views (main image first, then the rest)
    const extraGallery = galleryUrls;

    // Create product
    const product = await prisma.product.create({
      data: {
        id:            productId,
        title:         def.title,
        slug:          def.slug,
        subtitle:      def.subtitle,
        is_published:  true,
        productFamily: 'BLANKS',
        isCustomizable: false,
        requiresUpload: false,
        requiresBuilder: false,
        basePrice:     def.price,
        categoryId:    blanksCategory.id,
        metadata:      {},
        variants: {
          create: [
            {
              name:        'Standard White',
              sku:         def.sku,
              price:       def.price,
              sizes:       def.sizes,
              imagePath:   mainUrl,
              galleryPaths: extraGallery,
              stock:       999,
              isAvailable: true,
              sortOrder:   0,
            },
          ],
        },
      },
      include: { variants: true },
    });

    console.log(`  ✅ Created "${product.title}" (id: ${product.id})`);
  }

  console.log('\n🎉 Blank products seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
