import type { BackendProduct, Product, ProductVariant } from './types';

const NEW_PRODUCT_WINDOW_DAYS = 30;

// Export Product type from types.ts
export type { Product, ProductVariant } from './types';

// Backend product mapper with variant support
export const mapProductFromBackend = (row: BackendProduct): Product => {
  const createdAtMs = row.createdAt ? Date.parse(row.createdAt) : null;
  const isNewByDate =
    createdAtMs && !Number.isNaN(createdAtMs)
      ? Date.now() - createdAtMs <= NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000
      : false;

  // Get variants (sorted by sortOrder)
  const variants = row.variants || [];
  const sortedVariants = [...variants].sort((a, b) => a.sortOrder - b.sortOrder);

  // Use first variant for default/compatibility values
  const firstVariant = sortedVariants[0];

  // Collect all unique sizes from all variants
  const allSizes = Array.from(
    new Set(sortedVariants.flatMap((v) => v.sizes || []))
  );

  // Variant names as "colors" for compatibility
  const variantNames = sortedVariants.map((v) => v.name);

  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    subtitle: row.subtitle || '',
    category: row.category?.name || 'Uncategorized',
    categoryId: row.category?.id || row.categoryId,
    categorySlug: row.category?.slug || '',
    description: row.description || '',
    shortDescription: row.shortDescription || row.description || '',
    rating: row.rating || 0,
    reviews: row.reviews || 0,
    features: row.features || [],
    benefits: row.benefits || [],
    productDetails: row.productDetails || [],
    productFamily: row.productFamily || 'BLANKS',
    productSubfamily: row.productSubfamily ?? null,
    requiresUpload: Boolean(row.requiresUpload),
    requiresBuilder: Boolean(row.requiresBuilder),
    uploadProfileId: row.uploadProfileId ?? null,

    // Variant data
    variants: sortedVariants.map((v) => ({
      ...v,
      price: typeof v.price === 'string' ? parseFloat(v.price) : v.price,
      originalPrice:
        v.originalPrice && typeof v.originalPrice === 'string'
          ? parseFloat(v.originalPrice)
          : v.originalPrice,
    })),

    // Computed properties from first variant (for backward compatibility)
    price: firstVariant
      ? typeof firstVariant.price === 'string'
        ? parseFloat(firstVariant.price)
        : firstVariant.price
      : row.basePrice || 0,
    originalPrice: firstVariant?.originalPrice
      ? typeof firstVariant.originalPrice === 'string'
        ? parseFloat(firstVariant.originalPrice)
        : firstVariant.originalPrice
      : null,
    image_path: firstVariant?.imagePath || '',
    gallery_paths: firstVariant?.galleryPaths || [],
    colors: variantNames,
    sizes: allSizes,

    is_new: isNewByDate,
    created_at: row.createdAt,
    isCustomizable: Boolean(row.isCustomizable),
    mockupImagePath: row.mockupImagePath || null,
  };
};

