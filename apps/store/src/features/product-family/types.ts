import type { Product, ProductVariant } from '../../data/products';
import type { ReactElement } from 'react';

/**
 * Product Family Types
 * Defines the different product families supported by the system
 */
export type ProductFamily =
  | 'by_size'           // DTF transfers sold by size (fabric)
  | 'uv_by_size'        // UV transfers sold by size (hard surfaces)
  | 'gang_upload'       // DTF gang sheet upload (fabric)
  | 'uv_gang_upload'    // UV gang sheet upload (hard surfaces)
  | 'gang_builder'      // Gang sheet built with online tool
  | 'blanks'            // Physical items (t-shirts, hoodies)
  | 'generic';          // Fallback for uncategorized products

/**
 * Product Strategy Props
 * Common props passed to all product page strategies
 */
export interface ProductStrategyProps {
  product: Product;
  selectedVariant: ProductVariant | null;
  onVariantChange: (variant: ProductVariant) => void;
}

/**
 * Product Strategy Interface
 * Each product family implements this interface to customize the product page experience
 */
export interface ProductStrategy {
  /**
   * Render the main product information section (pricing, options, CTA)
   * This appears in the right column on desktop, below gallery on mobile
   */
  renderProductInfo: (props: ProductStrategyProps) => ReactElement;

  /**
   * Optional: Render custom product tabs
   * If not provided, uses default tabs (Description, Specs, etc)
   */
  renderTabs?: (props: ProductStrategyProps) => ReactElement;

  /**
   * Optional: Customize the gallery behavior
   * Most strategies use default gallery, but some may need special handling
   */
  getGalleryImages?: (props: ProductStrategyProps) => string[];

  /**
   * Optional: Add custom conversion blocks (trust badges, urgency, etc)
   * Rendered below the main product info
   */
  renderConversionBlocks?: (props: ProductStrategyProps) => ReactElement | null;
}

/**
 * Product metadata that determines which strategy to use
 * This should be included in the Product payload from backend
 */
export interface ProductFamilyMetadata {
  family: ProductFamily;
  familyConfig?: Record<string, unknown>; // Strategy-specific config
}
