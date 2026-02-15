import type { ProductStrategy, ProductStrategyProps } from '../types';
import ProductInfo from '../../../components/product/ProductInfo';

/**
 * Blanks Strategy
 * Handles physical apparel and merchandise (t-shirts, hoodies, sweatshirts)
 *
 * Key features:
 * - Variant-based selection (size, color combinations)
 * - Standard pricing per variant
 * - Stock availability display
 * - Add to cart with selected variant
 */
export const BlanksStrategy: ProductStrategy = {
  /**
   * Render product info using the existing ProductInfo component
   * This maintains backward compatibility with existing blanks products
   */
  renderProductInfo: ({ product, onVariantChange }: ProductStrategyProps) => {
    return (
      <ProductInfo
        product={product}
        onVariantChange={onVariantChange}
      />
    );
  },

  /**
   * Use default gallery behavior (variant images or product gallery)
   */
  getGalleryImages: ({ product, selectedVariant }) => {
    // Prefer variant-specific images
    if (selectedVariant) {
      if (selectedVariant.galleryPaths?.length) {
        return selectedVariant.galleryPaths;
      }
      if (selectedVariant.imagePath) {
        return [selectedVariant.imagePath];
      }
    }

    // Fallback to product-level gallery
    if (product.gallery_paths?.length) {
      return product.gallery_paths;
    }
    if (product.image_path) {
      return [product.image_path];
    }

    return [];
  },

  // Use default tabs (no override needed)
  // Use default conversion blocks (no override needed)
};
