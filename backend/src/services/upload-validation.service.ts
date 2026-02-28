/**
 * Upload Validation Service
 * Business logic for validating upload assets against family-specific constraints
 */

import { logger } from '../lib/logger';
import { getUploadAssetMetadata } from '../lib/cloudinary';
import { ProductFamily } from '@prisma/client';
import { settingsService, type UploadFamilyKey } from './settings.service';

export type ValidationConstraints = {
  allowedMimeTypes: Set<string>;
  maxBytes: number;
  minDpi?: number;
  minWidthPx?: number;
  minHeightPx?: number;
};

export type ValidationResult = {
  passed: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
};

function normalizeFamily(family: ProductFamily): UploadFamilyKey {
  return family.toLowerCase() as UploadFamilyKey;
}

/**
 * Validate an upload asset against its family constraints
 */
export async function validateUploadAsset(params: {
  cloudinaryPublicId: string;
  mimeType: string;
  fileSizeBytes: number;
  widthPx?: number;
  heightPx?: number;
  dpi?: number;
  uploadFamily?: ProductFamily | null;
}): Promise<ValidationResult> {
  const { cloudinaryPublicId, mimeType, fileSizeBytes, widthPx, heightPx, dpi, uploadFamily } =
    params;

  try {
    // If no family specified, cannot validate against constraints
    if (!uploadFamily) {
      return {
        passed: false,
        errorCode: 'NO_UPLOAD_FAMILY',
        errorMessage: 'Upload family not specified for validation',
      };
    }

    const globalValidationEnabled = await settingsService.getGlobalValidationEnabled();
    if (!globalValidationEnabled) {
      return {
        passed: true,
        metadata: {
          validatedAt: new Date().toISOString(),
          skipped: true,
          reason: 'global_validation_disabled',
          uploadFamily,
        },
      };
    }

    const constraints = await settingsService.getUploadConstraints(normalizeFamily(uploadFamily));
    if (!constraints.enabled) {
      return {
        passed: true,
        metadata: {
          validatedAt: new Date().toISOString(),
          skipped: true,
          reason: 'family_validation_disabled',
          uploadFamily,
        },
      };
    }

    // Validate MIME type
    if (!constraints.allowedMimeTypes.has(mimeType)) {
      return {
        passed: false,
        errorCode: 'INVALID_FILE_TYPE',
        errorMessage: `File type ${mimeType} not allowed for ${uploadFamily}. Allowed types: ${Array.from(
          constraints.allowedMimeTypes
        ).join(', ')}`,
      };
    }

    // Validate file size
    if (fileSizeBytes > constraints.maxBytes) {
      const maxMB = Math.round(constraints.maxBytes / (1024 * 1024));
      const actualMB = Math.round(fileSizeBytes / (1024 * 1024));
      return {
        passed: false,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `File size ${actualMB}MB exceeds maximum ${maxMB}MB for ${uploadFamily}`,
      };
    }

    // Fetch metadata from Cloudinary if dimensions missing
    let actualWidth = widthPx;
    let actualHeight = heightPx;
    let actualDpi = dpi;

    if (!actualWidth || !actualHeight) {
      logger.info({ cloudinaryPublicId }, 'Fetching metadata from Cloudinary for validation');
      try {
        const metadata = await getUploadAssetMetadata(cloudinaryPublicId);
        actualWidth = metadata.width;
        actualHeight = metadata.height;
      } catch (error) {
        logger.error(
          { error, cloudinaryPublicId },
          'Failed to fetch Cloudinary metadata for validation'
        );
        return {
          passed: false,
          errorCode: 'METADATA_FETCH_FAILED',
          errorMessage: 'Unable to retrieve image metadata for validation',
        };
      }
    }

    // Validate minimum width
    if (constraints.minWidthPx && actualWidth && actualWidth < constraints.minWidthPx) {
      return {
        passed: false,
        errorCode: 'WIDTH_TOO_SMALL',
        errorMessage: `Image width ${actualWidth}px is below minimum ${constraints.minWidthPx}px for ${uploadFamily}`,
      };
    }

    // Validate minimum height
    if (constraints.minHeightPx && actualHeight && actualHeight < constraints.minHeightPx) {
      return {
        passed: false,
        errorCode: 'HEIGHT_TOO_SMALL',
        errorMessage: `Image height ${actualHeight}px is below minimum ${constraints.minHeightPx}px for ${uploadFamily}`,
      };
    }

    // Validate minimum DPI (heuristic: DPI might not be available for all formats)
    if (constraints.minDpi && actualDpi && actualDpi < constraints.minDpi) {
      return {
        passed: false,
        errorCode: 'DPI_TOO_LOW',
        errorMessage: `Image DPI ${actualDpi} is below minimum ${constraints.minDpi} for ${uploadFamily}`,
      };
    }

    // All validations passed
    return {
      passed: true,
      metadata: {
        validatedAt: new Date().toISOString(),
        width: actualWidth,
        height: actualHeight,
        dpi: actualDpi,
        mimeType,
        fileSizeBytes,
        uploadFamily,
      },
    };
  } catch (error) {
    logger.error({ error, cloudinaryPublicId }, 'Unexpected error during upload validation');
    return {
      passed: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Get user-friendly error message for validation error codes
 */
export function getValidationErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    NO_UPLOAD_FAMILY: 'Upload type not specified',
    INVALID_UPLOAD_FAMILY: 'Invalid upload type',
    INVALID_FILE_TYPE: 'File type not supported',
    FILE_TOO_LARGE: 'File size too large',
    WIDTH_TOO_SMALL: 'Image width too small',
    HEIGHT_TOO_SMALL: 'Image height too small',
    DPI_TOO_LOW: 'Image resolution (DPI) too low',
    METADATA_FETCH_FAILED: 'Unable to verify file details',
    VALIDATION_ERROR: 'Validation failed',
  };

  return messages[errorCode] || 'Upload validation failed';
}
