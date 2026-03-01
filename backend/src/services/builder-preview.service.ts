/**
 * builder-preview.service.ts
 * Phase 3 P3-02 — Builder preview job management
 *
 * Enqueues preview render jobs for gang sheet projects and exposes
 * status polling. Actual rendering is handled by builder-preview.worker.ts.
 */

import { prisma } from '../lib/prisma';
import { BuilderPreviewJobStatus } from '@prisma/client';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Job lifecycle — called by routes
// ---------------------------------------------------------------------------

/**
 * Enqueue a preview render job for a project.
 * If a PENDING or PROCESSING job already exists it is returned instead of
 * creating a duplicate (idempotent per project).
 */
export async function enqueuePreviewJob(projectId: string, ownerId: string) {
  // Ownership check
  const project = await prisma.gangSheetProject.findFirst({
    where:  { id: projectId, ownerId },
    select: { id: true, canvasWidthCm: true, canvasHeightCm: true },
  });

  if (!project) return null;

  // Return existing active job if present
  const existing = await prisma.builderPreviewJob.findFirst({
    where:   { projectId, status: { in: [BuilderPreviewJobStatus.PENDING, BuilderPreviewJobStatus.PROCESSING] } },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.builderPreviewJob.create({
    data: {
      projectId,
      status:    BuilderPreviewJobStatus.PENDING,
      nextRunAt: new Date(),
    },
  });
}

/**
 * Get the latest preview job and its assets for a project.
 */
export async function getLatestPreview(projectId: string, ownerId: string) {
  // Ownership check
  const project = await prisma.gangSheetProject.findFirst({
    where:  { id: projectId, ownerId },
    select: { id: true },
  });

  if (!project) return null;

  return prisma.builderPreviewJob.findFirst({
    where:   { projectId },
    orderBy: { createdAt: 'desc' },
    include: { assets: true },
  });
}

// ---------------------------------------------------------------------------
// Job lifecycle — called by worker
// ---------------------------------------------------------------------------

/** Fetch a batch of pending jobs ready to process. */
export async function fetchPendingPreviewJobs(batchSize: number) {
  return prisma.builderPreviewJob.findMany({
    where: {
      status:    BuilderPreviewJobStatus.PENDING,
      nextRunAt: { lte: new Date() },
    },
    orderBy: { nextRunAt: 'asc' },
    take:    batchSize,
    include: {
      project: {
        include: { items: { orderBy: { zIndex: 'asc' } } },
      },
    },
  });
}

/** Mark job as PROCESSING (optimistic lock via status filter). */
export async function markPreviewJobProcessing(jobId: string) {
  return prisma.builderPreviewJob.updateMany({
    where:  { id: jobId, status: BuilderPreviewJobStatus.PENDING },
    data:   { status: BuilderPreviewJobStatus.PROCESSING },
  });
}

/** Mark job as COMPLETE and attach the generated asset record. */
export async function markPreviewJobComplete(
  jobId:    string,
  projectId: string,
  assetData: {
    cloudinaryUrl?: string;
    widthPx?:       number;
    heightPx?:      number;
    fileSizeBytes?: number;
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.builderPreviewJob.update({
      where: { id: jobId },
      data:  { status: BuilderPreviewJobStatus.COMPLETE },
    });

    return tx.builderPreviewAsset.create({
      data: {
        jobId,
        projectId,
        cloudinaryUrl: assetData.cloudinaryUrl ?? null,
        widthPx:       assetData.widthPx ?? null,
        heightPx:      assetData.heightPx ?? null,
        fileSizeBytes: assetData.fileSizeBytes ?? null,
      },
    });
  });
}

/** Mark job as FAILED and optionally schedule a retry. */
export async function markPreviewJobFailed(
  jobId:    string,
  message:  string,
  retryDelayMs = 30_000,
) {
  const job = await prisma.builderPreviewJob.findUnique({
    where:  { id: jobId },
    select: { retryCount: true, maxRetries: true },
  });

  if (!job) return;

  const shouldRetry = job.retryCount < job.maxRetries;

  logger.warn(
    { jobId, retryCount: job.retryCount, maxRetries: job.maxRetries, shouldRetry },
    '[BuilderPreview] job failed',
  );

  await prisma.builderPreviewJob.update({
    where: { id: jobId },
    data: {
      status:     shouldRetry ? BuilderPreviewJobStatus.PENDING : BuilderPreviewJobStatus.FAILED,
      retryCount: { increment: 1 },
      nextRunAt:  shouldRetry ? new Date(Date.now() + retryDelayMs) : null,
      lastError:  message,
    },
  });
}
