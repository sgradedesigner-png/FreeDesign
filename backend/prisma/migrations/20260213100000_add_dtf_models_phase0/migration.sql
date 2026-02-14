-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('NEW', 'ART_CHECK', 'READY_TO_PRINT', 'PRINTING', 'QC', 'PACKED', 'SHIPPED', 'DONE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mockupImagePath" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "addOnFees" DECIMAL(65,30),
ADD COLUMN     "isCustomOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionStatus" "ProductionStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "rushFee" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "print_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "maxWidthCm" DOUBLE PRECISION NOT NULL,
    "maxHeightCm" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_print_areas" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "printAreaId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_print_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_size_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "widthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "print_size_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "printSizeTierId" TEXT,
    "printAreaId" TEXT,
    "minQuantity" INTEGER,
    "maxQuantity" INTEGER,
    "price" DECIMAL(65,30) NOT NULL,
    "discountPercent" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "cloudinaryId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "dpi" INTEGER,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_customizations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemIndex" INTEGER NOT NULL,
    "printAreaId" TEXT NOT NULL,
    "printSizeTierId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "placementConfig" JSONB,
    "printFee" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_status_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "ProductionStatus",
    "toStatus" "ProductionStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_areas_isActive_sortOrder_idx" ON "print_areas"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "print_areas_name_key" ON "print_areas"("name");

-- CreateIndex
CREATE INDEX "product_print_areas_productId_idx" ON "product_print_areas"("productId");

-- CreateIndex
CREATE INDEX "product_print_areas_printAreaId_idx" ON "product_print_areas"("printAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "product_print_areas_productId_printAreaId_key" ON "product_print_areas"("productId", "printAreaId");

-- CreateIndex
CREATE INDEX "print_size_tiers_isActive_sortOrder_idx" ON "print_size_tiers"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "print_size_tiers_name_key" ON "print_size_tiers"("name");

-- CreateIndex
CREATE INDEX "pricing_rules_ruleType_isActive_idx" ON "pricing_rules"("ruleType", "isActive");

-- CreateIndex
CREATE INDEX "pricing_rules_printSizeTierId_idx" ON "pricing_rules"("printSizeTierId");

-- CreateIndex
CREATE INDEX "pricing_rules_printAreaId_idx" ON "pricing_rules"("printAreaId");

-- CreateIndex
CREATE INDEX "customization_assets_userId_idx" ON "customization_assets"("userId");

-- CreateIndex
CREATE INDEX "customization_assets_createdAt_idx" ON "customization_assets"("createdAt");

-- CreateIndex
CREATE INDEX "order_item_customizations_orderId_idx" ON "order_item_customizations"("orderId");

-- CreateIndex
CREATE INDEX "order_item_customizations_orderId_orderItemIndex_idx" ON "order_item_customizations"("orderId", "orderItemIndex");

-- CreateIndex
CREATE INDEX "order_item_customizations_assetId_idx" ON "order_item_customizations"("assetId");

-- CreateIndex
CREATE INDEX "production_status_events_orderId_idx" ON "production_status_events"("orderId");

-- CreateIndex
CREATE INDEX "production_status_events_toStatus_idx" ON "production_status_events"("toStatus");

-- CreateIndex
CREATE INDEX "orders_productionStatus_idx" ON "orders"("productionStatus");

-- AddForeignKey
ALTER TABLE "product_print_areas" ADD CONSTRAINT "product_print_areas_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_print_areas" ADD CONSTRAINT "product_print_areas_printAreaId_fkey" FOREIGN KEY ("printAreaId") REFERENCES "print_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_printSizeTierId_fkey" FOREIGN KEY ("printSizeTierId") REFERENCES "print_size_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_printAreaId_fkey" FOREIGN KEY ("printAreaId") REFERENCES "print_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_printAreaId_fkey" FOREIGN KEY ("printAreaId") REFERENCES "print_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_printSizeTierId_fkey" FOREIGN KEY ("printSizeTierId") REFERENCES "print_size_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "customization_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_status_events" ADD CONSTRAINT "production_status_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

