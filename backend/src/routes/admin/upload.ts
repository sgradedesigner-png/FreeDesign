import { logger } from '../lib/logger';
import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../supabaseauth';
import { uploadProductImage } from '../../lib/r2';
import { z } from 'zod';

export async function adminUploadRoutes(app: FastifyInstance) {
  // 🔐 Admin guard
  app.addHook('preHandler', adminGuard);

  // 📤 Upload product image
  app.post('/product-image', async (request, reply) => {
    logger.info('\n[Upload Route] ========== NEW UPLOAD REQUEST ==========');
    logger.info('[Upload Route] Headers:', JSON.stringify(request.headers, null, 2));

    try {
      // Get the uploaded file using multipart
      logger.info('[Upload Route] Parsing multipart file...');
      const data = await request.file();

      if (!data) {
        logger.info('[Upload Route] ❌ No file uploaded');
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      logger.info('[Upload Route] File received:');
      logger.info('[Upload Route]   - Filename:', data.filename);
      logger.info('[Upload Route]   - MIME type:', data.mimetype);
      logger.info('[Upload Route]   - Encoding:', data.encoding);

      // Validate file type (images only)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        logger.info('[Upload Route] ❌ Invalid file type:', data.mimetype);
        return reply.status(400).send({
          message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      logger.info('[Upload Route] Converting to buffer...');
      const buffer = await data.toBuffer();
      logger.info('[Upload Route] Buffer size:', buffer.length, 'bytes');

      if (buffer.length > maxSize) {
        logger.info('[Upload Route] ❌ File too large:', buffer.length, '>', maxSize);
        return reply.status(400).send({
          message: 'File too large. Maximum size is 5MB.',
        });
      }

      // Get productId from query or generate temporary ID
      const productId = request.query && typeof request.query === 'object' && 'productId' in request.query
        ? String(request.query.productId)
        : `temp-${Date.now()}`;

      logger.info('[Upload Route] Product ID:', productId);

      // Get filename
      const originalFilename = data.filename;
      const ext = originalFilename.split('.').pop() || 'webp';
      const timestamp = Date.now();
      const filename = `${timestamp}-${originalFilename}`;

      logger.info('[Upload Route] Generated filename:', filename);
      logger.info('[Upload Route] Extension:', ext);

      // Upload to R2
      logger.info('[Upload Route] Calling uploadProductImage...');
      const url = await uploadProductImage(
        productId,
        buffer,
        filename,
        data.mimetype
      );

      logger.info('[Upload Route] ✅ Upload successful!');
      logger.info('[Upload Route] URL:', url);

      const response = {
        url,
        filename,
        size: buffer.length,
        mimeType: data.mimetype,
      };

      logger.info('[Upload Route] Returning response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      logger.error('[Upload Route] ❌ Upload failed');
      logger.error('[Upload Route] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('[Upload Route] Error message:', error instanceof Error ? error.message : String(error));

      if (error instanceof Error) {
        logger.error('[Upload Route] Error stack:', error.stack);

        const errorObj = error as any;
        logger.error('[Upload Route] Error details:', {
          code: errorObj.code,
          errno: errorObj.errno,
          syscall: errorObj.syscall,
        });
      }

      return reply.status(500).send({
        message: 'Failed to upload image',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      logger.info('[Upload Route] ========== REQUEST COMPLETE ==========\n');
    }
  });

  // 📤 Upload multiple product images
  app.post('/product-images', async (request, reply) => {
    try {
      const files = await request.saveRequestFiles();

      if (!files || files.length === 0) {
        return reply.status(400).send({ message: 'No files uploaded' });
      }

      // Get productId from query
      const productId = request.query && typeof request.query === 'object' && 'productId' in request.query
        ? String(request.query.productId)
        : `temp-${Date.now()}`;

      const uploadedUrls: string[] = [];

      for (const file of files) {
        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          continue; // Skip invalid files
        }

        // Read file buffer
        const fs = await import('fs/promises');
        const buffer = await fs.readFile(file.filepath);

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          continue; // Skip large files
        }

        // Generate filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.filename}`;

        // Upload to R2
        const url = await uploadProductImage(
          productId,
          buffer,
          filename,
          file.mimetype
        );

        uploadedUrls.push(url);
      }

      return {
        urls: uploadedUrls,
        count: uploadedUrls.length,
      };
    } catch (error) {
      logger.error('Upload error:', error);
      return reply.status(500).send({
        message: 'Failed to upload images',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
