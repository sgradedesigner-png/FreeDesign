import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import crypto from 'crypto';
import { logger } from './logger';

// CRITICAL: Disable SSL verification for development (Windows SSL compatibility)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!;

// Log R2 configuration at startup
logger.info('Initializing Cloudflare R2 client...');
logger.info({
  accountId: R2_ACCOUNT_ID ? '✓ Set' : '✗ Missing',
  accessKey: R2_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing',
  secretKey: R2_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing',
  bucket: R2_BUCKET_NAME,
  publicDomain: R2_PUBLIC_DOMAIN,
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}, 'R2 configuration');

// Create HTTPS agent with custom SSL options for Windows compatibility
logger.debug('Creating HTTPS agent with SSL workarounds...');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // For development only - bypass SSL verification
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  // Force TLS 1.2 and 1.3, disable older versions
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  // Additional SSL/TLS options for Windows compatibility
  secureOptions: crypto.constants.SSL_OP_NO_SSLv2 |
                 crypto.constants.SSL_OP_NO_SSLv3 |
                 crypto.constants.SSL_OP_NO_TLSv1 |
                 crypto.constants.SSL_OP_NO_TLSv1_1,
  // Allow self-signed certificates
  checkServerIdentity: () => undefined,
});

logger.debug({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 50,
  timeout: 60000,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
}, 'HTTPS agent configuration');

// Create S3 client configured for Cloudflare R2
logger.info('Creating S3Client for Cloudflare R2...');
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 30000,
    requestTimeout: 60000,
  }),
});

logger.info('✅ S3Client created successfully');

/**
 * Upload a file to R2 storage
 * @param file - File buffer to upload
 * @param key - Object key (path) in R2
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  logger.debug({
    key,
    contentType,
    fileSize: file.length,
    bucket: R2_BUCKET_NAME
  }, 'Starting R2 upload');

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    logger.debug({
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    }, 'Sending upload command to R2');

    const startTime = Date.now();
    const response = await r2Client.send(command);
    const duration = Date.now() - startTime;

    const publicUrl = `https://${R2_PUBLIC_DOMAIN}/${key}`;

    logger.info({
      key,
      publicUrl,
      duration: `${duration}ms`,
      response
    }, '✅ R2 upload successful');

    return publicUrl;
  } catch (error) {
    logger.error({
      key,
      error: error instanceof Error ? {
        name: error.constructor.name,
        message: error.message,
        stack: error.stack,
        ...(error as any)
      } : String(error)
    }, '❌ R2 upload failed');

    throw error;
  }
}

/**
 * Upload a product image to R2
 * @param productId - Product ID (used for organizing files)
 * @param file - File buffer
 * @param filename - Original filename
 * @param contentType - MIME type
 * @returns Public URL of the uploaded image
 */
export async function uploadProductImage(
  productId: string,
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${productId}/web/${filename}`;

  logger.debug({
    productId,
    filename,
    contentType,
    fileSize: file.length,
    key
  }, 'Preparing product image upload');

  return uploadToR2(file, key, contentType);
}

/**
 * Delete a single object from R2
 * @param key - Object key (path) in R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  logger.debug({ key, bucket: R2_BUCKET_NAME }, 'Deleting object from R2');

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    logger.info({ key }, '✅ R2 object deleted successfully');
  } catch (error) {
    logger.error({ key, error }, '❌ R2 delete failed');
    throw error;
  }
}

/**
 * Delete all objects with a specific prefix (folder) from R2
 * @param prefix - Prefix (folder path) to delete
 * @returns Number of objects deleted
 */
export async function deleteR2Folder(prefix: string): Promise<number> {
  logger.debug({ prefix, bucket: R2_BUCKET_NAME }, 'Deleting folder from R2');

  try {
    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const listResponse = await r2Client.send(listCommand);
    const objects = listResponse.Contents || [];

    logger.debug({ prefix, objectCount: objects.length }, 'Found objects to delete');

    if (objects.length === 0) {
      logger.debug({ prefix }, 'No objects to delete');
      return 0;
    }

    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: {
        Objects: objects.map(obj => ({ Key: obj.Key! })),
        Quiet: false,
      },
    });

    const deleteResponse = await r2Client.send(deleteCommand);
    const deletedCount = deleteResponse.Deleted?.length || 0;

    logger.info({ prefix, deletedCount }, '✅ R2 folder deleted');

    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      logger.warn({ prefix, errors: deleteResponse.Errors }, '⚠️ Some deletions failed');
    }

    return deletedCount;
  } catch (error) {
    logger.error({ prefix, error }, '❌ R2 folder delete failed');
    throw error;
  }
}

/**
 * Delete all product images from R2
 * @param productId - Product UUID
 * @returns Number of images deleted
 */
export async function deleteProductImages(productId: string): Promise<number> {
  logger.debug({ productId }, 'Deleting all images for product');

  // ✅ Bucket нэр нь "products" тул "products/" prefix нэмэх шаардлагагүй
  // Delete entire product folder: {productId}/
  const prefix = `${productId}/`;
  const deletedCount = await deleteR2Folder(prefix);

  logger.info({ productId, deletedCount }, '✅ Deleted product images');
  return deletedCount;
}
