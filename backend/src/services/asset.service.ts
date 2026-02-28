import type { CustomizationAsset } from '@prisma/client';
import { getThumbnailUrl, uploadDesignAsset } from '../lib/cloudinary';
import { prisma } from '../lib/prisma';
import { BadRequestError } from '../utils/errors';
import { settingsService } from './settings.service';

const MIN_RASTER_DIMENSION_PX = 800;

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isSvg(mimeType: string): boolean {
  return mimeType.toLowerCase() === 'image/svg+xml';
}

async function ensureAllowedFile(mimeType: string, size: number): Promise<void> {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  const globalValidationEnabled = await settingsService.getGlobalValidationEnabled();
  const constraints = await settingsService.getUploadConstraints('blanks');

  if (size <= 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  if (!globalValidationEnabled || !constraints.enabled) {
    return;
  }

  if (!constraints.allowedMimeTypes.has(normalizedMimeType)) {
    throw new BadRequestError('Unsupported design file type');
  }

  if (size > constraints.maxBytes) {
    const maxMb = Math.round(constraints.maxBytes / (1024 * 1024));
    throw new BadRequestError(`Uploaded file exceeds ${maxMb}MB size limit`);
  }
}

export async function uploadCustomizationAsset(params: {
  userId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<CustomizationAsset> {
  const { userId, buffer, filename, mimeType } = params;
  await ensureAllowedFile(mimeType, buffer.length);

  const safeFilename = sanitizeFilename(filename) || `${Date.now()}-design`;
  const uploaded = await uploadDesignAsset(userId, buffer, safeFilename);

  const widthPx = Number.isFinite(uploaded.width) ? uploaded.width : null;
  const heightPx = Number.isFinite(uploaded.height) ? uploaded.height : null;

  const passesRasterValidation = isSvg(mimeType)
    ? true
    : Boolean(
      widthPx &&
      heightPx &&
      widthPx >= MIN_RASTER_DIMENSION_PX &&
      heightPx >= MIN_RASTER_DIMENSION_PX
    );

  const thumbnailUrl = getThumbnailUrl(uploaded.url, 200);

  return prisma.customizationAsset.create({
    data: {
      userId,
      originalUrl: uploaded.url,
      thumbnailUrl,
      cloudinaryId: uploaded.publicId,
      fileName: safeFilename,
      mimeType,
      fileSizeBytes: buffer.length,
      widthPx,
      heightPx,
      dpi: null,
      isValid: passesRasterValidation,
    },
  });
}

export async function ensureCustomizationAssetsOwnedByUser(
  userId: string,
  assetIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const matchedAssets = await prisma.customizationAsset.findMany({
    where: {
      id: { in: uniqueIds },
      userId,
      isValid: true,
    },
    select: { id: true },
  });

  if (matchedAssets.length !== uniqueIds.length) {
    throw new BadRequestError('One or more customization assets are invalid');
  }
}
