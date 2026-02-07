-- Add benefits and productDetails to products
ALTER TABLE "products" ADD COLUMN "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "productDetails" TEXT[] DEFAULT ARRAY[]::TEXT[];
