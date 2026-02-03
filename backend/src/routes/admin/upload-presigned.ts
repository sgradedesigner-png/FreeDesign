import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { generateProductImageUploadUrl } from '../../lib/r2-presigned';
import { z } from 'zod';

const generatePresignedSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|avif|gif)$/),
  productId: z.string().optional(),
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
}
