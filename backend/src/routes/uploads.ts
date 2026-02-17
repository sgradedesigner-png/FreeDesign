import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger, hashIdentifier } from '../lib/logger';
import cloudinary, {
  generateSignedUploadParams,
  generateUploadSignature,
  getUploadAssetMetadata,
  getThumbnailUrl,
  isValidUploadFamily,
} from '../lib/cloudinary';
import { userGuard } from '../middleware/userGuard';

const SIGNED_UPLOAD_TTL_SEC = Number(process.env.CLOUDINARY_SIGNATURE_TTL_SEC || 300);

const CUSTOMIZATION_ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

const CUSTOMIZATION_MAX_BYTES = 20 * 1024 * 1024;
const CUSTOMIZATION_MIN_RASTER_DIMENSION_PX = 800;

// Phase 2: Upload family-specific constraints
const UPLOAD_FAMILY_CONSTRAINTS: Record<
  string,
  {
    allowedMimeTypes: Set<string>;
    maxBytes: number;
    minDpi?: number;
    minWidthPx?: number;
    minHeightPx?: number;
  }
> = {
  gang_upload: {
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/pdf']),
    maxBytes: 50 * 1024 * 1024, // 50MB
    minDpi: 150,
    minWidthPx: 1200,
  },
  uv_gang_upload: {
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/pdf']),
    maxBytes: 50 * 1024 * 1024,
    minDpi: 150,
    minWidthPx: 1200,
  },
  by_size: {
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024, // 20MB
    minWidthPx: 800,
    minHeightPx: 800,
  },
  uv_by_size: {
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024,
    minWidthPx: 800,
    minHeightPx: 800,
  },
  blanks: {
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024,
    minWidthPx: 800,
    minHeightPx: 800,
  },
};

const signSchema = z.object({
  purpose: z.literal('CUSTOMIZATION_DESIGN').default('CUSTOMIZATION_DESIGN'),
  filename: z.string().min(1).max(240),
  contentType: z.string().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().min(1),
  uploadFamily: z
    .enum(['gang_upload', 'uv_gang_upload', 'by_size', 'uv_by_size', 'blanks'])
    .optional(), // Phase 2: upload family context
});

const completeSchema = z.object({
  intentId: z.string().uuid(),
  cloudinaryPublicId: z.string().optional(), // Phase 2: for new upload flow
  uploadFamily: z
    .enum(['gang_upload', 'uv_gang_upload', 'by_size', 'uv_by_size', 'blanks'])
    .optional(), // Phase 2: carry family context from sign to complete
});

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFilenameBase(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const sanitized = sanitizeFilename(withoutExt).toLowerCase();
  return sanitized || 'asset';
}

function isSvg(contentType: string): boolean {
  return contentType.trim().toLowerCase() === 'image/svg+xml';
}

export default async function uploadRoutes(app: FastifyInstance) {
  // Signed upload intent -> Cloudinary direct upload -> completion.

  app.post(
    '/api/uploads/sign',
    {
      preHandler: [userGuard],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id as string | undefined;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        const body = signSchema.parse(request.body);
        const contentType = body.contentType.trim().toLowerCase();

        if (body.purpose !== 'CUSTOMIZATION_DESIGN') {
          return reply.status(400).send({ error: 'Unsupported upload purpose' });
        }

        if (!CUSTOMIZATION_ALLOWED_MIME.has(contentType)) {
          return reply.status(400).send({ error: 'Unsupported file type' });
        }

        if (body.fileSizeBytes > CUSTOMIZATION_MAX_BYTES) {
          return reply.status(400).send({ error: 'File exceeds size limit' });
        }

        const expiresAt = new Date(Date.now() + SIGNED_UPLOAD_TTL_SEC * 1000);

        const folder = `uploads/${userId}/customization`;
        const publicId = `${crypto.randomUUID()}-${sanitizeFilenameBase(body.filename)}`;

        const intent = await prisma.uploadIntent.create({
          data: {
            userId,
            purpose: 'CUSTOMIZATION_DESIGN',
            folder,
            publicId,
            contentType,
            originalFilename: body.filename,
            requestedFileSizeBytes: body.fileSizeBytes,
            maxBytes: CUSTOMIZATION_MAX_BYTES,
            expiresAt,
            usedAt: null,
          },
          select: {
            id: true,
            expiresAt: true,
          },
        });

        const signed = generateSignedUploadParams(folder, { publicId });
        const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`;

        logger.info(
          {
            context: 'uploads.sign',
            requestId: request.id,
            userIdHash: hashIdentifier(userId) ?? undefined,
            purpose: body.purpose,
            folder,
            intentId: intent.id,
          },
          'Signed upload intent created'
        );

        return reply.send({
          intentId: intent.id,
          expiresAt: intent.expiresAt,
          uploadUrl,
          fields: {
            apiKey: signed.apiKey,
            timestamp: signed.timestamp,
            signature: signed.signature,
            folder: signed.folder,
            publicId,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid request', details: error.issues });
        }

        logger.error({ error }, 'Failed to create signed upload intent');
        return reply.status(500).send({ error: 'Failed to create upload intent' });
      }
    }
  );

  app.post(
    '/api/uploads/complete',
    {
      preHandler: [userGuard],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id as string | undefined;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        const body = completeSchema.parse(request.body);

        const intent = await prisma.uploadIntent.findFirst({
          where: {
            id: body.intentId,
            userId,
          },
        });

        if (!intent) {
          return reply.status(404).send({ error: 'Upload intent not found' });
        }

        if (intent.usedAt) {
          return reply.status(409).send({ error: 'Upload intent already used' });
        }

        if (intent.expiresAt.getTime() < Date.now()) {
          return reply.status(410).send({ error: 'Upload intent expired' });
        }

        const fullPublicId = `${intent.folder}/${intent.publicId}`;

        let resource: any;
        try {
          resource = await (cloudinary as any).api.resource(fullPublicId, {
            resource_type: 'image',
          });
        } catch (cloudErr: any) {
          logger.warn({ cloudErr, fullPublicId }, 'Cloudinary resource lookup failed');
          return reply.status(400).send({ error: 'Uploaded file not found or not ready' });
        }

        const secureUrl: string | undefined = resource?.secure_url;
        const bytes: number = Number(resource?.bytes || 0);
        const widthPx: number | null = Number.isFinite(resource?.width) ? Number(resource.width) : null;
        const heightPx: number | null = Number.isFinite(resource?.height) ? Number(resource.height) : null;
        const publicIdFromCloud: string | undefined = resource?.public_id;

        if (!secureUrl || !publicIdFromCloud) {
          return reply.status(400).send({ error: 'Invalid Cloudinary response' });
        }

        if (publicIdFromCloud !== fullPublicId) {
          return reply.status(400).send({ error: 'Upload scope mismatch' });
        }

        if (bytes <= 0) {
          return reply.status(400).send({ error: 'Uploaded file is empty' });
        }

        if (bytes > intent.maxBytes) {
          return reply.status(400).send({ error: 'Uploaded file exceeds size limit' });
        }

        const passesRasterValidation = isSvg(intent.contentType)
          ? true
          : Boolean(
              widthPx &&
                heightPx &&
                widthPx >= CUSTOMIZATION_MIN_RASTER_DIMENSION_PX &&
                heightPx >= CUSTOMIZATION_MIN_RASTER_DIMENSION_PX
            );

        const safeFilename = sanitizeFilename(intent.originalFilename) || `design-${Date.now()}`;
        const thumbnailUrl = getThumbnailUrl(secureUrl, 200);

        // Phase 2: Create both CustomizationAsset (legacy) and UploadAsset (new)
        const asset = await prisma.$transaction(async (tx) => {
          const claimed = await tx.uploadIntent.updateMany({
            where: {
              id: intent.id,
              userId,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: {
              usedAt: new Date(),
            },
          });

          if (claimed.count !== 1) {
            throw new Error('Upload intent already used or expired');
          }

          // Legacy: Create CustomizationAsset for backward compatibility
          const legacyAsset = await tx.customizationAsset.create({
            data: {
              userId,
              originalUrl: secureUrl,
              thumbnailUrl,
              cloudinaryId: publicIdFromCloud,
              fileName: safeFilename,
              mimeType: intent.contentType,
              fileSizeBytes: bytes,
              widthPx,
              heightPx,
              dpi: null,
              isValid: passesRasterValidation,
            },
          });

          // Phase 2: Create UploadAsset for new upload lifecycle
          const uploadAsset = await tx.uploadAsset.create({
            data: {
              ownerId: userId,
              cloudinaryPublicId: publicIdFromCloud,
              cloudinaryUrl: secureUrl,
              thumbnailUrl,
              fileName: safeFilename,
              mimeType: intent.contentType,
              fileSizeBytes: bytes,
              widthPx,
              heightPx,
              dpi: null,
              validationStatus: passesRasterValidation ? 'PASSED' : 'PENDING',
              moderationStatus: 'PENDING_REVIEW',
              // uploadFamily will be set when linking to cart/order // Will be set when linking to cart/order
              // metadata will be populated during validation
            },
          });

          // Phase 2: Create validation job if not immediately passed
          if (!passesRasterValidation) {
            await tx.uploadValidationJob.create({
              data: {
                uploadAssetId: uploadAsset.id,
                status: 'PENDING',
                retryCount: 0,
                maxRetries: 3,
                nextRunAt: new Date(), // Process immediately
              },
            });
          }

          return legacyAsset; // Return legacy for backward compatibility
        });

        logger.info(
          {
            event: 'upload_validated',
            context: 'uploads.complete',
            requestId: request.id,
            userIdHash: hashIdentifier(userId) ?? undefined,
            intentId: intent.id,
            assetId: asset.id,
            bytes,
            widthPx,
            heightPx,
            isValid: asset.isValid,
          },
          'Signed upload completed'
        );

        return reply.code(201).send({
          asset: {
            id: asset.id,
            originalUrl: asset.originalUrl,
            thumbnailUrl: asset.thumbnailUrl,
            cloudinaryId: asset.cloudinaryId,
            widthPx: asset.widthPx,
            heightPx: asset.heightPx,
            dpi: asset.dpi,
            isValid: asset.isValid,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            fileSizeBytes: asset.fileSizeBytes,
            createdAt: asset.createdAt,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid request', details: error.issues });
        }

        logger.error({ error }, 'Failed to complete signed upload');
        return reply.status(500).send({ error: 'Failed to complete upload' });
      }
    }
  );

  // ============================================
  // Phase 2: Upload Lifecycle Endpoints
  // ============================================

  /**
   * POST /api/uploads/sign-v2
   * Phase 2: Sign upload with family context for validation constraints
   */
  app.post(
    '/api/uploads/sign-v2',
    {
      preHandler: [userGuard],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id as string | undefined;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        const body = signSchema.parse(request.body);
        const uploadFamily = body.uploadFamily;

        if (!uploadFamily) {
          return reply.status(400).send({ error: 'uploadFamily is required for Phase 2 uploads' });
        }

        if (!isValidUploadFamily(uploadFamily)) {
          return reply.status(400).send({ error: 'Invalid upload family' });
        }

        const constraints = UPLOAD_FAMILY_CONSTRAINTS[uploadFamily];
        const contentType = body.contentType.trim().toLowerCase();

        if (!constraints.allowedMimeTypes.has(contentType)) {
          return reply.status(400).send({
            error: 'Unsupported file type for this upload family',
            allowedTypes: Array.from(constraints.allowedMimeTypes),
          });
        }

        if (body.fileSizeBytes > constraints.maxBytes) {
          return reply.status(400).send({
            error: 'File exceeds size limit',
            maxBytes: constraints.maxBytes,
          });
        }

        const expiresAt = new Date(Date.now() + SIGNED_UPLOAD_TTL_SEC * 1000);

        const signedParams = generateUploadSignature({
          userId,
          uploadFamily,
          fileName: body.filename,
          maxFileSizeBytes: constraints.maxBytes,
        });

        // Create upload intent for tracking
        const intent = await prisma.uploadIntent.create({
          data: {
            userId,
            purpose: 'CUSTOMIZATION_DESIGN', // Reuse existing enum
            folder: signedParams.folder,
            publicId: signedParams.publicId,
            contentType,
            originalFilename: body.filename,
            requestedFileSizeBytes: body.fileSizeBytes,
            maxBytes: constraints.maxBytes,
            expiresAt,
            usedAt: null,
          },
          select: {
            id: true,
            expiresAt: true,
          },
        });

        const uploadUrl = `https://api.cloudinary.com/v1_1/${signedParams.cloudName}/image/upload`;

        logger.info(
          {
            context: 'uploads.sign-v2',
            requestId: request.id,
            userIdHash: hashIdentifier(userId) ?? undefined,
            uploadFamily,
            intentId: intent.id,
          },
          'Phase 2 signed upload intent created'
        );

        return reply.send({
          intentId: intent.id,
          expiresAt: intent.expiresAt,
          uploadUrl,
          uploadFamily,
          constraints: {
            maxBytes: constraints.maxBytes,
            minDpi: constraints.minDpi,
            minWidthPx: constraints.minWidthPx,
            minHeightPx: constraints.minHeightPx,
          },
          fields: {
            apiKey: signedParams.apiKey,
            timestamp: signedParams.timestamp,
            signature: signedParams.signature,
            folder: signedParams.folder,
            publicId: signedParams.publicId,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid request', details: error.issues });
        }

        logger.error({ error }, 'Failed to create Phase 2 signed upload intent');
        return reply.status(500).send({ error: 'Failed to create upload intent' });
      }
    }
  );

  /**
   * POST /api/uploads/complete-v2
   * Phase 2: Complete upload and create UploadAsset with validation job
   */
  app.post(
    '/api/uploads/complete-v2',
    {
      preHandler: [userGuard],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id as string | undefined;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        const body = completeSchema.parse(request.body);

        const intent = await prisma.uploadIntent.findFirst({
          where: {
            id: body.intentId,
            userId,
          },
        });

        if (!intent) {
          return reply.status(404).send({ error: 'Upload intent not found' });
        }

        if (intent.usedAt) {
          return reply.status(409).send({ error: 'Upload intent already used' });
        }

        if (intent.expiresAt.getTime() < Date.now()) {
          return reply.status(410).send({ error: 'Upload intent expired' });
        }

        const fullPublicId = `${intent.folder}/${intent.publicId}`;

        // Retrieve upload metadata from Cloudinary
        let metadata: Awaited<ReturnType<typeof getUploadAssetMetadata>>;
        try {
          metadata = await getUploadAssetMetadata(fullPublicId);
        } catch (cloudErr: any) {
          logger.warn({ cloudErr, fullPublicId }, 'Cloudinary resource lookup failed');
          return reply.status(400).send({ error: 'Uploaded file not found or not ready' });
        }

        if (metadata.bytes <= 0) {
          return reply.status(400).send({ error: 'Uploaded file is empty' });
        }

        if (metadata.bytes > intent.maxBytes) {
          return reply.status(400).send({ error: 'Uploaded file exceeds size limit' });
        }

        const thumbnailUrl = getThumbnailUrl(metadata.url, 200);
        const safeFilename = sanitizeFilename(intent.originalFilename) || `upload-${Date.now()}`;

        // Create UploadAsset and validation job
        const { uploadAsset, validationJob } = await prisma.$transaction(async (tx) => {
          const claimed = await tx.uploadIntent.updateMany({
            where: {
              id: intent.id,
              userId,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: {
              usedAt: new Date(),
            },
          });

          if (claimed.count !== 1) {
            throw new Error('Upload intent already used or expired');
          }

          const uploadAsset = await tx.uploadAsset.create({
            data: {
              ownerId: userId,
              cloudinaryPublicId: fullPublicId,
              cloudinaryUrl: metadata.url,
              thumbnailUrl,
              fileName: safeFilename,
              mimeType: intent.contentType,
              fileSizeBytes: metadata.bytes,
              widthPx: metadata.width,
              heightPx: metadata.height,
              dpi: null, // Will be determined by validation worker
              validationStatus: 'PENDING',
              moderationStatus: 'PENDING_REVIEW',
              uploadFamily: body.uploadFamily
                ? (body.uploadFamily.toUpperCase() as any)
                : null,
              metadata: {
                format: metadata.format,
                resourceType: metadata.resourceType,
              },
            },
          });

          const validationJob = await tx.uploadValidationJob.create({
            data: {
              uploadAssetId: uploadAsset.id,
              status: 'PENDING',
              retryCount: 0,
              maxRetries: 3,
              nextRunAt: new Date(), // Process immediately
            },
          });

          await tx.uploadValidationEvent.create({
            data: {
              jobId: validationJob.id,
              eventType: 'started',
              message: 'Upload validation queued',
              metadata: {
                widthPx: metadata.width,
                heightPx: metadata.height,
                bytes: metadata.bytes,
              },
            },
          });

          return { uploadAsset, validationJob };
        });

        logger.info(
          {
            event: 'phase2_upload_completed',
            context: 'uploads.complete-v2',
            requestId: request.id,
            userIdHash: hashIdentifier(userId) ?? undefined,
            intentId: intent.id,
            uploadAssetId: uploadAsset.id,
            validationJobId: validationJob.id,
            bytes: metadata.bytes,
          },
          'Phase 2 upload completed and validation queued'
        );

        return reply.code(201).send({
          uploadAsset: {
            id: uploadAsset.id,
            cloudinaryUrl: uploadAsset.cloudinaryUrl,
            thumbnailUrl: uploadAsset.thumbnailUrl,
            fileName: uploadAsset.fileName,
            mimeType: uploadAsset.mimeType,
            fileSizeBytes: uploadAsset.fileSizeBytes,
            widthPx: uploadAsset.widthPx,
            heightPx: uploadAsset.heightPx,
            validationStatus: uploadAsset.validationStatus,
            moderationStatus: uploadAsset.moderationStatus,
            createdAt: uploadAsset.createdAt,
          },
          validationJob: {
            id: validationJob.id,
            status: validationJob.status,
          },
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid request', details: error.issues });
        }

        logger.error({ error }, 'Failed to complete Phase 2 upload');
        return reply.status(500).send({ error: 'Failed to complete upload' });
      }
    }
  );

  // Phase 2: GET /api/uploads/assets/:assetId - Get upload asset status
  app.get<{ Params: { assetId: string } }>(
    '/api/uploads/assets/:assetId',
    { preHandler: userGuard },
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id as string | undefined;
        const { assetId } = request.params;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Fetch upload asset
        const uploadAsset = await prisma.uploadAsset.findUnique({
          where: { id: assetId },
        });

        if (!uploadAsset) {
          return reply.status(404).send({ error: 'Upload asset not found' });
        }

        // Verify ownership
        if (uploadAsset.ownerId !== userId) {
          return reply.status(403).send({ error: 'Access denied' });
        }

        return reply.send({
          id: uploadAsset.id,
          cloudinaryUrl: uploadAsset.cloudinaryUrl,
          thumbnailUrl: uploadAsset.thumbnailUrl,
          fileName: uploadAsset.fileName,
          mimeType: uploadAsset.mimeType,
          fileSizeBytes: uploadAsset.fileSizeBytes,
          widthPx: uploadAsset.widthPx,
          heightPx: uploadAsset.heightPx,
          dpi: uploadAsset.dpi,
          validationStatus: uploadAsset.validationStatus,
          moderationStatus: uploadAsset.moderationStatus,
          uploadFamily: uploadAsset.uploadFamily,
          metadata: uploadAsset.metadata,
          createdAt: uploadAsset.createdAt,
          updatedAt: uploadAsset.updatedAt,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get upload asset');
        return reply.status(500).send({ error: 'Failed to get upload asset' });
      }
    }
  );
}

