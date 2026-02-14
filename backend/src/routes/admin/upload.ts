import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { logger } from '../../lib/logger';
import { uploadProductImage } from '../../lib/cloudinary';

export async function adminUploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.post('/product-image', async (request, reply) => {
    logger.info({ headers: request.headers }, '[Upload Route] New upload request');

    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        });
      }

      const maxSize = 5 * 1024 * 1024;
      const buffer = await data.toBuffer();

      if (buffer.length > maxSize) {
        return reply.status(400).send({
          message: 'File too large. Maximum size is 5MB.',
        });
      }

      const productId =
        request.query && typeof request.query === 'object' && 'productId' in request.query
          ? String(request.query.productId)
          : `temp-${Date.now()}`;

      const originalFilename = data.filename;
      const filename = `${Date.now()}-${originalFilename}`;

      const url = await uploadProductImage(productId, buffer, filename, data.mimetype);

      return {
        url,
        filename,
        size: buffer.length,
        mimeType: data.mimetype,
      };
    } catch (error) {
      logger.error({ error }, '[Upload Route] Upload failed');

      return reply.status(500).send({
        message: 'Failed to upload image',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/product-images', async (request, reply) => {
    try {
      const files = await request.saveRequestFiles();

      if (!files || files.length === 0) {
        return reply.status(400).send({ message: 'No files uploaded' });
      }

      const productId =
        request.query && typeof request.query === 'object' && 'productId' in request.query
          ? String(request.query.productId)
          : `temp-${Date.now()}`;

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          continue;
        }

        const fs = await import('fs/promises');
        const buffer = await fs.readFile(file.filepath);

        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          continue;
        }

        const filename = `${Date.now()}-${file.filename}`;
        const url = await uploadProductImage(productId, buffer, filename, file.mimetype);
        uploadedUrls.push(url);
      }

      return {
        urls: uploadedUrls,
        count: uploadedUrls.length,
      };
    } catch (error) {
      logger.error({ error }, '[Upload Route] Batch upload failed');

      return reply.status(500).send({
        message: 'Failed to upload images',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
