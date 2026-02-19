// ─────────────────────────────────────────────────────────────────────────────
// Garment geometry types — derived from ActualGarmentSize.md
// Source JSON: apps/store/src/data/garmentBounds.json
// ─────────────────────────────────────────────────────────────────────────────

export type ViewName = 'front' | 'back' | 'left' | 'right';

export type ProductType =
  | 'hoodie'
  | 'sweatshirt'
  | 'polo'
  | 'tanktop'
  | 'basketball_jersey'
  | 'soccer_jersey'
  | 'tote_bag';

export type SizeCategory =
  | 'Adult'
  | 'Youth (med/lg)'
  | 'Youth (small)'
  | 'Youth'
  | 'Toddler';

/** Pixel rectangle within a native image */
export interface PixelRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Native image dimensions */
export interface ImagePx {
  w: number;
  h: number;
}

/** 2D point */
export interface Point {
  x: number;
  y: number;
}

/**
 * Garment bounding box + safe frame for one product/view combination.
 * All coordinates are in native image pixels.
 */
export interface GarmentBounds {
  /** Filename in apps/admin/Blank Print Products/ */
  imageFile: string;
  /** Native image dimensions (px) */
  imgPx: ImagePx;
  /** Bounding box of the garment foreground pixels */
  boxPx: PixelRect;
  /**
   * Safe print frame (95% inset of boxPx).
   * All user artwork must stay within this frame.
   */
  safeFrame: PixelRect;
  /** Center of the garment bounding box */
  center: Point;
  /**
   * Physical width of the garment in cm — used to convert cm ↔ image-px.
   * For front/back flat views: 30.5cm (standard max imprint width).
   * For side/sleeve views: 25.0cm (approximate garment depth).
   */
  garmentWidthCm: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement standard type — derived from DTFSizeLocationStandard.md
// Source JSON: apps/store/src/data/placementStandards.json
// ─────────────────────────────────────────────────────────────────────────────

export type PlacementKey =
  | 'front_center'
  | 'front_left_chest'
  | 'back_center'
  | 'full_front'
  | 'oversize_front'
  | 'full_back'
  | 'top_back'
  | 'lower_back'
  | 'vertical_back'
  | 'across_chest'
  | 'sleeve'
  | 'front_number'
  | 'back_number'
  | 'back_name';

export interface PlacementStandard {
  placementKey: PlacementKey;
  /** Product types this standard applies to */
  productTypes: ProductType[];
  sizeCategory: SizeCategory;
  /** Which view this placement appears on */
  view: ViewName;
  /** Transfer width in cm */
  widthCm: number;
  /** Transfer height in cm */
  heightCm: number;
  /**
   * Distance from top of garment bounding box (collar/boxPx.y1) in cm.
   * For sleeves: distance from shoulder seam along sleeve axis.
   */
  topFromCollarCm: number;
  /**
   * Horizontal offset from center of garment in cm.
   * Positive = shift right, negative = shift left.
   * 0 = perfectly centered.
   */
  leftFromCenterCm: number;
  /** Citation of original source */
  source: string;
}
