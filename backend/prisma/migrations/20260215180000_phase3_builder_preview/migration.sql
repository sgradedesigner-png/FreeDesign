-- Phase 3 P3-02: Builder Preview Job Queue
-- Migration: 20260215180000_phase3_builder_preview

-- CreateEnum
CREATE TYPE "BuilderPreviewJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateTable: builder_preview_jobs
CREATE TABLE "builder_preview_jobs" (
    "id"          UUID                       NOT NULL DEFAULT gen_random_uuid(),
    "project_id"  UUID                       NOT NULL,
    "status"      "BuilderPreviewJobStatus"  NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER                    NOT NULL DEFAULT 0,
    "max_retries" INTEGER                    NOT NULL DEFAULT 3,
    "next_run_at" TIMESTAMPTZ,
    "last_error"  TEXT,
    "created_at"  TIMESTAMPTZ                NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ                NOT NULL DEFAULT now(),

    CONSTRAINT "builder_preview_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: builder_preview_assets
CREATE TABLE "builder_preview_assets" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "job_id"         UUID        NOT NULL,
    "project_id"     UUID        NOT NULL,
    "cloudinary_url" TEXT,
    "width_px"       INTEGER,
    "height_px"      INTEGER,
    "file_size_bytes" INTEGER,
    "metadata"       JSONB       NOT NULL DEFAULT '{}',
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "builder_preview_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: preview_jobs → gang_sheet_projects
ALTER TABLE "builder_preview_jobs"
    ADD CONSTRAINT "builder_preview_jobs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "gang_sheet_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: preview_assets → preview_jobs
ALTER TABLE "builder_preview_assets"
    ADD CONSTRAINT "builder_preview_assets_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "builder_preview_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: (project_id, status)
CREATE INDEX "builder_preview_jobs_project_id_status_idx"
    ON "builder_preview_jobs" ("project_id", "status");

-- CreateIndex: (status, next_run_at) — worker polling
CREATE INDEX "builder_preview_jobs_status_next_run_at_idx"
    ON "builder_preview_jobs" ("status", "next_run_at");

-- CreateIndex: project_id on preview_assets
CREATE INDEX "builder_preview_assets_project_id_idx"
    ON "builder_preview_assets" ("project_id");

-- CreateIndex: job_id on preview_assets
CREATE INDEX "builder_preview_assets_job_id_idx"
    ON "builder_preview_assets" ("job_id");

-- updated_at trigger for builder_preview_jobs
CREATE OR REPLACE FUNCTION update_builder_preview_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_builder_preview_jobs_updated_at
    BEFORE UPDATE ON "builder_preview_jobs"
    FOR EACH ROW EXECUTE FUNCTION update_builder_preview_jobs_updated_at();
