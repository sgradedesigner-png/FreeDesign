-- P3-05: Admin Operations — SLA Board, Reprint Queue, Hold/Release
-- Adds operational tables and extends orders with SLA / hold columns

-- ── orders: SLA and hold columns ────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sla_due_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_on_hold    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_sla_due_at
  ON orders (sla_due_at, "productionStatus")
  WHERE sla_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_is_on_hold
  ON orders (is_on_hold, "productionStatus")
  WHERE is_on_hold = TRUE;

-- ── order_sla_events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_sla_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sla_due_at    TIMESTAMPTZ NOT NULL,
  sla_tier      TEXT        NOT NULL DEFAULT 'STANDARD',  -- STANDARD | RUSH | CRITICAL
  notes         TEXT,
  set_by        TEXT        NOT NULL,                     -- admin user id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_sla_events_order_id
  ON order_sla_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_sla_events_due_at
  ON order_sla_events (sla_due_at, sla_tier);

-- ── order_holds ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_holds (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  held_by      TEXT        NOT NULL,                     -- admin user id
  released_by  TEXT,                                     -- admin user id (null until released)
  released_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_holds_order_id
  ON order_holds (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_holds_active
  ON order_holds (order_id)
  WHERE released_at IS NULL;

-- ── reprint_requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reprint_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'REQUESTED',
    -- REQUESTED | APPROVED | IN_QUEUE | PRINTING | DONE | REJECTED | CANCELLED
  reason        TEXT        NOT NULL,
  notes         TEXT,
  requested_by  TEXT        NOT NULL,                   -- admin user id
  approved_by   TEXT,                                   -- admin user id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reprint_requests_order_id
  ON reprint_requests (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reprint_requests_status
  ON reprint_requests (status, created_at DESC);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_order_holds_updated_at'
  ) THEN
    CREATE TRIGGER trg_order_holds_updated_at
      BEFORE UPDATE ON order_holds
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reprint_requests_updated_at'
  ) THEN
    CREATE TRIGGER trg_reprint_requests_updated_at
      BEFORE UPDATE ON reprint_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
