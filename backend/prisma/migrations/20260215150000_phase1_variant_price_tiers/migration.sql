-- Phase 1: Variant Price Tiers
-- Supports quantity-based pricing (e.g., 1-10 pcs = $5/ea, 11-50 = $4.50/ea, 51+ = $4/ea)

-- Create variant_price_tiers table
CREATE TABLE IF NOT EXISTS public.variant_price_tiers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  variant_id TEXT NOT NULL,
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 1),
  max_quantity INTEGER CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_variant
    FOREIGN KEY (variant_id)
    REFERENCES public.product_variants(id)
    ON DELETE CASCADE,

  CONSTRAINT unique_tier_range
    UNIQUE (variant_id, min_quantity)
);

-- Indexes for performance
CREATE INDEX idx_variant_price_tiers_variant_id ON public.variant_price_tiers(variant_id);
CREATE INDEX idx_variant_price_tiers_quantity ON public.variant_price_tiers(variant_id, min_quantity);

-- RLS Policies: Public read, admin write
ALTER TABLE public.variant_price_tiers ENABLE ROW LEVEL SECURITY;

-- Public can read all tiers (needed for pricing display)
CREATE POLICY "Public read access to price tiers"
  ON public.variant_price_tiers
  FOR SELECT
  USING (true);

-- Admin can manage tiers
CREATE POLICY "Admin can insert price tiers"
  ON public.variant_price_tiers
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'ADMIN'
  );

CREATE POLICY "Admin can update price tiers"
  ON public.variant_price_tiers
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'ADMIN'
  );

CREATE POLICY "Admin can delete price tiers"
  ON public.variant_price_tiers
  FOR DELETE
  USING (
    auth.jwt() ->> 'role' = 'ADMIN'
  );

-- Grant permissions
GRANT SELECT ON public.variant_price_tiers TO anon, authenticated;
GRANT ALL ON public.variant_price_tiers TO service_role;

-- Sample data for testing (10x10 DTF transfer)
-- Assumes a variant with id exists (will be added manually or via seed script)
-- Uncomment and update variant_id when ready:
/*
INSERT INTO public.variant_price_tiers (variant_id, min_quantity, max_quantity, unit_price) VALUES
  ('sample-variant-id', 1, 10, 5.00),
  ('sample-variant-id', 11, 50, 4.50),
  ('sample-variant-id', 51, 100, 4.00),
  ('sample-variant-id', 101, NULL, 3.50)
ON CONFLICT (variant_id, min_quantity) DO NOTHING;
*/
