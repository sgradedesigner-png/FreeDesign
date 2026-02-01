// src/types/export.ts
import type { ZoneKey, ProductType, ZoneCM } from './zone';
import type { Placement } from './placement';

/** Physical placement in centimeters */
export interface PlacementCM {
  /** X position from left edge in cm */
  x_cm: number;
  /** Y position from top edge in cm */
  y_cm: number;
  /** Image width in cm */
  width_cm: number;
  /** Image height in cm */
  height_cm: number;
  /** Rotation in degrees */
  rotation_deg: number;
}

/** Zone export data */
export interface ZoneExportData {
  /** Zone identifier */
  zoneKey: ZoneKey;
  /** Zone name for display */
  zoneName: string;
  /** Zone physical dimensions */
  zoneSizeCM: ZoneCM;
  /** Original image data URL (high resolution) */
  originalImageDataUrl: string;
  /** Original image dimensions */
  originalImageSize: {
    width: number;
    height: number;
  };
  /** Rendered template PNG data URL */
  templatePngDataUrl: string;
  /** Template dimensions in pixels */
  templateSizePx: {
    width: number;
    height: number;
  };
  /** UV placement (normalized 0-1) */
  placementUV: Placement;
  /** Physical placement in cm */
  placementCM: PlacementCM;
}

/** Product info for export */
export interface ProductExportInfo {
  /** Product type */
  type: ProductType;
  /** Product display name */
  name: string;
  /** Product color (hex) */
  color: string;
  /** Product size (if applicable) */
  size?: string;
}

/** Complete export package - structured for Supabase */
export interface ExportPackage {
  /** Unique export ID */
  id: string;
  /** Export version for compatibility */
  version: string;
  /** Export timestamp */
  createdAt: string;
  /** Product information */
  product: ProductExportInfo;
  /** Zone designs data */
  zones: ZoneExportData[];
  /** Export settings used */
  settings: {
    dpi: number;
    templatePx: number;
  };
  /** Summary statistics */
  summary: {
    totalZonesWithDesign: number;
    zoneKeys: ZoneKey[];
  };
}

/** Export options */
export interface ExportOptions {
  /** DPI for high-res export */
  dpi?: number;
  /** Template size in pixels */
  templatePx?: number;
  /** Include original images */
  includeOriginals?: boolean;
  /** Product size label */
  productSize?: string;
}
