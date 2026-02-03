/*
  Warnings:

  - Made the column `basePrice` on table `products` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "products_createdAt_idx";

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "basePrice" SET NOT NULL;

-- CreateIndex
CREATE INDEX "product_variants_stock_idx" ON "product_variants"("stock");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_title_idx" ON "products"("title");
