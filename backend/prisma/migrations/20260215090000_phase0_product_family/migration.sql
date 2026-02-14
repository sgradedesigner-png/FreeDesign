-- CreateEnum
CREATE TYPE "ProductFamily" AS ENUM (
  'BY_SIZE',
  'GANG_UPLOAD',
  'GANG_BUILDER',
  'BLANKS',
  'UV_BY_SIZE',
  'UV_GANG_UPLOAD',
  'UV_GANG_BUILDER'
);

-- AlterTable
ALTER TABLE "products"
ADD COLUMN "product_family" "ProductFamily" NOT NULL DEFAULT 'BLANKS',
ADD COLUMN "product_subfamily" TEXT,
ADD COLUMN "requires_upload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requires_builder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "upload_profile_id" TEXT;

-- CreateIndex
CREATE INDEX "products_product_family_is_published_idx" ON "products"("product_family", "is_published");
