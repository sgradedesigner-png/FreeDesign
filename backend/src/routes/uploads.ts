import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger, hashIdentifier } from '../lib/logger';
import cloudinary, { generateSignedUploadParams, getThumbnailUrl } from '../lib/cloudinary';
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

const signSchema = z.object({
  purpose: z.literal('CUSTOMIZATION_DESIGN').default('CUSTOMIZATION_DESIGN'),
  filename: z.string().min(1).max(240),
  contentType: z.string().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().min(1),
});

const completeSchema = z.object({
  intentId: z.string().uuid(),
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

          return tx.customizationAsset.create({
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
}

