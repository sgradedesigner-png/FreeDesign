-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_cart_id" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "cart_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_slug" TEXT NOT NULL,
    "product_category" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "variant_price" DECIMAL(65,30) NOT NULL,
    "variant_original_price" DECIMAL(65,30),
    "variant_image" TEXT NOT NULL,
    "variant_sku" TEXT NOT NULL,
    "size" TEXT,
    "is_customized" BOOLEAN NOT NULL DEFAULT false,
    "option_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_user_id_status_idx" ON "carts"("user_id", "status");

-- CreateIndex
CREATE INDEX "carts_guest_cart_id_status_idx" ON "carts"("guest_cart_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_cart_key_key" ON "cart_items"("cart_id", "cart_key");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_updated_at_idx" ON "cart_items"("cart_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for carts and cart_items (Phase 0)
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Carts owner policies (authenticated users only)
DROP POLICY IF EXISTS carts_owner_select ON public.carts;
CREATE POLICY carts_owner_select ON public.carts
  FOR SELECT
  TO authenticated
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

DROP POLICY IF EXISTS carts_owner_insert ON public.carts;
CREATE POLICY carts_owner_insert ON public.carts
  FOR INSERT
  TO authenticated
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

DROP POLICY IF EXISTS carts_owner_update ON public.carts;
CREATE POLICY carts_owner_update ON public.carts
  FOR UPDATE
  TO authenticated
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id)
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

DROP POLICY IF EXISTS carts_owner_delete ON public.carts;
CREATE POLICY carts_owner_delete ON public.carts
  FOR DELETE
  TO authenticated
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

-- Cart item owner policies (follows cart ownership)
DROP POLICY IF EXISTS cart_items_owner_select ON public.cart_items;
CREATE POLICY cart_items_owner_select ON public.cart_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND nullif(current_setting('request.jwt.claim.sub', true), '') = c.user_id
    )
  );

DROP POLICY IF EXISTS cart_items_owner_insert ON public.cart_items;
CREATE POLICY cart_items_owner_insert ON public.cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND nullif(current_setting('request.jwt.claim.sub', true), '') = c.user_id
    )
  );

DROP POLICY IF EXISTS cart_items_owner_update ON public.cart_items;
CREATE POLICY cart_items_owner_update ON public.cart_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND nullif(current_setting('request.jwt.claim.sub', true), '') = c.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND nullif(current_setting('request.jwt.claim.sub', true), '') = c.user_id
    )
  );

DROP POLICY IF EXISTS cart_items_owner_delete ON public.cart_items;
CREATE POLICY cart_items_owner_delete ON public.cart_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND nullif(current_setting('request.jwt.claim.sub', true), '') = c.user_id
    )
  );

-- Grants: authenticated can manage own carts under RLS; anon has no direct cart table access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carts, public.cart_items TO authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.carts, public.cart_items FROM anon';
  END IF;
END $$;
