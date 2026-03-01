/**
 * Job Queue Service
 * Generic service for processing background jobs with retry and dead-letter handling
 */

import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { ValidationStatus } from '@prisma/client';

export type JobQueueConfig = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

export const DEFAULT_QUEUE_CONFIG: JobQueueConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
};

/**
 * Calculate next retry time with exponential backoff
 */
export function calculateNextRunAt(
  retryCount: number,
  config: JobQueueConfig = DEFAULT_QUEUE_CONFIG
): Date {
  const delayMs = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount),
    config.maxDelayMs
  );
  return new Date(Date.now() + delayMs);
}

/**
 * Mark a validation job as failed and schedule retry
 */
export async function scheduleRetry(
  jobId: string,
  errorMessage: string,
  errorCode?: string
): Promise<void> {
  const job = await prisma.uploadValidationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    logger.warn({ jobId }, 'Cannot schedule retry: job not found');
    return;
  }

  const newRetryCount = job.retryCount + 1;
  const shouldDeadLetter = newRetryCount >= job.maxRetries;

  const nextStatus: ValidationStatus = shouldDeadLetter ? 'DEAD_LETTER' : 'PENDING';
  const nextRunAt = shouldDeadLetter ? null : calculateNextRunAt(newRetryCount);

  await prisma.uploadValidationJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      retryCount: newRetryCount,
      nextRunAt,
      lastError: errorMessage,
      updatedAt: new Date(),
    },
  });

  // Log validation event
  await prisma.uploadValidationEvent.create({
    data: {
      jobId,
      eventType: shouldDeadLetter ? 'DEAD_LETTER' : 'RETRY_SCHEDULED',
      message: errorMessage,
      errorCode,
      metadata: {
        retryCount: newRetryCount,
        nextRunAt: nextRunAt?.toISOString(),
      },
    },
  });

  logger.info(
    {
      jobId,
      retryCount: newRetryCount,
      nextRunAt,
      status: nextStatus,
    },
    shouldDeadLetter ? 'Job moved to dead letter' : 'Job retry scheduled'
  );
}

/**
 * Mark a validation job as processing
 */
export async function markJobProcessing(jobId: string): Promise<void> {
  await prisma.uploadValidationJob.update({
    where: { id: jobId },
    data: {
      status: 'PROCESSING',
      updatedAt: new Date(),
    },
  });

  await prisma.uploadValidationEvent.create({
    data: {
      jobId,
      eventType: 'PROCESSING_STARTED',
      message: 'Validation job processing started',
    },
  });
}

/**
 * Mark a validation job as passed
 */
export async function markJobPassed(jobId: string, metadata?: Record<string, any>): Promise<void> {
  await prisma.uploadValidationJob.update({
    where: { id: jobId },
    data: {
      status: 'PASSED',
      updatedAt: new Date(),
    },
  });

  await prisma.uploadValidationEvent.create({
    data: {
      jobId,
      eventType: 'VALIDATION_PASSED',
      message: 'Upload validation passed all checks',
      metadata,
    },
  });

  logger.info({ jobId }, 'Validation job passed');
}

/**
 * Mark a validation job as failed (terminal state, no retry)
 */
export async function markJobFailed(
  jobId: string,
  errorMessage: string,
  errorCode?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await prisma.uploadValidationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      lastError: errorMessage,
      updatedAt: new Date(),
    },
  });

  await prisma.uploadValidationEvent.create({
    data: {
      jobId,
      eventType: 'VALIDATION_FAILED',
      message: errorMessage,
      errorCode,
      metadata,
    },
  });

  logger.warn({ jobId, errorCode }, 'Validation job failed');
}

/**
 * Fetch pending jobs ready to process
 */
export async function fetchPendingJobs(limit: number = 10): Promise<
  Array<{
    id: string;
    uploadAssetId: string;
    retryCount: number;
  }>
> {
  const jobs = await prisma.uploadValidationJob.findMany({
    where: {
      status: 'PENDING',
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      uploadAssetId: true,
      retryCount: true,
    },
  });

  return jobs;
}
