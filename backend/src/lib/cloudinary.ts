import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger';

type SignedUploadOptions = {
  publicId?: string;
};

type SignedUploadParams = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId?: string;
};

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadProductImage(
  productId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `products/${productId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) {
          logger.error({ error, productId, filename }, 'Cloudinary upload failed');
          reject(error);
          return;
        }

        logger.info(
          { productId, url: result!.secure_url, contentType },
          'Product image uploaded to Cloudinary'
        );
        resolve(result!.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
}

export async function uploadDesignAsset(
  userId: string,
  buffer: Buffer,
  filename: string
): Promise<{ url: string; publicId: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `designs/${userId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          logger.error({ error, userId, filename }, 'Design asset upload failed');
          reject(error);
          return;
        }

        logger.info({ userId, publicId: result!.public_id }, 'Design asset uploaded');
        resolve({
          url: result!.secure_url,
          publicId: result!.public_id,
          width: result!.width,
          height: result!.height,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

export function getThumbnailUrl(originalUrl: string, width = 200): string {
  return originalUrl.replace('/upload/', `/upload/w_${width},c_limit/`);
}

export function buildOverlayMockupUrl(params: {
  basePublicId: string;
  overlayPublicId: string;
  overlayWidthPx: number;
  overlayHeightPx: number;
  offsetXPx: number;
  offsetYPx: number;
  rotationDeg?: number;
}): string {
  const {
    basePublicId,
    overlayPublicId,
    overlayWidthPx,
    overlayHeightPx,
    offsetXPx,
    offsetYPx,
    rotationDeg = 0,
  } = params;

  return cloudinary.url(basePublicId, {
    secure: true,
    transformation: [
      {
        quality: 'auto',
        fetch_format: 'auto',
      },
      {
        overlay: overlayPublicId.replace(/\//g, ':'),
        width: Math.max(1, Math.round(overlayWidthPx)),
        height: Math.max(1, Math.round(overlayHeightPx)),
        crop: 'fit',
        angle: Math.round(rotationDeg),
      },
      {
        flags: 'layer_apply',
        gravity: 'center',
        x: Math.round(offsetXPx),
        y: Math.round(offsetYPx),
      },
    ],
  });
}

export async function deleteImage(publicIdOrUrl: string): Promise<void> {
  const publicId = publicIdOrUrl.includes('/') ? extractPublicId(publicIdOrUrl) : publicIdOrUrl;

  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId }, 'Image deleted from Cloudinary');
  } catch (error) {
    logger.error({ error, publicId }, 'Failed to delete image from Cloudinary');
    throw error;
  }
}

export async function deleteFolder(folderPath: string): Promise<void> {
  try {
    await cloudinary.api.delete_resources_by_prefix(folderPath);
    await cloudinary.api.delete_folder(folderPath);
    logger.info({ folderPath }, 'Folder deleted from Cloudinary');
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("can't find folder")) {
      logger.info({ folderPath }, 'Cloudinary folder already absent');
      return;
    }

    logger.error({ error, folderPath }, 'Failed to delete folder from Cloudinary');
    throw error;
  }
}

export function generateSignedUploadParams(
  folder: string,
  options: SignedUploadOptions = {}
): SignedUploadParams {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = { timestamp, folder };

  if (options.publicId) {
    paramsToSign.public_id = options.publicId;
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET);

  return {
    timestamp,
    signature,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
    publicId: options.publicId,
  };
}

export function extractPublicId(url: string): string {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match?.[1] ?? url;
}

// ============================================
// Phase 2: Upload Lifecycle Functions
// ============================================

type UploadFamily = 'gang_upload' | 'uv_gang_upload' | 'by_size' | 'uv_by_size' | 'blanks';

/**
 * Generate signed upload parameters for Phase 2 upload flows
 * Includes family context for validation constraints
 */
export function generateUploadSignature(params: {
  userId: string;
  uploadFamily: UploadFamily;
  fileName: string;
  maxFileSizeBytes?: number;
}): {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  uploadPreset?: string;
} {
  const { userId, uploadFamily, fileName } = params;
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `uploads/${uploadFamily}/${userId}`;
  const publicId = `${timestamp}-${fileName.replace(/\.[^.]+$/, '')}`;

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: publicId,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET);

  return {
    timestamp,
    signature,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
    publicId,
  };
}

/**
 * Retrieve upload asset metadata from Cloudinary
 */
export async function getUploadAssetMetadata(publicId: string): Promise<{
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resourceType: string;
}> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'image',
    });

    return {
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
    };
  } catch (error) {
    logger.error({ error, publicId }, 'Failed to retrieve upload metadata from Cloudinary');
    throw error;
  }
}

/**
 * Validate upload family against supported types
 */
export function isValidUploadFamily(family: string): family is UploadFamily {
  const validFamilies: UploadFamily[] = ['gang_upload', 'uv_gang_upload', 'by_size', 'uv_by_size', 'blanks'];
  return validFamilies.includes(family as UploadFamily);
}

export default cloudinary;
