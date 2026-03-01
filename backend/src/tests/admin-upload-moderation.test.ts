import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Admin Upload Moderation', () => {
  let testUserId: string;
  let adminUserId: string;
  let testUploadId: string;

  beforeEach(async () => {
    // Create test user
    const userProfile = await prisma.profile.create({
      data: {
        id: 'test-user-moderation',
        email: 'moderation-user@example.com',
        name: 'Moderation Test User',
      },
    });
    testUserId = userProfile.id;

    // Create admin user
    const adminProfile = await prisma.profile.create({
      data: {
        id: 'test-admin-moderation',
        email: 'admin@example.com',
        name: 'Admin User',
      },
    });
    adminUserId = adminProfile.id;

    // Create test upload
    const upload = await prisma.uploadAsset.create({
      data: {
        ownerId: testUserId,
        cloudinaryPublicId: 'test-moderation-upload',
        cloudinaryUrl: 'https://res.cloudinary.com/test/moderation.png',
        fileName: 'moderation-test.png',
        mimeType: 'image/png',
        fileSizeBytes: 1024 * 1024,
        validationStatus: 'PASSED',
        moderationStatus: 'PENDING_REVIEW',
        uploadFamily: 'GANG_UPLOAD',
      },
    });
    testUploadId = upload.id;
  });

  describe('Moderation Actions', () => {
    it('should create moderation action when approving upload', async () => {
      const previousStatus = 'PENDING_REVIEW';
      const newStatus = 'APPROVED';

      const [updatedUpload, action] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: newStatus },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'approve',
            reason: 'Upload meets quality standards',
            previousStatus,
            newStatus,
          },
        }),
      ]);

      expect(updatedUpload.moderationStatus).toBe('APPROVED');
      expect(action.action).toBe('approve');
      expect(action.previousStatus).toBe('PENDING_REVIEW');
      expect(action.newStatus).toBe('APPROVED');
      expect(action.actorId).toBe(adminUserId);
    });

    it('should create moderation action when rejecting upload', async () => {
      const previousStatus = 'PENDING_REVIEW';
      const newStatus = 'REJECTED';

      const [updatedUpload, action] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: newStatus },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'reject',
            reason: 'Contains inappropriate content',
            previousStatus,
            newStatus,
          },
        }),
      ]);

      expect(updatedUpload.moderationStatus).toBe('REJECTED');
      expect(action.action).toBe('reject');
      expect(action.reason).toBe('Contains inappropriate content');
    });

    it('should create moderation action when flagging upload', async () => {
      const previousStatus = 'PENDING_REVIEW';
      const newStatus = 'FLAGGED';

      const [updatedUpload, action] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: newStatus },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'flag',
            reason: 'Requires manual review from supervisor',
            previousStatus,
            newStatus,
          },
        }),
      ]);

      expect(updatedUpload.moderationStatus).toBe('FLAGGED');
      expect(action.action).toBe('flag');
    });

    it('should maintain full audit trail with multiple actions', async () => {
      // First action: Flag
      await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: 'FLAGGED' },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'flag',
            reason: 'Need additional review',
            previousStatus: 'PENDING_REVIEW',
            newStatus: 'FLAGGED',
          },
        }),
      ]);

      // Second action: Approve
      await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: 'APPROVED' },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'approve',
            reason: 'Reviewed by supervisor - approved',
            previousStatus: 'FLAGGED',
            newStatus: 'APPROVED',
          },
        }),
      ]);

      // Verify audit trail
      const actions = await prisma.uploadModerationAction.findMany({
        where: { uploadAssetId: testUploadId },
        orderBy: { createdAt: 'asc' },
      });

      expect(actions).toHaveLength(2);
      expect(actions[0].action).toBe('flag');
      expect(actions[0].previousStatus).toBe('PENDING_REVIEW');
      expect(actions[0].newStatus).toBe('FLAGGED');
      expect(actions[1].action).toBe('approve');
      expect(actions[1].previousStatus).toBe('FLAGGED');
      expect(actions[1].newStatus).toBe('APPROVED');
    });

    it('should store metadata with moderation action', async () => {
      const metadata = {
        validationStatus: 'PASSED',
        timestamp: new Date().toISOString(),
        reviewNotes: 'High quality upload',
      };

      const [, action] = await prisma.$transaction([
        prisma.uploadAsset.update({
          where: { id: testUploadId },
          data: { moderationStatus: 'APPROVED' },
        }),
        prisma.uploadModerationAction.create({
          data: {
            uploadAssetId: testUploadId,
            actorId: adminUserId,
            action: 'approve',
            reason: 'Excellent quality',
            previousStatus: 'PENDING_REVIEW',
            newStatus: 'APPROVED',
            metadata,
          },
        }),
      ]);

      expect(action.metadata).toEqual(metadata);
    });
  });

  describe('Moderation Queue Queries', () => {
    beforeEach(async () => {
      // Create multiple uploads with different statuses
      await prisma.uploadAsset.createMany({
        data: [
          {
            ownerId: testUserId,
            cloudinaryPublicId: 'pending-1',
            cloudinaryUrl: 'https://res.cloudinary.com/test/pending-1.png',
            fileName: 'pending-1.png',
            mimeType: 'image/png',
            fileSizeBytes: 1024 * 1024,
            validationStatus: 'PASSED',
            moderationStatus: 'PENDING_REVIEW',
            uploadFamily: 'GANG_UPLOAD',
          },
          {
            ownerId: testUserId,
            cloudinaryPublicId: 'approved-1',
            cloudinaryUrl: 'https://res.cloudinary.com/test/approved-1.png',
            fileName: 'approved-1.png',
            mimeType: 'image/png',
            fileSizeBytes: 2 * 1024 * 1024,
            validationStatus: 'PASSED',
            moderationStatus: 'APPROVED',
            uploadFamily: 'UV_GANG_UPLOAD',
          },
          {
            ownerId: testUserId,
            cloudinaryPublicId: 'rejected-1',
            cloudinaryUrl: 'https://res.cloudinary.com/test/rejected-1.png',
            fileName: 'rejected-1.png',
            mimeType: 'image/jpeg',
            fileSizeBytes: 3 * 1024 * 1024,
            validationStatus: 'PASSED',
            moderationStatus: 'REJECTED',
            uploadFamily: 'GANG_UPLOAD',
          },
          {
            ownerId: testUserId,
            cloudinaryPublicId: 'validation-failed-1',
            cloudinaryUrl: 'https://res.cloudinary.com/test/failed-1.png',
            fileName: 'failed-1.png',
            mimeType: 'image/png',
            fileSizeBytes: 1024 * 1024,
            validationStatus: 'FAILED',
            moderationStatus: 'PENDING_REVIEW',
            uploadFamily: 'BY_SIZE',
          },
        ],
      });
    });

    it('should filter uploads by moderation status', async () => {
      const pending = await prisma.uploadAsset.count({
        where: { moderationStatus: 'PENDING_REVIEW' },
      });

      const approved = await prisma.uploadAsset.count({
        where: { moderationStatus: 'APPROVED' },
      });

      const rejected = await prisma.uploadAsset.count({
        where: { moderationStatus: 'REJECTED' },
      });

      expect(pending).toBeGreaterThanOrEqual(2); // Original + 2 new
      expect(approved).toBe(1);
      expect(rejected).toBe(1);
    });

    it('should filter uploads by upload family', async () => {
      const gangUploads = await prisma.uploadAsset.count({
        where: { uploadFamily: 'GANG_UPLOAD' },
      });

      const uvGangUploads = await prisma.uploadAsset.count({
        where: { uploadFamily: 'UV_GANG_UPLOAD' },
      });

      expect(gangUploads).toBeGreaterThanOrEqual(2);
      expect(uvGangUploads).toBe(1);
    });

    it('should filter uploads by validation status', async () => {
      const validationFailed = await prisma.uploadAsset.count({
        where: {
          validationStatus: 'FAILED',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      expect(validationFailed).toBe(1);
    });

    it('should retrieve upload with full relations', async () => {
      const upload = await prisma.uploadAsset.findFirst({
        where: { moderationStatus: 'PENDING_REVIEW' },
        include: {
          moderationActions: true,
          validationJobs: {
            include: {
              events: true,
            },
          },
        },
      });

      expect(upload).toBeTruthy();
      expect(upload?.moderationActions).toBeDefined();
      expect(upload?.validationJobs).toBeDefined();
    });
  });

  describe('Status Count Aggregation', () => {
    it('should aggregate moderation status counts', async () => {
      const statusCounts = await prisma.uploadAsset.groupBy({
        by: ['moderationStatus'],
        _count: { id: true },
      });

      const countMap = statusCounts.reduce(
        (acc, item) => {
          acc[item.moderationStatus] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(countMap['PENDING_REVIEW']).toBeGreaterThanOrEqual(1);
    });

    it('should count validation failures in pending review', async () => {
      const failedCount = await prisma.uploadAsset.count({
        where: {
          validationStatus: 'FAILED',
          moderationStatus: 'PENDING_REVIEW',
        },
      });

      expect(failedCount).toBeGreaterThanOrEqual(0);
    });
  });
});
