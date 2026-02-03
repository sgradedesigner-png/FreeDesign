import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import crypto from 'crypto';

// CRITICAL: Disable SSL verification for development (Windows SSL compatibility)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!;

// Log R2 configuration at startup
console.log('[R2 Config] Initializing Cloudflare R2 client...');
console.log('[R2 Config] Account ID:', R2_ACCOUNT_ID ? '✓ Set' : '✗ Missing');
console.log('[R2 Config] Access Key:', R2_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing');
console.log('[R2 Config] Secret Key:', R2_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing');
console.log('[R2 Config] Bucket:', R2_BUCKET_NAME);
console.log('[R2 Config] Public Domain:', R2_PUBLIC_DOMAIN);
console.log('[R2 Config] Endpoint:', `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

// Create HTTPS agent with custom SSL options for Windows compatibility
console.log('[R2 HTTPS Agent] Creating HTTPS agent with SSL workarounds...');

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

console.log('[R2 HTTPS Agent] Configuration:', {
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 50,
  timeout: 60000,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  secureOptions: 'SSL_OP_NO_SSLv2|SSL_OP_NO_SSLv3|SSL_OP_NO_TLSv1|SSL_OP_NO_TLSv1_1',
});

// Create S3 client configured for Cloudflare R2
console.log('[R2 Client] Creating S3Client for Cloudflare R2...');
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

console.log('[R2 Client] ✅ S3Client created successfully');

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
  console.log('[R2 Upload] Starting upload to R2...');
  console.log('[R2 Upload] Key:', key);
  console.log('[R2 Upload] Content-Type:', contentType);
  console.log('[R2 Upload] File size:', file.length, 'bytes');
  console.log('[R2 Upload] Bucket:', R2_BUCKET_NAME);

  try {
    console.log('[R2 Upload] Creating PutObjectCommand...');
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    console.log('[R2 Upload] Sending command to R2...');
    console.log('[R2 Upload] Endpoint:', `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

    const startTime = Date.now();
    const response = await r2Client.send(command);
    const duration = Date.now() - startTime;

    console.log('[R2 Upload] ✅ Upload successful!');
    console.log('[R2 Upload] Response:', JSON.stringify(response, null, 2));
    console.log('[R2 Upload] Duration:', duration, 'ms');

    // Return the public URL
    const publicUrl = `https://${R2_PUBLIC_DOMAIN}/${key}`;
    console.log('[R2 Upload] Public URL:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('[R2 Upload] ❌ Upload failed');
    console.error('[R2 Upload] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[R2 Upload] Error message:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      console.error('[R2 Upload] Error stack:', error.stack);

      // Log specific error properties
      const errorObj = error as any;
      console.error('[R2 Upload] Error code:', errorObj.code);
      console.error('[R2 Upload] Error errno:', errorObj.errno);
      console.error('[R2 Upload] Error syscall:', errorObj.syscall);
      console.error('[R2 Upload] Error metadata:', JSON.stringify(errorObj.$metadata, null, 2));

      // Log all error properties
      console.error('[R2 Upload] Full error object:', JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj), 2));
    }

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
  console.log('[R2 Product Image] Preparing product image upload...');
  console.log('[R2 Product Image] Product ID:', productId);
  console.log('[R2 Product Image] Filename:', filename);
  console.log('[R2 Product Image] Content-Type:', contentType);
  console.log('[R2 Product Image] Buffer size:', file.length, 'bytes');

  // ✅ Bucket нэр нь "products" тул "products/" prefix нэмэх шаардлагагүй
  const key = `${productId}/web/${filename}`;
  console.log('[R2 Product Image] Generated key:', key);

  return uploadToR2(file, key, contentType);
}

/**
 * Delete a single object from R2
 * @param key - Object key (path) in R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  console.log('[R2 Delete] Deleting object from R2...');
  console.log('[R2 Delete] Key:', key);
  console.log('[R2 Delete] Bucket:', R2_BUCKET_NAME);

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    console.log('[R2 Delete] ✅ Object deleted successfully');
  } catch (error) {
    console.error('[R2 Delete] ❌ Delete failed');
    console.error('[R2 Delete] Error:', error);
    throw error;
  }
}

/**
 * Delete all objects with a specific prefix (folder) from R2
 * @param prefix - Prefix (folder path) to delete
 * @returns Number of objects deleted
 */
export async function deleteR2Folder(prefix: string): Promise<number> {
  console.log('[R2 Delete Folder] Deleting folder from R2...');
  console.log('[R2 Delete Folder] Prefix:', prefix);
  console.log('[R2 Delete Folder] Bucket:', R2_BUCKET_NAME);

  try {
    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const listResponse = await r2Client.send(listCommand);
    const objects = listResponse.Contents || [];

    console.log('[R2 Delete Folder] Found', objects.length, 'objects to delete');

    if (objects.length === 0) {
      console.log('[R2 Delete Folder] No objects to delete');
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

    console.log('[R2 Delete Folder] ✅ Deleted', deletedCount, 'objects');

    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      console.error('[R2 Delete Folder] ⚠️ Some deletions failed:', deleteResponse.Errors);
    }

    return deletedCount;
  } catch (error) {
    console.error('[R2 Delete Folder] ❌ Delete folder failed');
    console.error('[R2 Delete Folder] Error:', error);
    throw error;
  }
}

/**
 * Delete all product images from R2
 * @param productId - Product UUID
 * @returns Number of images deleted
 */
export async function deleteProductImages(productId: string): Promise<number> {
  console.log('[R2 Delete Product] Deleting all images for product:', productId);

  // ✅ Bucket нэр нь "products" тул "products/" prefix нэмэх шаардлагагүй
  // Delete entire product folder: {productId}/
  const prefix = `${productId}/`;
  const deletedCount = await deleteR2Folder(prefix);

  console.log('[R2 Delete Product] ✅ Deleted', deletedCount, 'images for product', productId);
  return deletedCount;
}
