import type { PlacementStandard, ProductType, SizeCategory, ViewName } from '@/types/garment';
import rawData from '@/data/placementStandards.json';

type PlacementEntry = PlacementStandard & { productTypes: ProductType[] };
type PlacementMap = Record<string, PlacementEntry | string>;
const data = rawData as unknown as PlacementMap;

// Build an index: productType → view → list of PlacementStandard
type PlacementIndex = Map<string, PlacementStandard[]>;
const _index: PlacementIndex = new Map();

for (const entry of Object.values(data)) {
  if (typeof entry === 'string' || !entry.placementKey) continue; // skip _comment key
  for (const pt of (entry as PlacementEntry).productTypes) {
    const key = `${pt}_${entry.view}`;
    if (!_index.has(key)) _index.set(key, []);
    _index.get(key)!.push(entry);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List all placement standards available for a product type on a given view.
 * Sorted by widthCm descending (largest presets first).
 */
export function listPlacements(productType: ProductType, view: ViewName): PlacementStandard[] {
  return _index.get(`${productType}_${view}`) ?? [];
}

/**
 * Get a specific placement standard for a product type, placement key, and size category.
 * Returns undefined if no match.
 */
export function getPlacementStandard(
  productType: ProductType,
  placementKey: string,
  sizeCategory: SizeCategory
): PlacementStandard | undefined {
  const all = Array.from(_index.values()).flat();
  return all.find(
    (p) =>
      p.productTypes.includes(productType) &&
      p.placementKey === placementKey &&
      p.sizeCategory === sizeCategory
  );
}

/**
 * Get unique placement keys available for a product type + view.
 */
export function listPlacementKeys(productType: ProductType, view: ViewName): string[] {
  const entries = listPlacements(productType, view);
  return [...new Set(entries.map((e) => e.placementKey))];
}

/**
 * Resolve the size category from a garment size string.
 * Maps e.g. "L" → "Adult", "Youth M" → "Youth (med/lg)", "3T" → "Toddler"
 */
export function resolveSizeCategory(size: string): SizeCategory {
  const s = size.toLowerCase().trim();
  if (s.match(/^(2t|3t|4t|5t)$/)) return 'Toddler';
  if (s.match(/youth\s*(xs|s)$/) || s === 'ys' || s === 'yxs') return 'Youth (small)';
  if (s.match(/youth\s*(m|l|xl)$/) || s === 'ym' || s === 'yl' || s === 'yxl') return 'Youth (med/lg)';
  if (s.startsWith('youth')) return 'Youth';
  return 'Adult';
}

/**
 * Get the best placement standard for a product/view/key/size combo.
 * Falls back to Adult if the exact size category has no entry.
 */
export function resolvePlacement(
  productType: ProductType,
  placementKey: string,
  view: ViewName,
  size: string
): PlacementStandard | undefined {
  const sizeCategory = resolveSizeCategory(size);
  return (
    getPlacementStandard(productType, placementKey, sizeCategory) ??
    getPlacementStandard(productType, placementKey, 'Adult')
  );
}
