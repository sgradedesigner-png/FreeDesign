import type { GarmentBounds, ProductType, ViewName } from '@/types/garment';
import rawData from '@/data/garmentBounds.json';

type BoundsMap = Record<string, GarmentBounds>;
const data = rawData as BoundsMap;

// ─── Product type → available views ──────────────────────────────────────────

const PRODUCT_VIEWS: Record<ProductType, ViewName[]> = {
  hoodie:             ['front', 'back', 'left', 'right'],
  sweatshirt:         ['front', 'back', 'left', 'right'],
  polo:               ['front', 'back', 'left', 'right'],
  tanktop:            ['front', 'back'],
  basketball_jersey:  ['front', 'back'],
  soccer_jersey:      ['front', 'back'],
  tote_bag:           ['front'],
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get garment bounds for a product type + view.
 * Throws if the key does not exist in garmentBounds.json.
 */
export function getGarmentBounds(productType: ProductType, view: ViewName): GarmentBounds {
  const key = `${productType}_${view}`;
  const bounds = data[key];
  if (!bounds) {
    throw new Error(`garmentBounds: no entry for key "${key}"`);
  }
  return bounds;
}

/** Returns the views available for the given product type. */
export function listAvailableViews(productType: ProductType): ViewName[] {
  return PRODUCT_VIEWS[productType] ?? ['front'];
}

/** Returns true if garment bounds exist for the product type + view. */
export function hasView(productType: ProductType, view: ViewName): boolean {
  return Boolean(data[`${productType}_${view}`]);
}

/**
 * Map variant galleryPaths (ordered array from seed script) to view-keyed URLs.
 *
 * Seed gallery order per product:
 *   hoodie/sweatshirt/polo: [front, back, left, right]
 *   basketball_jersey/soccer_jersey/tanktop: [front, back]
 *   tote_bag: [front]
 *
 * Falls back to imagePath for front view if gallery is empty.
 */
export function galleryPathsToViewMap(
  productType: ProductType,
  imagePath: string,
  galleryPaths: string[]
): Partial<Record<ViewName, string>> {
  const views = PRODUCT_VIEWS[productType] ?? ['front'];
  const result: Partial<Record<ViewName, string>> = {};
  views.forEach((view, idx) => {
    result[view] = galleryPaths[idx] ?? (view === 'front' ? imagePath : undefined);
  });
  return result;
}

/**
 * Map a garment view switch display label.
 */
export const VIEW_DISPLAY_NAMES: Record<ViewName, string> = {
  front: 'Front',
  back:  'Back',
  left:  'Left Sleeve',
  right: 'Right Sleeve',
};

/**
 * Convert product subfamily string (from DB) to internal ProductType key.
 * Handles common name variants from the admin.
 */
export function resolveProductType(raw: string | null | undefined): ProductType {
  const s = (raw ?? '').toLowerCase().replace(/[-\s]+/g, '_');
  if (s.includes('basketball'))  return 'basketball_jersey';
  if (s.includes('soccer'))      return 'soccer_jersey';
  if (s.includes('hoodie'))      return 'hoodie';
  if (s.includes('sweatshirt'))  return 'sweatshirt';
  if (s.includes('polo'))        return 'polo';
  if (s.includes('tank'))        return 'tanktop';
  if (s.includes('tote'))        return 'tote_bag';
  // fallback — try direct match
  if (data[`${s}_front`])        return s as ProductType;
  return 'hoodie';
}
