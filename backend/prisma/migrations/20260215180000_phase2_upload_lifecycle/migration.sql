-- Phase 2: Upload Lifecycle Schema Migration
-- Creates normalized upload tables and validation/moderation infrastructure

-- Create enums
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'PROCESSING', 'PASSED', 'FAILED', 'DEAD_LETTER');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FLAGGED');

-- Create upload_assets table (first-class upload entities)
CREATE TABLE "upload_assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "cloudinary_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "dpi" INTEGER,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "upload_family" "ProductFamily",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_assets_pkey" PRIMARY KEY ("id")
);

-- Create cart_item_uploads table (links uploads to cart items)
CREATE TABLE "cart_item_uploads" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "cart_key" TEXT NOT NULL,
    "upload_asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_item_uploads_pkey" PRIMARY KEY ("id")
);

-- Create order_item_uploads table (links uploads to order items)
CREATE TABLE "order_item_uploads" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "upload_asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_uploads_pkey" PRIMARY KEY ("id")
);

-- Create upload_validation_jobs table (async validation queue)
CREATE TABLE "upload_validation_jobs" (
    "id" TEXT NOT NULL,
    "upload_asset_id" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_validation_jobs_pkey" PRIMARY KEY ("id")
);

-- Create upload_validation_events table (validation audit log)
CREATE TABLE "upload_validation_events" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT,
    "error_code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_validation_events_pkey" PRIMARY KEY ("id")
);

-- Create upload_moderation_actions table (admin moderation audit)
CREATE TABLE "upload_moderation_actions" (
    "id" TEXT NOT NULL,
    "upload_asset_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "previous_status" "ModerationStatus" NOT NULL,
    "new_status" "ModerationStatus" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_moderation_actions_pkey" PRIMARY KEY ("id")
);

-- Create indexes for upload_assets
CREATE INDEX "upload_assets_owner_id_created_at_idx" ON "upload_assets"("owner_id", "created_at" DESC);
CREATE INDEX "upload_assets_validation_status_created_at_idx" ON "upload_assets"("validation_status", "created_at" DESC);
CREATE INDEX "upload_assets_moderation_status_created_at_idx" ON "upload_assets"("moderation_status", "created_at" DESC);
CREATE INDEX "upload_assets_upload_family_idx" ON "upload_assets"("upload_family");

-- Create unique constraint and indexes for cart_item_uploads
CREATE UNIQUE INDEX "cart_item_uploads_cart_id_cart_key_upload_asset_id_key" ON "cart_item_uploads"("cart_id", "cart_key", "upload_asset_id");
CREATE INDEX "cart_item_uploads_cart_id_cart_key_idx" ON "cart_item_uploads"("cart_id", "cart_key");
CREATE INDEX "cart_item_uploads_upload_asset_id_idx" ON "cart_item_uploads"("upload_asset_id");

-- Create unique constraint and indexes for order_item_uploads
CREATE UNIQUE INDEX "order_item_uploads_order_item_id_upload_asset_id_key" ON "order_item_uploads"("order_item_id", "upload_asset_id");
CREATE INDEX "order_item_uploads_order_item_id_idx" ON "order_item_uploads"("order_item_id");
CREATE INDEX "order_item_uploads_upload_asset_id_idx" ON "order_item_uploads"("upload_asset_id");

-- Create indexes for upload_validation_jobs
CREATE INDEX "upload_validation_jobs_status_next_run_at_idx" ON "upload_validation_jobs"("status", "next_run_at");
CREATE INDEX "upload_validation_jobs_upload_asset_id_idx" ON "upload_validation_jobs"("upload_asset_id");
CREATE INDEX "upload_validation_jobs_created_at_idx" ON "upload_validation_jobs"("created_at" DESC);

-- Create indexes for upload_validation_events
CREATE INDEX "upload_validation_events_job_id_created_at_idx" ON "upload_validation_events"("job_id", "created_at" DESC);
CREATE INDEX "upload_validation_events_event_type_idx" ON "upload_validation_events"("event_type");

-- Create indexes for upload_moderation_actions
CREATE INDEX "upload_moderation_actions_upload_asset_id_created_at_idx" ON "upload_moderation_actions"("upload_asset_id", "created_at" DESC);
CREATE INDEX "upload_moderation_actions_actor_id_idx" ON "upload_moderation_actions"("actor_id");
CREATE INDEX "upload_moderation_actions_action_idx" ON "upload_moderation_actions"("action");

-- Add foreign key constraints
ALTER TABLE "cart_item_uploads" ADD CONSTRAINT "cart_item_uploads_upload_asset_id_fkey"
    FOREIGN KEY ("upload_asset_id") REFERENCES "upload_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_item_uploads" ADD CONSTRAINT "order_item_uploads_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_item_uploads" ADD CONSTRAINT "order_item_uploads_upload_asset_id_fkey"
    FOREIGN KEY ("upload_asset_id") REFERENCES "upload_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "upload_validation_jobs" ADD CONSTRAINT "upload_validation_jobs_upload_asset_id_fkey"
    FOREIGN KEY ("upload_asset_id") REFERENCES "upload_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "upload_validation_events" ADD CONSTRAINT "upload_validation_events_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "upload_validation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "upload_moderation_actions" ADD CONSTRAINT "upload_moderation_actions_upload_asset_id_fkey"
    FOREIGN KEY ("upload_asset_id") REFERENCES "upload_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on all new tables
ALTER TABLE "upload_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_item_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_item_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upload_validation_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upload_validation_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upload_moderation_actions" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for upload_assets

-- Users can read their own upload assets
CREATE POLICY "Users can read own upload assets"
    ON "upload_assets"
    FOR SELECT
    USING ("owner_id" = auth.uid()::text);

-- Users can insert their own upload assets
CREATE POLICY "Users can insert own upload assets"
    ON "upload_assets"
    FOR INSERT
    WITH CHECK ("owner_id" = auth.uid()::text);

-- Admins can read all upload assets
CREATE POLICY "Admins can read all upload assets"
    ON "upload_assets"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- Admins can update upload assets (for moderation)
CREATE POLICY "Admins can update upload assets"
    ON "upload_assets"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- RLS Policies for cart_item_uploads

-- Users can manage uploads linked to their cart
CREATE POLICY "Users can manage own cart item uploads"
    ON "cart_item_uploads"
    FOR ALL
    USING (
        "upload_asset_id" IN (
            SELECT "id" FROM "upload_assets" WHERE "owner_id" = auth.uid()::text
        )
    );

-- RLS Policies for order_item_uploads

-- Users can read uploads linked to their orders
CREATE POLICY "Users can read own order item uploads"
    ON "order_item_uploads"
    FOR SELECT
    USING (
        "order_item_id" IN (
            SELECT "oi"."id" FROM "order_items" "oi"
            JOIN "orders" "o" ON "o"."id" = "oi"."orderId"
            WHERE "o"."userId" = auth.uid()::text
        )
    );

-- Admins can read all order item uploads
CREATE POLICY "Admins can read all order item uploads"
    ON "order_item_uploads"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- RLS Policies for upload_validation_jobs

-- Users can read validation jobs for their uploads
CREATE POLICY "Users can read own validation jobs"
    ON "upload_validation_jobs"
    FOR SELECT
    USING (
        "upload_asset_id" IN (
            SELECT "id" FROM "upload_assets" WHERE "owner_id" = auth.uid()::text
        )
    );

-- System can insert/update validation jobs (service role)
CREATE POLICY "System can manage validation jobs"
    ON "upload_validation_jobs"
    FOR ALL
    WITH CHECK (true);

-- RLS Policies for upload_validation_events

-- Users can read validation events for their uploads
CREATE POLICY "Users can read own validation events"
    ON "upload_validation_events"
    FOR SELECT
    USING (
        "job_id" IN (
            SELECT "vj"."id" FROM "upload_validation_jobs" "vj"
            JOIN "upload_assets" "ua" ON "ua"."id" = "vj"."upload_asset_id"
            WHERE "ua"."owner_id" = auth.uid()::text
        )
    );

-- System can insert validation events (service role)
CREATE POLICY "System can insert validation events"
    ON "upload_validation_events"
    FOR INSERT
    WITH CHECK (true);

-- RLS Policies for upload_moderation_actions

-- Admins can read all moderation actions
CREATE POLICY "Admins can read moderation actions"
    ON "upload_moderation_actions"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );

-- Admins can insert moderation actions
CREATE POLICY "Admins can insert moderation actions"
    ON "upload_moderation_actions"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "profiles"
            WHERE "id" = auth.uid()::text
            AND "role" = 'ADMIN'
        )
    );
