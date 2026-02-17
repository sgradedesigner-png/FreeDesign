/**
 * builder-preview.worker.ts
 * Phase 3 P3-02 — Background worker for builder preview generation
 *
 * Polls for pending preview jobs and processes them.
 * Rendering is currently a stub that records a placeholder asset;
 * it will be replaced with a real canvas renderer (headless browser / sharp)
 * in P3-03 once the builder UI shape is finalised.
 */

import { logger } from '../lib/logger';
import {
  fetchPendingPreviewJobs,
  markPreviewJobProcessing,
  markPreviewJobComplete,
  markPreviewJobFailed,
} from '../services/builder-preview.service';

export type BuilderPreviewWorkerConfig = {
  enabled:       boolean;
  pollIntervalMs: number;
  batchSize:     number;
  maxConcurrency: number;
};

export const DEFAULT_BUILDER_PREVIEW_WORKER_CONFIG: BuilderPreviewWorkerConfig = {
  enabled:        true,
  pollIntervalMs: 10_000, // 10 s
  batchSize:      5,
  maxConcurrency: 2,
};

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processPreviewJob(job: Awaited<ReturnType<typeof fetchPendingPreviewJobs>>[number]) {
  const { id: jobId, projectId, project } = job;

  try {
    const updated = await markPreviewJobProcessing(jobId);
    if (updated.count === 0) {
      // Another worker claimed this job already — skip
      return;
    }

    logger.info({ jobId, projectId, itemCount: project.items.length }, '[BuilderPreview] processing job');

    // ── Rendering stub ───────────────────────────────────────────────────
    // TODO P3-03: replace with real rendering (e.g. sharp compositing or
    //             puppeteer screenshot of the builder canvas HTML).
    // For now we record a COMPLETE status without an actual Cloudinary URL
    // so that the API surface and job lifecycle are fully exercisable.
    // ────────────────────────────────────────────────────────────────────

    const widthPx  = Math.round(project.canvasWidthCm  * 96 / 2.54);
    const heightPx = Math.round(project.canvasHeightCm * 96 / 2.54);

    await markPreviewJobComplete(jobId, projectId, { widthPx, heightPx });

    logger.info({ jobId, projectId, widthPx, heightPx }, '[BuilderPreview] job complete (stub)');
  } catch (err: any) {
    logger.error({ jobId, projectId, error: err.message }, '[BuilderPreview] job threw error');
    await markPreviewJobFailed(jobId, err.message ?? 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

async function runBatch(config: BuilderPreviewWorkerConfig) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const jobs = await fetchPendingPreviewJobs(config.batchSize);
    if (jobs.length === 0) return;

    logger.info({ count: jobs.length }, '[BuilderPreview] processing batch');

    // Process with bounded concurrency
    const concurrency = Math.min(config.maxConcurrency, jobs.length);
    let cursor = 0;

    const runners = Array.from({ length: concurrency }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++]!;
        await processPreviewJob(job);
      }
    });

    await Promise.all(runners);
  } catch (err: any) {
    logger.error({ error: err.message }, '[BuilderPreview] batch error');
  } finally {
    isProcessing = false;
  }
}

export function startBuilderPreviewWorker(config: BuilderPreviewWorkerConfig = DEFAULT_BUILDER_PREVIEW_WORKER_CONFIG) {
  if (!config.enabled) {
    logger.info('[BuilderPreview] worker disabled by config');
    return;
  }

  if (workerInterval) {
    logger.warn('[BuilderPreview] worker already running');
    return;
  }

  logger.info({ pollIntervalMs: config.pollIntervalMs }, '[BuilderPreview] worker started');
  workerInterval = setInterval(() => runBatch(config), config.pollIntervalMs);
}

export function stopBuilderPreviewWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('[BuilderPreview] worker stopped');
  }
}
