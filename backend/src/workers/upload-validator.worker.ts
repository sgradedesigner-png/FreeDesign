/**
 * Upload Validator Worker
 * Background worker that processes upload validation jobs
 */

import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { validateUploadAsset } from '../services/upload-validation.service';
import {
  fetchPendingJobs,
  markJobProcessing,
  markJobPassed,
  markJobFailed,
  scheduleRetry,
} from '../services/job-queue.service';

export type WorkerConfig = {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  maxConcurrency: number;
};

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  enabled: true,
  pollIntervalMs: 5000, // 5 seconds
  batchSize: 10,
  maxConcurrency: 5,
};

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * Process a single validation job
 */
async function processValidationJob(jobId: string, uploadAssetId: string): Promise<void> {
  try {
    // Mark job as processing
    await markJobProcessing(jobId);

    // Fetch upload asset
    const uploadAsset = await prisma.uploadAsset.findUnique({
      where: { id: uploadAssetId },
    });

    if (!uploadAsset) {
      logger.error({ jobId, uploadAssetId }, 'Upload asset not found for validation job');
      await markJobFailed(jobId, 'Upload asset not found', 'ASSET_NOT_FOUND');
      return;
    }

    logger.info(
      {
        jobId,
        uploadAssetId,
        cloudinaryPublicId: uploadAsset.cloudinaryPublicId,
        uploadFamily: uploadAsset.uploadFamily,
      },
      'Processing upload validation job'
    );

    // Validate the upload asset
    const validationResult = await validateUploadAsset({
      cloudinaryPublicId: uploadAsset.cloudinaryPublicId,
      mimeType: uploadAsset.mimeType,
      fileSizeBytes: uploadAsset.fileSizeBytes,
      widthPx: uploadAsset.widthPx ?? undefined,
      heightPx: uploadAsset.heightPx ?? undefined,
      dpi: uploadAsset.dpi ?? undefined,
      uploadFamily: uploadAsset.uploadFamily,
    });

    if (validationResult.passed) {
      // Update upload asset status to PASSED
      const existingMetadata =
        typeof uploadAsset.metadata === 'object' && uploadAsset.metadata !== null
          ? uploadAsset.metadata
          : {};

      await prisma.uploadAsset.update({
        where: { id: uploadAssetId },
        data: {
          validationStatus: 'PASSED',
          ...(validationResult.metadata && {
            metadata: {
              ...existingMetadata,
              validation: validationResult.metadata,
            },
          }),
          updatedAt: new Date(),
        },
      });

      // Mark job as passed
      await markJobPassed(jobId, validationResult.metadata);

      logger.info({ jobId, uploadAssetId }, 'Upload validation passed');
    } else {
      // Update upload asset status to FAILED
      const existingMetadata =
        typeof uploadAsset.metadata === 'object' && uploadAsset.metadata !== null
          ? uploadAsset.metadata
          : {};

      await prisma.uploadAsset.update({
        where: { id: uploadAssetId },
        data: {
          validationStatus: 'FAILED',
          metadata: {
            ...existingMetadata,
            validationError: {
              code: validationResult.errorCode,
              message: validationResult.errorMessage,
              timestamp: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        },
      });

      // Mark job as failed (terminal, no retry)
      await markJobFailed(
        jobId,
        validationResult.errorMessage || 'Validation failed',
        validationResult.errorCode
      );

      logger.warn(
        {
          jobId,
          uploadAssetId,
          errorCode: validationResult.errorCode,
        },
        'Upload validation failed'
      );
    }
  } catch (error) {
    logger.error({ error, jobId, uploadAssetId }, 'Error processing validation job');

    // Schedule retry with exponential backoff
    await scheduleRetry(
      jobId,
      error instanceof Error ? error.message : 'Unknown error during validation',
      'PROCESSING_ERROR'
    );
  }
}

/**
 * Process pending validation jobs in batch
 */
async function processBatch(config: WorkerConfig): Promise<void> {
  if (isProcessing) {
    logger.debug('Worker already processing, skipping this cycle');
    return;
  }

  isProcessing = true;

  try {
    const pendingJobs = await fetchPendingJobs(config.batchSize);

    if (pendingJobs.length === 0) {
      logger.debug('No pending validation jobs to process');
      return;
    }

    logger.info({ count: pendingJobs.length }, 'Processing validation jobs batch');

    // Process jobs with concurrency limit
    const chunks: typeof pendingJobs[] = [];
    for (let i = 0; i < pendingJobs.length; i += config.maxConcurrency) {
      chunks.push(pendingJobs.slice(i, i + config.maxConcurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((job) => processValidationJob(job.id, job.uploadAssetId).catch((error) => {
          logger.error({ error, jobId: job.id }, 'Failed to process validation job');
        }))
      );
    }

    logger.info({ processed: pendingJobs.length }, 'Validation jobs batch completed');
  } catch (error) {
    logger.error({ error }, 'Error in validation worker batch processing');
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the upload validation worker
 */
export function startUploadValidationWorker(config: WorkerConfig = DEFAULT_WORKER_CONFIG): void {
  if (!config.enabled) {
    logger.info('Upload validation worker disabled');
    return;
  }

  if (workerInterval) {
    logger.warn('Upload validation worker already running');
    return;
  }

  logger.info(
    {
      pollIntervalMs: config.pollIntervalMs,
      batchSize: config.batchSize,
      maxConcurrency: config.maxConcurrency,
    },
    'Starting upload validation worker'
  );

  // Start polling for jobs
  workerInterval = setInterval(() => {
    processBatch(config).catch((error) => {
      logger.error({ error }, 'Unhandled error in worker poll cycle');
    });
  }, config.pollIntervalMs);

  // Process first batch immediately
  processBatch(config).catch((error) => {
    logger.error({ error }, 'Error in initial worker batch');
  });

  logger.info('Upload validation worker started');
}

/**
 * Stop the upload validation worker
 */
export function stopUploadValidationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Upload validation worker stopped');
  }
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  running: boolean;
  processing: boolean;
} {
  return {
    running: workerInterval !== null,
    processing: isProcessing,
  };
}
