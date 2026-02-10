import { logger } from '../lib/logger';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!;

logger.info('[R2 Presigned] Creating minimal S3 client for presigned URLs...');

// Minimal S3 client - no custom HTTPS agent needed for signing
export const r2SigningClient = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Use path-style URLs instead of virtual-hosted-style
});

logger.info('[R2 Presigned] ✅ Signing client ready');

/**
 * Generate presigned URL for uploading
 * Frontend will upload directly to R2 using this URL
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  logger.info({ key, contentType, expiresIn }, '[R2 Presigned] Generating presigned URL');

  try {
    // CRITICAL FIX: Don't include ContentType in PutObjectCommand
    // Browser will send Content-Type header, but it shouldn't be signed
    // Otherwise R2 sees unsigned headers and returns 403
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      // ContentType removed - browser will send it, but we don't sign it
    });

    const signedUrl = await getSignedUrl(r2SigningClient, command, {
      expiresIn,
      unhoistableHeaders: new Set(['content-type']), // Don't sign Content-Type
    });

    logger.info({ urlLength: signedUrl.length }, '[R2 Presigned] ✅ Presigned URL generated (ContentType NOT signed)');

    return signedUrl;
  } catch (error) {
    logger.error({ error }, '[R2 Presigned] ❌ Failed to generate presigned URL');
    throw error;
  }
}

/**
 * Generate presigned POST data (alternative method)
 * Allows setting additional conditions
 */
export async function generatePresignedPost(
  key: string,
  contentType: string,
  maxFileSize: number = 5 * 1024 * 1024, // 5MB
  expiresIn: number = 3600
) {
  logger.info('[R2 Presigned POST] Generating presigned POST...');

  try {
    const presignedPost = await createPresignedPost(r2SigningClient, {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Conditions: [
        ['content-length-range', 0, maxFileSize],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: expiresIn,
    });

    logger.info('[R2 Presigned POST] ✅ Presigned POST generated');

    return presignedPost;
  } catch (error) {
    logger.error({ error }, '[R2 Presigned POST] ❌ Failed');
    throw error;
  }
}

/**
 * Get public URL for uploaded file
 */
export function getPublicUrl(key: string): string {
  return `https://${R2_PUBLIC_DOMAIN}/${key}`;
}

/**
 * Generate presigned URL for product image
 */
export async function generateProductImageUploadUrl(
  productId: string,
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  logger.info({ productId, filename }, '[R2 Product Presigned] Generating upload URL for product image');

  const timestamp = Date.now();
  // ✅ Bucket нэр нь "products" тул "products/" prefix нэмэх шаардлагагүй
  const key = `${productId}/web/${timestamp}-${filename}`;

  const uploadUrl = await generatePresignedUploadUrl(key, contentType);
  const publicUrl = getPublicUrl(key);

  logger.info({ publicUrl }, '[R2 Product Presigned] ✅ URLs generated');

  return {
    uploadUrl,
    publicUrl,
    key,
  };
}
