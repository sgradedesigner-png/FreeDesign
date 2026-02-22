import { buildOverlayMockupUrl, extractPublicId } from '../lib/cloudinary';
import type { PlacementConfigInput } from '../schemas/customization.schema';
import { BadRequestError } from '../utils/errors';

type PrintAreaDimension = {
  maxWidthCm: number;
  maxHeightCm: number;
};

type PrintSizeTierDimension = {
  widthCm: number;
  heightCm: number;
};

type BuildMockupPreviewParams = {
  baseImageUrl: string;
  overlayPublicId: string;
  printArea: PrintAreaDimension;
  printSizeTier?: PrintSizeTierDimension;
  presetRectNorm?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  baseImageNaturalWidth?: number;
  baseImageNaturalHeight?: number;
  placementConfig?: PlacementConfigInput;
};

type AreaBounds = {
  width: number;
  height: number;
};

const PREVIEW_FRAME_WIDTH_PX = 1200;
const PREVIEW_FRAME_HEIGHT_PX = 1400;
const AREA_MAX_WIDTH_RATIO = 0.75;
const AREA_MAX_HEIGHT_RATIO = 0.68;
const ARTWORK_COVERAGE_RATIO = 0.82;
const MIN_ARTWORK_EDGE_PX = 48;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeRatio(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function getAreaBounds(printArea: PrintAreaDimension): AreaBounds {
  const areaRatio = safeRatio(printArea.maxWidthCm / printArea.maxHeightCm, 1);

  const maxWidthPx = PREVIEW_FRAME_WIDTH_PX * AREA_MAX_WIDTH_RATIO;
  const maxHeightPx = PREVIEW_FRAME_HEIGHT_PX * AREA_MAX_HEIGHT_RATIO;

  let width = maxWidthPx;
  let height = width / areaRatio;

  if (!Number.isFinite(height) || height <= 0 || height > maxHeightPx) {
    height = maxHeightPx;
    width = height * areaRatio;
  }

  if (!Number.isFinite(width) || width <= 0) {
    width = maxWidthPx;
  }

  return { width, height };
}

function getSizeCoverageRatio(
  printArea: PrintAreaDimension,
  printSizeTier?: PrintSizeTierDimension
): number {
  if (!printSizeTier) return 1;

  const widthRatio = safeRatio(printSizeTier.widthCm / printArea.maxWidthCm, 1);
  const heightRatio = safeRatio(printSizeTier.heightCm / printArea.maxHeightCm, 1);

  return clamp(Math.min(widthRatio, heightRatio), 0.1, 1);
}

function normalizePlacement(config?: PlacementConfigInput) {
  return {
    offsetX: clamp(config?.offsetX ?? 0, -100, 100),
    offsetY: clamp(config?.offsetY ?? 0, -100, 100),
    rotation: clamp(config?.rotation ?? 0, -180, 180),
    scale: clamp(config?.scale ?? 1, 0.1, 3),
  };
}

function canUsePresetRectBounds(params: BuildMockupPreviewParams): boolean {
  return Boolean(
    params.presetRectNorm &&
    Number.isFinite(params.baseImageNaturalWidth) &&
    Number.isFinite(params.baseImageNaturalHeight) &&
    (params.baseImageNaturalWidth ?? 0) > 0 &&
    (params.baseImageNaturalHeight ?? 0) > 0
  );
}

export function buildCustomizationMockupPreviewUrl(
  params: BuildMockupPreviewParams
): {
  previewUrl: string;
  overlayWidthPx: number;
  overlayHeightPx: number;
  offsetXPx: number;
  offsetYPx: number;
} {
  const rawBaseValue = params.baseImageUrl.trim();
  const extractedBase = extractPublicId(rawBaseValue);
  const basePublicId = rawBaseValue.startsWith('http')
    ? extractedBase
    : rawBaseValue.replace(/\.[a-zA-Z0-9]+$/, '');

  if (!basePublicId || (rawBaseValue.startsWith('http') && extractedBase === rawBaseValue)) {
    throw new BadRequestError('Base mockup image must be a Cloudinary URL');
  }

  const overlayPublicId = params.overlayPublicId.trim();
  if (!overlayPublicId) {
    throw new BadRequestError('Design asset is missing Cloudinary public ID');
  }

  const placement = normalizePlacement(params.placementConfig);
  let overlayWidthPx: number;
  let overlayHeightPx: number;
  let offsetXPx: number;
  let offsetYPx: number;

  if (canUsePresetRectBounds(params)) {
    const baseW = params.baseImageNaturalWidth as number;
    const baseH = params.baseImageNaturalHeight as number;
    const rect = params.presetRectNorm as NonNullable<BuildMockupPreviewParams['presetRectNorm']>;

    const rectWidthPx = Math.max(MIN_ARTWORK_EDGE_PX, Math.round(rect.width * baseW));
    const rectHeightPx = Math.max(MIN_ARTWORK_EDGE_PX, Math.round(rect.height * baseH));
    const rectCenterX = rect.x * baseW + rectWidthPx / 2;
    const rectCenterY = rect.y * baseH + rectHeightPx / 2;

    overlayWidthPx = Math.max(
      MIN_ARTWORK_EDGE_PX,
      Math.round(rectWidthPx * placement.scale)
    );
    overlayHeightPx = Math.max(
      MIN_ARTWORK_EDGE_PX,
      Math.round(rectHeightPx * placement.scale)
    );

    offsetXPx =
      Math.round(rectCenterX - baseW / 2) +
      Math.round((placement.offsetX / 100) * (rectWidthPx / 2));
    offsetYPx =
      Math.round(rectCenterY - baseH / 2) +
      Math.round((placement.offsetY / 100) * (rectHeightPx / 2));
  } else {
    const areaBounds = getAreaBounds(params.printArea);
    const sizeCoverage = getSizeCoverageRatio(params.printArea, params.printSizeTier);

    overlayWidthPx = Math.max(
      MIN_ARTWORK_EDGE_PX,
      Math.round(areaBounds.width * sizeCoverage * ARTWORK_COVERAGE_RATIO * placement.scale)
    );
    overlayHeightPx = Math.max(
      MIN_ARTWORK_EDGE_PX,
      Math.round(areaBounds.height * sizeCoverage * ARTWORK_COVERAGE_RATIO * placement.scale)
    );

    offsetXPx = Math.round((placement.offsetX / 100) * (areaBounds.width / 2));
    offsetYPx = Math.round((placement.offsetY / 100) * (areaBounds.height / 2));
  }

  const previewUrl = buildOverlayMockupUrl({
    basePublicId,
    overlayPublicId,
    overlayWidthPx,
    overlayHeightPx,
    offsetXPx,
    offsetYPx,
    rotationDeg: placement.rotation,
  });

  return {
    previewUrl,
    overlayWidthPx,
    overlayHeightPx,
    offsetXPx,
    offsetYPx,
  };
}
