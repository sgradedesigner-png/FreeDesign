-- P3-04: Builder-to-Cart and Builder-to-Order Handoff
-- Adds builder_project_id FK to cart_items (mutable reference, ownership-verified at add time)
-- Adds builder_project_version_id FK to order_items (immutable snapshot, frozen at checkout)

-- ── cart_items: add builder_project_id ──────────────────────────────────────
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS builder_project_id UUID
    REFERENCES gang_sheet_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_builder_project_id
  ON cart_items (builder_project_id)
  WHERE builder_project_id IS NOT NULL;

-- ── order_items: add builder_project_version_id ──────────────────────────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS builder_project_version_id UUID
    REFERENCES gang_sheet_project_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_builder_project_version_id
  ON order_items (builder_project_version_id)
  WHERE builder_project_version_id IS NOT NULL;

-- ── RLS policy: cart builder project must belong to cart owner ────────────────
-- (Enforced in application layer; no SQL-level row policy needed here because
--  cart_items already inherit cart ownership via FK + application auth.)
