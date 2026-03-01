-- Phase 1: Normalized Order Items (Dual Write Migration)
-- Migrates from orders.items JSON to normalized order_items table

-- Create order_items table
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "selectedOptions" JSONB,
    "productId" TEXT,
    "productName" TEXT,
    "variantName" TEXT,
    "variantSku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_variantId_idx" ON "order_items"("variantId");
CREATE INDEX IF NOT EXISTS "order_items_createdAt_idx" ON "order_items"("createdAt");

-- Add foreign key constraints
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS (Row Level Security)
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own order items
CREATE POLICY "Users can read own order items"
    ON "order_items"
    FOR SELECT
    USING (
        "orderId" IN (
            SELECT "id" FROM "orders" WHERE "userId" = auth.uid()::text
        )
    );

-- RLS Policy: Admins can read all order items
CREATE POLICY "Admins can read all order items"
    ON "order_items"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- RLS Policy: System can insert order items (service role)
CREATE POLICY "System can insert order items"
    ON "order_items"
    FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Admins can update order items
CREATE POLICY "Admins can update order items"
    ON "order_items"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- RLS Policy: Admins can delete order items
CREATE POLICY "Admins can delete order items"
    ON "order_items"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- Add comment to orders.items to mark as deprecated
COMMENT ON COLUMN "orders"."items" IS 'DEPRECATED: Use orderItems relation instead. Kept for backward compatibility during dual-write migration.';
