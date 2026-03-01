import type { Product } from '../../data/products';
import type { ProductFamily, ProductStrategy } from './types';
import { BySizeStrategy } from './strategies/BySizeStrategy';
import { BlanksStrategy } from './strategies/BlanksStrategy';
import { GangUploadStrategy } from './strategies/GangUploadStrategy';
import { UvBySizeStrategy } from './strategies/UvBySizeStrategy';
import { UvGangUploadStrategy } from './strategies/UvGangUploadStrategy';

/**
 * Strategy registry
 * Maps product family types to their corresponding strategy implementations
 */
const STRATEGY_REGISTRY: Record<ProductFamily, ProductStrategy> = {
  by_size: BySizeStrategy,
  uv_by_size: UvBySizeStrategy,         // P2-05: UV by-size strategy
  gang_upload: GangUploadStrategy,      // P2-04: DTF gang sheet upload
  uv_gang_upload: UvGangUploadStrategy, // P2-05: UV gang sheet upload
  gang_builder: BlanksStrategy,         // TODO: Replace with GangBuilderStrategy in future
  blanks: BlanksStrategy,
  generic: BlanksStrategy,              // Fallback to blanks strategy for backward compatibility
};

/**
 * Resolve the appropriate product strategy based on product family
 *
 * Strategy selection priority:
 * 1. product.productFamily (database field - primary source)
 * 2. Heuristics based on product properties (fallback)
 * 3. Default to 'blanks' strategy as safe fallback
 */
export function resolveProductStrategy(product: Product): ProductStrategy {
  // Try database productFamily field first
  const family = normalizeProductFamily(product.productFamily);
  if (family && family in STRATEGY_REGISTRY) {
    return STRATEGY_REGISTRY[family];
  }

  // Heuristic fallback for products without explicit family
  const inferredFamily = inferProductFamily(product);
  return STRATEGY_REGISTRY[inferredFamily];
}

/**
 * Normalize database ProductFamily values to our strategy keys
 * Database uses uppercase (BY_SIZE), strategies use lowercase (by_size)
 */
function normalizeProductFamily(dbFamily: string): ProductFamily | null {
  if (!dbFamily) return null;

  const normalized = dbFamily.toLowerCase().replace(/_/g, '_');

  // Map database families to strategy families
  const mapping: Record<string, ProductFamily> = {
    'by_size': 'by_size',
    'uv_by_size': 'uv_by_size',        // P2-05: UV by-size has its own strategy
    'gang_upload': 'gang_upload',
    'uv_gang_upload': 'uv_gang_upload', // P2-05: UV gang upload has its own strategy
    'gang_builder': 'gang_builder',
    'uv_gang_builder': 'gang_builder', // TODO: UV gang builder (future)
    'blanks': 'blanks',
  };

  return mapping[normalized] || null;
}

/**
 * Infer product family from product properties when not explicitly set
 * This provides backward compatibility for existing products
 */
function inferProductFamily(product: Product): ProductFamily {
  // Check for gang sheet indicators
  if (product.name?.toLowerCase().includes('gang sheet')) {
    return 'gang_upload';
  }

  // Check for by-size indicators (e.g., "10x10", "12x12" in name or variants)
  const hasSizePattern = /\d+x\d+/.test(product.name || '');
  if (hasSizePattern) {
    return 'by_size';
  }

  // Check for blanks indicators (physical apparel)
  const blanksKeywords = ['t-shirt', 'tshirt', 'hoodie', 'sweatshirt', 'blanks'];
  const isBlanks = blanksKeywords.some(keyword =>
    product.name?.toLowerCase().includes(keyword) ||
    product.description?.toLowerCase().includes(keyword)
  );
  if (isBlanks) {
    return 'blanks';
  }

  // Default fallback
  return 'generic';
}

/**
 * Get the product family for a given product (useful for analytics, routing, etc)
 */
export function getProductFamily(product: Product): ProductFamily {
  const family = normalizeProductFamily(product.productFamily);
  if (family && family in STRATEGY_REGISTRY) {
    return family;
  }

  return inferProductFamily(product);
}
