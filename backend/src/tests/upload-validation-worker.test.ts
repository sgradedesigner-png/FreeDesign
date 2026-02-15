import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { validateUploadAsset } from '../services/upload-validation.service';
import { calculateNextRunAt } from '../services/job-queue.service';

describe('Upload Validation Worker', () => {
  describe('validateUploadAsset', () => {
    it('should pass valid gang upload image', async () => {
      const result = await validateUploadAsset({
        cloudinaryPublicId: 'test-upload-123',
        mimeType: 'image/png',
        fileSizeBytes: 10 * 1024 * 1024, // 10MB
        uploadFamily: 'GANG_UPLOAD',
      });

      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail oversized gang upload', async () => {
      const result = await validateUploadAsset({
        cloudinaryPublicId: 'test-upload-oversized',
        mimeType: 'image/png',
        fileSizeBytes: 60 * 1024 * 1024, // 60MB (exceeds 50MB limit)
        uploadFamily: 'GANG_UPLOAD',
      });

      expect(result.passed).toBe(false);
      expect(result.errors).toContain('FILE_TOO_LARGE');
    });

    it('should fail invalid mime type', async () => {
      const result = await validateUploadAsset({
        cloudinaryPublicId: 'test-upload-invalid-mime',
        mimeType: 'application/zip',
        fileSizeBytes: 5 * 1024 * 1024,
        uploadFamily: 'GANG_UPLOAD',
      });

      expect(result.passed).toBe(false);
      expect(result.errors).toContain('UNSUPPORTED_FORMAT');
    });

    it('should pass valid UV gang upload', async () => {
      const result = await validateUploadAsset({
        cloudinaryPublicId: 'test-uv-upload',
        mimeType: 'image/jpeg',
        fileSizeBytes: 15 * 1024 * 1024,
        uploadFamily: 'UV_GANG_UPLOAD',
      });

      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should pass by-size upload', async () => {
      const result = await validateUploadAsset({
        cloudinaryPublicId: 'test-by-size',
        mimeType: 'image/png',
        fileSizeBytes: 8 * 1024 * 1024,
        uploadFamily: 'BY_SIZE',
      });

      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('calculateNextRunAt - Exponential Backoff', () => {
    it('should return 1 second delay for first retry', () => {
      const nextRun = calculateNextRunAt(0);
      const now = Date.now();
      const delay = nextRun.getTime() - now;

      expect(delay).toBeGreaterThanOrEqual(900); // ~1000ms with some tolerance
      expect(delay).toBeLessThanOrEqual(1100);
    });

    it('should return 2 second delay for second retry', () => {
      const nextRun = calculateNextRunAt(1);
      const now = Date.now();
      const delay = nextRun.getTime() - now;

      expect(delay).toBeGreaterThanOrEqual(1900); // ~2000ms
      expect(delay).toBeLessThanOrEqual(2100);
    });

    it('should return 4 second delay for third retry', () => {
      const nextRun = calculateNextRunAt(2);
      const now = Date.now();
      const delay = nextRun.getTime() - now;

      expect(delay).toBeGreaterThanOrEqual(3900); // ~4000ms
      expect(delay).toBeLessThanOrEqual(4100);
    });

    it('should cap at max delay', () => {
      const nextRun = calculateNextRunAt(20); // Very high retry count
      const now = Date.now();
      const delay = nextRun.getTime() - now;

      // Should cap at 5 minutes (300000ms)
      expect(delay).toBeLessThanOrEqual(300100);
    });
  });

  describe('Upload Asset Lifecycle', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create test user profile
      const profile = await prisma.profile.create({
        data: {
          id: 'test-user-validation',
          email: 'validation-test@example.com',
          name: 'Validation Test User',
        },
      });
      testUserId = profile.id;
    });

    it('should create upload asset with pending status', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-pending',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-pending.png',
          fileName: 'test-file.png',
          mimeType: 'image/png',
          fileSizeBytes: 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
          uploadFamily: 'GANG_UPLOAD',
        },
      });

      expect(upload.validationStatus).toBe('PENDING');
      expect(upload.moderationStatus).toBe('PENDING_REVIEW');
      expect(upload.uploadFamily).toBe('GANG_UPLOAD');
    });

    it('should create validation job for upload', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-job',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-job.png',
          fileName: 'job-test.png',
          mimeType: 'image/png',
          fileSizeBytes: 2 * 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      const job = await prisma.uploadValidationJob.create({
        data: {
          uploadAssetId: upload.id,
          status: 'PENDING',
          retryCount: 0,
          maxRetries: 3,
          nextRunAt: new Date(),
        },
      });

      expect(job.status).toBe('PENDING');
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
    });

    it('should update asset to PASSED after validation', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-pass',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-pass.png',
          fileName: 'pass-test.png',
          mimeType: 'image/png',
          fileSizeBytes: 3 * 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      // Simulate validation pass
      const updated = await prisma.uploadAsset.update({
        where: { id: upload.id },
        data: { validationStatus: 'PASSED' },
      });

      expect(updated.validationStatus).toBe('PASSED');
    });

    it('should update asset to FAILED with error message', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-fail',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-fail.png',
          fileName: 'fail-test.png',
          mimeType: 'image/png',
          fileSizeBytes: 4 * 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      const job = await prisma.uploadValidationJob.create({
        data: {
          uploadAssetId: upload.id,
          status: 'PENDING',
          retryCount: 0,
          lastError: 'File dimensions too small',
        },
      });

      // Simulate validation fail
      const [updatedAsset, updatedJob] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: upload.id },
          data: { validationStatus: 'FAILED' },
        }),
        prisma.uploadValidationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            lastError: 'FILE_TOO_SMALL: Minimum 1200px width required',
          },
        }),
      ]);

      expect(updatedAsset.validationStatus).toBe('FAILED');
      expect(updatedJob.status).toBe('FAILED');
      expect(updatedJob.lastError).toContain('FILE_TOO_SMALL');
    });

    it('should move to DEAD_LETTER after max retries', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-deadletter',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-deadletter.png',
          fileName: 'deadletter-test.png',
          mimeType: 'image/png',
          fileSizeBytes: 5 * 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      const job = await prisma.uploadValidationJob.create({
        data: {
          uploadAssetId: upload.id,
          status: 'PENDING',
          retryCount: 3,
          maxRetries: 3,
          lastError: 'Cloudinary API timeout',
        },
      });

      // Simulate dead letter transition
      const [updatedAsset, updatedJob] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: upload.id },
          data: { validationStatus: 'DEAD_LETTER' },
        }),
        prisma.uploadValidationJob.update({
          where: { id: job.id },
          data: { status: 'DEAD_LETTER' },
        }),
      ]);

      expect(updatedAsset.validationStatus).toBe('DEAD_LETTER');
      expect(updatedJob.status).toBe('DEAD_LETTER');
      expect(updatedJob.retryCount).toBe(3);
    });

    it('should create validation event for job', async () => {
      const upload = await prisma.uploadAsset.create({
        data: {
          ownerId: testUserId,
          cloudinaryPublicId: 'test-upload-event',
          cloudinaryUrl: 'https://res.cloudinary.com/test/test-upload-event.png',
          fileName: 'event-test.png',
          mimeType: 'image/png',
          fileSizeBytes: 6 * 1024 * 1024,
          validationStatus: 'PENDING',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      const job = await prisma.uploadValidationJob.create({
        data: {
          uploadAssetId: upload.id,
          status: 'PROCESSING',
        },
      });

      const event = await prisma.uploadValidationEvent.create({
        data: {
          jobId: job.id,
          eventType: 'started',
          message: 'Validation started',
        },
      });

      expect(event.eventType).toBe('started');
      expect(event.message).toBe('Validation started');
    });
  });
});
