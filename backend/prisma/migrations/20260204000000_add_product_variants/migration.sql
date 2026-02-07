-- CreateTable: product_variants table
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "originalPrice" DECIMAL(65,30),
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imagePath" TEXT NOT NULL,
    "galleryPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
CREATE INDEX "product_variants_sku_idx" ON "product_variants"("sku");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data Migration: Convert existing products to variants
-- For each product, create a variant for each color (or one default variant if no colors)
DO $$
DECLARE
    prod RECORD;
    color_item TEXT;
    variant_count INTEGER;
    first_image TEXT;
BEGIN
    FOR prod IN SELECT * FROM products
    LOOP
        variant_count := 0;

        -- Get first image from images array
        IF array_length(prod.images, 1) > 0 THEN
            first_image := prod.images[1];
        ELSE
            first_image := '';
        END IF;

        -- If product has colors, create a variant for each color
        IF array_length(prod.colors, 1) > 0 THEN
            FOREACH color_item IN ARRAY prod.colors
            LOOP
                INSERT INTO product_variants (
                    id,
                    "productId",
                    name,
                    sku,
                    price,
                    "originalPrice",
                    sizes,
                    "imagePath",
                    "galleryPaths",
                    stock,
                    "isAvailable",
                    "sortOrder",
                    "createdAt",
                    "updatedAt"
                ) VALUES (
                    gen_random_uuid(),
                    prod.id,
                    color_item,
                    prod.slug || '-' || LOWER(REPLACE(color_item, ' ', '-')) || '-' || variant_count,
                    prod.price,
                    NULL,
                    prod.sizes,
                    first_image,
                    prod.images,
                    prod.stock,
                    true,
                    variant_count,
                    prod."createdAt",
                    NOW()
                );
                variant_count := variant_count + 1;
            END LOOP;
        ELSE
            -- No colors, create one default variant
            INSERT INTO product_variants (
                id,
                "productId",
                name,
                sku,
                price,
                "originalPrice",
                sizes,
                "imagePath",
                "galleryPaths",
                stock,
                "isAvailable",
                "sortOrder",
                "createdAt",
                "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                prod.id,
                'Default',
                prod.slug || '-default',
                prod.price,
                NULL,
                prod.sizes,
                first_image,
                prod.images,
                prod.stock,
                true,
                0,
                prod."createdAt",
                NOW()
            );
        END IF;
    END LOOP;
END $$;

-- AlterTable: products - Add new fields and prepare for column drops
ALTER TABLE "products" ADD COLUMN "basePrice" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "rating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "reviews" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update basePrice from existing price
UPDATE "products" SET "basePrice" = "price";


-- DropColumn: Remove old columns from products table
ALTER TABLE "products" DROP COLUMN "colors";
ALTER TABLE "products" DROP COLUMN "sizes";
ALTER TABLE "products" DROP COLUMN "images";
ALTER TABLE "products" DROP COLUMN "stock";
ALTER TABLE "products" DROP COLUMN "price";
