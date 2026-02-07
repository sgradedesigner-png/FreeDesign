import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { generateProductImageUploadUrl } from '../../lib/r2-presigned';
import { importRemoteImageToR2 } from '../../lib/remote-image-import';
import { z } from 'zod';

const generatePresignedSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|avif|gif)$/),
  productId: z.string().optional(),
});

const importImageFromUrlSchema = z.object({
  imageUrl: z.string().url(),
  productId: z.string().min(1),
});

export async function adminUploadPresignedRoutes(app: FastifyInstance) {
  // 🔐 Admin guard
  app.addHook('preHandler', adminGuard);

  // 📝 Generate presigned URL for product image upload
  app.post('/presigned-url', async (request, reply) => {
    console.log('\n[Presigned Upload] ========== GENERATE PRESIGNED URL ==========');

    try {
      const body = generatePresignedSchema.parse(request.body);

      console.log('[Presigned Upload] Request:', {
        filename: body.filename,
        contentType: body.contentType,
        productId: body.productId,
      });

      const productId = body.productId || `temp-${Date.now()}`;

      console.log('[Presigned Upload] Generating presigned URL...');

      const result = await generateProductImageUploadUrl(
        productId,
        body.filename,
        body.contentType
      );

      console.log('[Presigned Upload] ✅ Presigned URL generated successfully');
      console.log('[Presigned Upload] Public URL:', result.publicUrl);

      return {
        uploadUrl: result.uploadUrl,
        publicUrl: result.publicUrl,
        key: result.key,
      };
    } catch (error) {
      console.error('[Presigned Upload] ❌ Failed to generate presigned URL');
      console.error('[Presigned Upload] Error:', error);

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      return reply.status(500).send({
        message: 'Failed to generate upload URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      console.log('[Presigned Upload] ========== REQUEST COMPLETE ==========\n');
    }
  });

  // Import an external image URL and persist it in R2
  app.post('/import-from-url', async (request, reply) => {
    try {
      const body = importImageFromUrlSchema.parse(request.body);
      const imported = await importRemoteImageToR2({
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
