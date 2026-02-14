-- DropIndex
DROP INDEX IF EXISTS "products_createdAt_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_variants_stock_idx" ON "product_variants"("stock");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_title_idx" ON "products"("title");


