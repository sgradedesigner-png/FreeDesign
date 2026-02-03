import { useLocation, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '../data/products';
import { PRODUCTS_QUERY_KEY, useProductQuery } from '../data/products.queries';

import ProductGallery from '../components/product/ProductGallery';
import ProductInfo from '../components/product/ProductInfo';
import CustomerReviews from '../components/product/CustomerReviews';
import ProductTabs from '../components/product/ProductTabs';
import RelatedProducts from '../components/product/RelatedProducts';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type LocationState = { product?: Product } | null;

export default function ProductDetails() {
  // 👉 URL: /product/:slug
  const params = useParams<{ slug?: string; id?: string }>();
  const slugParam = params.slug ?? params.id ?? null;
  const location = useLocation();
  const { language } = useTheme();

  // Catalog / RelatedProducts-оос дамжсан product
  const initialProduct = (location.state as LocationState)?.product ?? null;

  const slug = slugParam ?? initialProduct?.slug ?? null;
  const queryClient = useQueryClient();
  const cachedList = queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEY);
  const cachedProduct = slug ? cachedList?.find((p) => p.slug === slug) ?? null : null;
  const seedProduct = initialProduct?.slug === slug ? initialProduct : cachedProduct;

  const { data: product, isLoading, error } = useProductQuery(slug, seedProduct);
  const loadError =
    error instanceof Error ? error.message : error ? 'Failed to load product.' : null;

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28 text-destructive">
        {loadError}
      </div>
    );
  }

  if (isLoading && !product) return <ProductDetailsSkeleton />;

  if (!product) {
    return <div className="container mx-auto px-4 py-8 pt-28">Not Found</div>;
  }

  // ✅ Gallery images
  const images =
    product.gallery_paths?.length
      ? product.gallery_paths
      : product.image_path
      ? [product.image_path]
      : [];

  return (
    <div className="container mx-auto px-4 py-8 pt-28 animate-in fade-in duration-500 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft size={14} />
          {language === 'mn' ? 'Нүүр' : 'Home'}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{product.name}</span>
      </div>

      {/* Top */}
      <div className="grid lg:grid-cols-2 gap-12 xl:gap-20">
        <ProductGallery images={images} name={product.name} />
        <ProductInfo product={product} />
      </div>

      <ProductTabs />

      <RelatedProducts currentSlug={product.slug ?? slug ?? undefined} />

      <CustomerReviews
        reviews={[]}
        averageRating={product.rating}
        totalReviews={product.reviews}
      />
    </div>
  );
}

function ProductDetailsSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 pt-28 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-8" />
      <div className="grid lg:grid-cols-2 gap-12">
        <div className="aspect-[3/4] rounded-2xl bg-muted" />
        <div className="space-y-4">
          <div className="h-6 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
