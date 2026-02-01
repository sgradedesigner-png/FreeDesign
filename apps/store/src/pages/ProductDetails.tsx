import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { fetchProductBySlug } from '../data/products.api';
import type { Product } from '../data/products';

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
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { language } = useTheme();

  // Catalog / RelatedProducts-оос дамжсан product
  const initialProduct = (location.state as LocationState)?.product ?? null;

  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProduct);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // ✅ slug байхгүй бол fetch хийхгүй
    if (!slug) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    // Catalog-оос state-ээр ирсэн бол дахиж fetch хийх шаардлагагүй
    if (initialProduct?.slug === slug) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    setLoadError(null);

    fetchProductBySlug(slug)
      .then((data) => {
        if (!isMounted) return;
        setProduct(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load product.');
        setProduct(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug, initialProduct]);

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

      <RelatedProducts />

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
