-- Phase 3: Gang Sheet Builder Data Model
-- Migration: 20260215170000_phase3_builder_models

-- CreateEnum
CREATE TYPE "BuilderProjectStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateTable: gang_sheet_projects
CREATE TABLE "gang_sheet_projects" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "owner_id"         TEXT         NOT NULL,
    "product_id"       UUID         NOT NULL,
    "title"            TEXT         NOT NULL DEFAULT 'Untitled Project',
    "status"           "BuilderProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "canvas_width_cm"  DOUBLE PRECISION NOT NULL,
    "canvas_height_cm" DOUBLE PRECISION NOT NULL,
    "metadata"         JSONB        NOT NULL DEFAULT '{}',
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "gang_sheet_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: gang_sheet_project_items
CREATE TABLE "gang_sheet_project_items" (
    "id"          UUID             NOT NULL DEFAULT gen_random_uuid(),
    "project_id"  UUID             NOT NULL,
    "asset_url"   TEXT             NOT NULL,
    "x_cm"        DOUBLE PRECISION NOT NULL,
    "y_cm"        DOUBLE PRECISION NOT NULL,
    "width_cm"    DOUBLE PRECISION NOT NULL,
    "height_cm"   DOUBLE PRECISION NOT NULL,
    "rotation"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z_index"     INTEGER          NOT NULL,
    "flip_h"      BOOLEAN          NOT NULL DEFAULT false,
    "flip_v"      BOOLEAN          NOT NULL DEFAULT false,
    "metadata"    JSONB            NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT "gang_sheet_project_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: gang_sheet_project_versions
CREATE TABLE "gang_sheet_project_versions" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "project_id"      UUID        NOT NULL,
    "version_number"  INTEGER     NOT NULL,
    "items_snapshot"  JSONB       NOT NULL,
    "metadata"        JSONB       NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "gang_sheet_project_versions_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "gang_sheet_project_versions_proj_ver_key" UNIQUE ("project_id", "version_number")
);

-- AddForeignKey: projects → products
ALTER TABLE "gang_sheet_projects"
    ADD CONSTRAINT "gang_sheet_projects_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: items → projects
ALTER TABLE "gang_sheet_project_items"
    ADD CONSTRAINT "gang_sheet_project_items_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "gang_sheet_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: versions → projects
ALTER TABLE "gang_sheet_project_versions"
    ADD CONSTRAINT "gang_sheet_project_versions_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "gang_sheet_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: (owner_id, updated_at) — list user projects sorted by recency
CREATE INDEX "gang_sheet_projects_owner_id_updated_at_idx"
    ON "gang_sheet_projects" ("owner_id", "updated_at" DESC);

-- CreateIndex: (status, updated_at) — filter active/draft projects, cleanup jobs
CREATE INDEX "gang_sheet_projects_status_updated_at_idx"
    ON "gang_sheet_projects" ("status", "updated_at" DESC);

-- CreateIndex: product_id — reverse lookup builder projects by product
CREATE INDEX "gang_sheet_projects_product_id_idx"
    ON "gang_sheet_projects" ("product_id");

-- CreateIndex: (project_id, z_index) — deterministic item ordering
CREATE INDEX "gang_sheet_project_items_project_id_z_index_idx"
    ON "gang_sheet_project_items" ("project_id", "z_index");

-- CreateIndex: project_id — bulk item fetch
CREATE INDEX "gang_sheet_project_items_project_id_idx"
    ON "gang_sheet_project_items" ("project_id");

-- CreateIndex: (project_id, version_number DESC) — version history lookup
CREATE INDEX "gang_sheet_project_versions_project_id_version_number_idx"
    ON "gang_sheet_project_versions" ("project_id", "version_number" DESC);

-- updated_at trigger for gang_sheet_projects
CREATE OR REPLACE FUNCTION update_gang_sheet_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gang_sheet_projects_updated_at
    BEFORE UPDATE ON "gang_sheet_projects"
    FOR EACH ROW EXECUTE FUNCTION update_gang_sheet_projects_updated_at();

-- updated_at trigger for gang_sheet_project_items
CREATE OR REPLACE FUNCTION update_gang_sheet_project_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gang_sheet_project_items_updated_at
    BEFORE UPDATE ON "gang_sheet_project_items"
    FOR EACH ROW EXECUTE FUNCTION update_gang_sheet_project_items_updated_at();

-- RLS: enable row-level security
ALTER TABLE "gang_sheet_projects"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gang_sheet_project_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gang_sheet_project_versions" ENABLE ROW LEVEL SECURITY;

-- RLS policies: owner can read/write their own projects
CREATE POLICY "owner_select_projects" ON "gang_sheet_projects"
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "owner_insert_projects" ON "gang_sheet_projects"
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "owner_update_projects" ON "gang_sheet_projects"
    FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "owner_delete_projects" ON "gang_sheet_projects"
    FOR DELETE USING (owner_id = auth.uid()::text);

-- RLS policies: owner can access items of their projects
CREATE POLICY "owner_select_items" ON "gang_sheet_project_items"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "gang_sheet_projects" p
            WHERE p.id = project_id AND p.owner_id = auth.uid()::text
        )
    );

CREATE POLICY "owner_all_items" ON "gang_sheet_project_items"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "gang_sheet_projects" p
            WHERE p.id = project_id AND p.owner_id = auth.uid()::text
        )
    );

-- RLS policies: owner can access versions of their projects
CREATE POLICY "owner_select_versions" ON "gang_sheet_project_versions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "gang_sheet_projects" p
            WHERE p.id = project_id AND p.owner_id = auth.uid()::text
        )
    );

-- RLS policies: service role (backend) bypasses RLS — service_role key has BYPASSRLS privilege by default in Supabase
