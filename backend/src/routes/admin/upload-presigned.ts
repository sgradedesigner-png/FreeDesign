import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminGuard } from '../../supabaseauth';
import { logger } from '../../lib/logger';
import { generateSignedUploadParams } from '../../lib/cloudinary';
import { importRemoteImageToCloudinary } from '../../lib/remote-image-import';

const generatePresignedSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|avif|gif)$/),
  productId: z.string().optional(),
});

const importImageFromUrlSchema = z.object({
  imageUrl: z.string().url(),
  productId: z.string().min(1),
});

function sanitizeFilenameBase(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return sanitized || `asset-${Date.now()}`;
}

function detectViewToken(filename: string): 'front' | 'back' | 'left' | 'right' | null {
  const name = filename.toLowerCase();
  if (/(^|[^a-z])(front|frt)([^a-z]|$)/i.test(name)) return 'front';
  if (/(^|[^a-z])back([^a-z]|$)/i.test(name)) return 'back';
  if (/(^|[^a-z])(leftsleeve|left_sleeve|left-sleeve|leftside|left_side|left-side|left|ls)([^a-z]|$)/i.test(name)) return 'left';
  if (/(^|[^a-z])(rightsleeve|right_sleeve|right-sleeve|rightside|right_side|right-side|right|rs)([^a-z]|$)/i.test(name)) return 'right';
  return null;
}

export async function adminUploadPresignedRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.post('/presigned-url', async (request, reply) => {
    try {
      const body = generatePresignedSchema.parse(request.body);
      const productId = body.productId || `temp-${Date.now()}`;

      const folder = `products/${productId}`;
      const sanitizedBase = sanitizeFilenameBase(body.filename);
      const viewToken = detectViewToken(body.filename);
      const publicId = `${Date.now()}-${viewToken ? `${viewToken}-` : ''}${sanitizedBase}`;
      const signed = generateSignedUploadParams(folder, { publicId });

      const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`;
      const publicUrl = `https://res.cloudinary.com/${signed.cloudName}/image/upload/${signed.folder}/${publicId}`;

      logger.info(
        {
          folder: signed.folder,
          publicId,
          contentType: body.contentType,
        },
        '[Presigned Upload] Signed Cloudinary params generated'
      );

      return {
        uploadUrl,
        publicUrl,
        folder: signed.folder,
        publicId,
        timestamp: signed.timestamp,
        signature: signed.signature,
        apiKey: signed.apiKey,
        cloudName: signed.cloudName,
        // Backward-compatible field used by some older clients.
        key: `${signed.folder}/${publicId}`,
      };
    } catch (error) {
      logger.error({ error }, '[Presigned Upload] Failed to generate signed upload params');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      return reply.status(500).send({
        message: 'Failed to generate upload params',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/import-from-url', async (request, reply) => {
    try {
      const body = importImageFromUrlSchema.parse(request.body);
      const imported = await importRemoteImageToCloudinary({
        imageUrl: body.imageUrl,
        productId: body.productId,
      });

      return {
        publicUrl: imported.publicUrl,
        filename: imported.filename,
        size: imported.size,
        contentType: imported.contentType,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      const message = error instanceof Error ? error.message : 'Failed to import image URL';
      const statusCode =
        message.includes('Unsupported remote image type') ||
        message.includes('Only http/https') ||
        message.includes('download image') ||
        message.includes('size limit') ||
        message.includes('empty')
          ? 400
          : 500;

      return reply.status(statusCode).send({
        message: 'Failed to import image URL',
        error: message,
      });
    }
  });
}
