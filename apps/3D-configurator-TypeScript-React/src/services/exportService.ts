// src/services/exportService.ts
import type { ZoneKey, ZoneCM } from '@/types/zone';
import type { Placement, ZoneDraft } from '@/types/placement';
import type {
  ExportPackage,
  ExportOptions,
  ZoneExportData,
  PlacementCM,
} from '@/types/export';
import { DEFAULT_DPI, DEFAULT_TEMPLATE_PX } from '@/config/constants';
import { ZONE_CM } from '@/config/printZones';

const EXPORT_VERSION = '1.0.0';
const ZONE_KEYS: ZoneKey[] = ['front', 'back', 'left_arm', 'right_arm'];

const ZONE_DISPLAY_NAMES: Record<ZoneKey, string> = {
  front: 'Front',
  back: 'Back',
  left_arm: 'Left Arm',
  right_arm: 'Right Arm',
};

/**
 * Generate a unique export ID
 */
function generateExportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `exp_${timestamp}_${random}`;
}

/**
 * Convert image to high-res data URL
 */
function imageToDataUrl(img: HTMLImageElement, quality = 1.0): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png', quality);
}

/**
 * Convert UV placement to CM placement
 */
function placementUVToCM(placement: Placement, zoneCM: ZoneCM): PlacementCM {
  const width_cm = placement.uScale * zoneCM.width;
  const height_cm = placement.vScale * zoneCM.height;

  // Calculate position from top-left corner
  // placement.u and v are center positions (0-1)
  const centerX_cm = placement.u * zoneCM.width;
  const centerY_cm = (1 - placement.v) * zoneCM.height; // Flip Y for top-down

  // Convert to top-left corner position
  const x_cm = centerX_cm - width_cm / 2;
  const y_cm = centerY_cm - height_cm / 2;

  const rotation_deg = (placement.rotationRad || 0) * (180 / Math.PI);

  return {
    x_cm: Math.round(x_cm * 100) / 100,
    y_cm: Math.round(y_cm * 100) / 100,
    width_cm: Math.round(width_cm * 100) / 100,
    height_cm: Math.round(height_cm * 100) / 100,
    rotation_deg: Math.round(rotation_deg * 100) / 100,
  };
}

/**
 * Render template PNG for a zone
 */
function renderTemplatePNG(
  image: HTMLImageElement,
  placement: Placement,
  zoneCM: ZoneCM,
  templatePx: number
): { dataUrl: string; width: number; height: number } {
  const aspect = zoneCM.height / zoneCM.width;
  const outW = templatePx;
  const outH = Math.round(outW * aspect);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { dataUrl: '', width: outW, height: outH };
  }

  // Transparent background for better compositing
  ctx.clearRect(0, 0, outW, outH);

  // Calculate drawing position
  const cx = placement.u * outW;
  const cy = (1 - placement.v) * outH;
  const dw = placement.uScale * outW;
  const dh = placement.vScale * outH;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(placement.rotationRad || 0);
  ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: outW,
    height: outH,
  };
}

/**
 * Build zone export data
 */
function buildZoneExportData(
  zoneKey: ZoneKey,
  draft: ZoneDraft,
  zoneCM: ZoneCM,
  templatePx: number
): ZoneExportData | null {
  if (!draft.image || !draft.placement) {
    return null;
  }

  const template = renderTemplatePNG(
    draft.image,
    draft.placement,
    zoneCM,
    templatePx
  );

  return {
    zoneKey,
    zoneName: ZONE_DISPLAY_NAMES[zoneKey],
    zoneSizeCM: zoneCM,
    originalImageDataUrl: imageToDataUrl(draft.image),
    originalImageSize: {
      width: draft.image.naturalWidth || draft.image.width,
      height: draft.image.naturalHeight || draft.image.height,
    },
    templatePngDataUrl: template.dataUrl,
    templateSizePx: {
      width: template.width,
      height: template.height,
    },
    placementUV: { ...draft.placement },
    placementCM: placementUVToCM(draft.placement, zoneCM),
  };
}

/**
 * Build complete export package
 */
export async function buildExportPackage(
  zoneDrafts: Map<ZoneKey, ZoneDraft>,
  productColor: string,
  options: ExportOptions = {}
): Promise<ExportPackage> {
  const {
    dpi = DEFAULT_DPI,
    templatePx = DEFAULT_TEMPLATE_PX,
    productSize,
  } = options;

  const zones: ZoneExportData[] = [];
  const zoneKeysWithDesign: ZoneKey[] = [];

  // Process each zone
  for (const zoneKey of ZONE_KEYS) {
    const draft = zoneDrafts.get(zoneKey);
    const zoneCM = ZONE_CM.tshirt[zoneKey];

    if (draft?.image && draft?.placement && zoneCM) {
      const zoneData = buildZoneExportData(zoneKey, draft, zoneCM, templatePx);
      if (zoneData) {
        zones.push(zoneData);
        zoneKeysWithDesign.push(zoneKey);
      }
    }
  }

  const exportPackage: ExportPackage = {
    id: generateExportId(),
    version: EXPORT_VERSION,
    createdAt: new Date().toISOString(),
    product: {
      type: 'tshirt',
      name: 'T-Shirt',
      color: productColor,
      size: productSize,
    },
    zones,
    settings: {
      dpi,
      templatePx,
    },
    summary: {
      totalZonesWithDesign: zones.length,
      zoneKeys: zoneKeysWithDesign,
    },
  };

  return exportPackage;
}

/**
 * Download export package as JSON file
 */
export function downloadExportJSON(exportPackage: ExportPackage): void {
  const jsonStr = JSON.stringify(exportPackage, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `design_${exportPackage.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a single image
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download all export files as separate downloads
 */
export async function downloadAllExportFiles(exportPackage: ExportPackage): Promise<void> {
  const exportId = exportPackage.id;

  // Download JSON metadata
  downloadExportJSON(exportPackage);

  // Small delay between downloads to prevent browser blocking
  await new Promise(resolve => setTimeout(resolve, 100));

  // Download each zone's template PNG
  for (const zone of exportPackage.zones) {
    downloadImage(
      zone.templatePngDataUrl,
      `${exportId}_${zone.zoneKey}_template.png`
    );
    await new Promise(resolve => setTimeout(resolve, 100));

    // Also download original image
    downloadImage(
      zone.originalImageDataUrl,
      `${exportId}_${zone.zoneKey}_original.png`
    );
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Prepare data for Supabase upload (strips data URLs for separate file upload)
 */
export function prepareForSupabase(exportPackage: ExportPackage): {
  metadata: Omit<ExportPackage, 'zones'> & { zones: Array<Omit<ZoneExportData, 'originalImageDataUrl' | 'templatePngDataUrl'> & { originalImagePath?: string; templatePngPath?: string }> };
  files: Array<{ key: string; dataUrl: string; filename: string }>;
} {
  const files: Array<{ key: string; dataUrl: string; filename: string }> = [];

  const zonesWithPaths = exportPackage.zones.map(zone => {
    // Add files for upload
    files.push({
      key: `${zone.zoneKey}_original`,
      dataUrl: zone.originalImageDataUrl,
      filename: `${exportPackage.id}/${zone.zoneKey}_original.png`,
    });
    files.push({
      key: `${zone.zoneKey}_template`,
      dataUrl: zone.templatePngDataUrl,
      filename: `${exportPackage.id}/${zone.zoneKey}_template.png`,
    });

    // Return zone data without data URLs but with paths
    const { originalImageDataUrl, templatePngDataUrl, ...rest } = zone;
    return {
      ...rest,
      originalImagePath: `${exportPackage.id}/${zone.zoneKey}_original.png`,
      templatePngPath: `${exportPackage.id}/${zone.zoneKey}_template.png`,
    };
  });

  return {
    metadata: {
      ...exportPackage,
      zones: zonesWithPaths,
    },
    files,
  };
}

/**
 * Convert data URL to Blob for file upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}
