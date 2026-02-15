import type { Product } from '../../data/products';
import type { ProductFamily, ProductStrategy } from './types';
import { BySizeStrategy } from './strategies/BySizeStrategy';
import { BlanksStrategy } from './strategies/BlanksStrategy';

/**
 * Strategy registry
 * Maps product family types to their corresponding strategy implementations
 */
const STRATEGY_REGISTRY: Record<ProductFamily, ProductStrategy> = {
  by_size: BySizeStrategy,
  gang_upload: BlanksStrategy,      // TODO: Replace with GangUploadStrategy in P1-04
  gang_builder: BlanksStrategy,     // TODO: Replace with GangBuilderStrategy in future
  blanks: BlanksStrategy,
  generic: BlanksStrategy,          // Fallback to blanks strategy for backward compatibility
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
    'uv_by_size': 'by_size',           // UV by-size uses same strategy
    'gang_upload': 'gang_upload',
    'uv_gang_upload': 'gang_upload',   // UV gang upload uses same strategy
    'gang_builder': 'gang_builder',
    'uv_gang_builder': 'gang_builder', // UV gang builder uses same strategy
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
