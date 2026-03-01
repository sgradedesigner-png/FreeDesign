-- CreateEnum
CREATE TYPE "UploadIntentPurpose" AS ENUM ('CUSTOMIZATION_DESIGN');

-- CreateTable
CREATE TABLE "upload_intents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "UploadIntentPurpose" NOT NULL,
    "folder" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "requested_file_size_bytes" INTEGER NOT NULL,
    "max_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upload_intents_user_id_created_at_idx" ON "upload_intents"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "upload_intents_expires_at_idx" ON "upload_intents"("expires_at");

-- RLS for upload_intents (Phase 0)
ALTER TABLE public.upload_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upload_intents_owner_select ON public.upload_intents;
CREATE POLICY upload_intents_owner_select ON public.upload_intents
  FOR SELECT
  TO authenticated
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

DROP POLICY IF EXISTS upload_intents_owner_insert ON public.upload_intents;
CREATE POLICY upload_intents_owner_insert ON public.upload_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

DROP POLICY IF EXISTS upload_intents_owner_update ON public.upload_intents;
CREATE POLICY upload_intents_owner_update ON public.upload_intents
  FOR UPDATE
  TO authenticated
  USING (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id)
  WITH CHECK (nullif(current_setting('request.jwt.claim.sub', true), '') = user_id);

-- Grants: authenticated can manage own upload intents under RLS; anon has no direct table access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.upload_intents TO authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.upload_intents FROM anon';
  END IF;
END $$;
