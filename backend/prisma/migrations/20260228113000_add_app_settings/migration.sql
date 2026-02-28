-- Add app_settings table for admin-managed key-value configuration

CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
CREATE INDEX "app_settings_category_idx" ON "app_settings"("category");

