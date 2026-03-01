import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import type { Product, ProductVariant } from '../data/products';
import { PRODUCTS_QUERY_KEY, useProductQuery } from '../data/products.queries';
import { useTheme } from '../context/ThemeContext';

import { resolveProductStrategy, getProductFamily } from '../features/product-family/resolveStrategy';
import ProductGallery from '../components/product/ProductGallery';
import ProductTabs from '../components/product/ProductTabs';
import RelatedProducts from '../components/product/RelatedProducts';
import CustomerReviews from '../components/product/CustomerReviews';
import { TrustBadges, ShippingPromiseBar } from '../components/conversion';

type LocationState = { product?: Product } | null;

/**
 * ProductPage - Strategy-based product detail page
 *
 * This component replaces the monolithic ProductDetails with a flexible
 * strategy pattern that supports different UX for different product families:
 * - by_size: DTF/UV transfers with size/finishing/quantity selectors
 * - blanks: Physical apparel with variant selection
 * - gang_upload: Gang sheets with file upload
 * - gang_builder: Gang sheets with online builder
 *
 * Architecture:
 * - Loads product data via useProductQuery
 * - Resolves appropriate strategy based on product.product_family
 * - Renders shared layout blocks (gallery, tabs, reviews)
 * - Delegates product info section to strategy.renderProductInfo()
 * - Optionally delegates tabs, gallery, and conversion blocks to strategy
 */
export default function ProductPage() {
  // URL: /product/:slug
  const params = useParams<{ slug?: string; id?: string }>();
  const slugParam = params.slug ?? params.id ?? null;
  const location = useLocation();
  const { language } = useTheme();

  // Product passed via location state (from catalog/related links)
  const initialProduct = (location.state as LocationState)?.product ?? null;

  const slug = slugParam ?? initialProduct?.slug ?? null;
  const queryClient = useQueryClient();
  const cachedList = queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEY);
  const cachedProduct = slug ? cachedList?.find((p) => p.slug === slug) ?? null : null;
  const seedProduct = initialProduct?.slug === slug ? initialProduct : cachedProduct;

  const { data: product, isLoading, error } = useProductQuery(slug, seedProduct);
  const loadError =
    error instanceof Error ? error.message : error ? 'Failed to load product.' : null;

  // State to track selected variant
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product?.variants?.[0] || null
  );

  // Reset selected variant when product changes
  useEffect(() => {
    if (product) {
      setSelectedVariant(product.variants?.[0] || null);
    }
  }, [product?.id]);

  // Handle variant change from strategy
  const handleVariantChange = (variant: ProductVariant) => {
    setSelectedVariant(variant);
  };

  // Error state
  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28 text-destructive">
        {loadError}
      </div>
    );
  }

  // Loading state
  if (isLoading && !product) return <ProductPageSkeleton />;

  // Not found state
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">
          {language === 'mn' ? 'Нүүр хуудас руу буцах' : 'Return to home'}
        </Link>
      </div>
    );
  }

  // Resolve strategy based on product family
  const strategy = resolveProductStrategy(product);
  const productFamily = getProductFamily(product);

  // Get gallery images (strategy can override)
  const images = strategy.getGalleryImages
    ? strategy.getGalleryImages({ product, selectedVariant, onVariantChange: handleVariantChange })
    : getDefaultGalleryImages(product, selectedVariant);

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 pt-24 sm:pt-28 animate-in fade-in duration-500 pb-16 sm:pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-8 min-w-0">
        <Link to="/" className="hover:text-primary flex items-center gap-1 shrink-0">
          <ArrowLeft size={14} />
          {language === 'mn' ? 'Нүүр' : 'Home'}
        </Link>
        <span className="shrink-0">/</span>
        <span className="text-foreground font-medium truncate min-w-0 flex-1">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid lg:grid-cols-2 items-start gap-6 sm:gap-8 lg:gap-12 xl:gap-16 [&>*]:min-w-0">
        {/* Gallery - Left Column */}
        <ProductGallery
          key={`${product.id}-gallery`}
          images={images}
          name={product.name}
        />

        {/* Product Info - Right Column (Strategy-driven) */}
        <div className="space-y-6">
          {strategy.renderProductInfo({
            product,
            selectedVariant,
            onVariantChange: handleVariantChange,
          })}

          {/* Conversion Modules */}
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Shipping Promise */}
            <ShippingPromiseBar cutoffHour={15} showCountdown />

            {/* Trust Badges */}
            <TrustBadges variant="compact" />
          </div>

          {/* Optional: Strategy-specific conversion blocks */}
          {strategy.renderConversionBlocks?.({
            product,
            selectedVariant,
            onVariantChange: handleVariantChange,
          })}
        </div>
      </div>

      {/* Product Tabs */}
      {strategy.renderTabs ? (
        strategy.renderTabs({
          product,
          selectedVariant,
          onVariantChange: handleVariantChange,
        })
      ) : (
        <ProductTabs />
      )}

      {/* Related Products */}
      <RelatedProducts currentSlug={product.slug ?? slug ?? undefined} />

      {/* Customer Reviews */}
      <CustomerReviews
        reviews={[]}
        averageRating={product.rating}
        totalReviews={product.reviews}
      />

      {/* Debug info (remove in production) */}
      {import.meta.env.DEV && (
        <div className="mt-8 p-4 bg-muted/50 rounded text-xs text-muted-foreground">
          <strong>Strategy:</strong> {productFamily} | <strong>Product ID:</strong> {product.id}
        </div>
      )}
    </div>
  );
}

/**
 * Default gallery image logic (same as old ProductDetails)
 */
function getDefaultGalleryImages(product: Product, selectedVariant: ProductVariant | null): string[] {
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
}

/**
 * Loading skeleton (same as old ProductDetails)
 */
function ProductPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 pt-28 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-8" />
      <div className="grid lg:grid-cols-2 gap-12">
        <div className="aspect-[4/5] md:aspect-[4/5] lg:aspect-[3/4] rounded-2xl bg-muted" />
        <div className="space-y-4">
          <div className="h-6 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
