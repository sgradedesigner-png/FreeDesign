-- Phase 1: Collections Data Model
-- P1-01: Add first-class collections for merchandising and navigation

-- Create collections table
CREATE TABLE IF NOT EXISTS "collections" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create collection_products join table
CREATE TABLE IF NOT EXISTS "collection_products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "collection_id" UUID NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_products_unique" UNIQUE ("collection_id", "product_id")
);

-- Indexes for collections
CREATE INDEX IF NOT EXISTS "collections_slug_idx" ON "collections"("slug");
CREATE INDEX IF NOT EXISTS "collections_active_sort_idx" ON "collections"("is_active", "sort_order");

-- Indexes for collection_products
CREATE INDEX IF NOT EXISTS "collection_products_collection_idx" ON "collection_products"("collection_id");
CREATE INDEX IF NOT EXISTS "collection_products_product_idx" ON "collection_products"("product_id");
CREATE INDEX IF NOT EXISTS "collection_products_sort_idx" ON "collection_products"("collection_id", "sort_order");

-- Enable RLS on collections
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_products" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collections
-- Public read access for active collections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'collections_public_read'
  ) THEN
    CREATE POLICY "collections_public_read" ON "collections"
      FOR SELECT
      USING ("is_active" = true);
  END IF;
END $$;

-- Admin full access to collections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'collections_admin_all'
  ) THEN
    CREATE POLICY "collections_admin_all" ON "collections"
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()::text
          AND profiles.role = 'ADMIN'
        )
      );
  END IF;
END $$;

-- RLS Policies for collection_products
-- Public read access (joins with collections public read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collection_products' AND policyname = 'collection_products_public_read'
  ) THEN
    CREATE POLICY "collection_products_public_read" ON "collection_products"
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM collections
          WHERE collections.id = collection_id
          AND collections.is_active = true
        )
      );
  END IF;
END $$;

-- Admin full access to collection_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collection_products' AND policyname = 'collection_products_admin_all'
  ) THEN
    CREATE POLICY "collection_products_admin_all" ON "collection_products"
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()::text
          AND profiles.role = 'ADMIN'
        )
      );
  END IF;
END $$;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for collections
DROP TRIGGER IF EXISTS set_timestamp_collections ON "collections";
CREATE TRIGGER set_timestamp_collections
  BEFORE UPDATE ON "collections"
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();
