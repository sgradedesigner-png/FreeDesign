import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/product/ProductCard';
import HomeCategoryShowcase from '../components/home/HomeCategoryShowcase';
import HomeMobileProductRail from '../components/home/HomeMobileProductRail';
import { useTheme } from '../context/ThemeContext';
import { ArrowRight } from 'lucide-react';
import { mapProductFromBackend, type Product } from '../data/products';
import type { BackendProduct } from '../data/types';
import { TrustBadges, ShippingPromiseBar } from '../components/conversion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type Category = {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
  previewImageUrl?: string | null;
};

type CategoryPreviewVariant = {
  imagePath?: string | null;
  image_path?: string | null;
  galleryPaths?: string[] | null;
  gallery_paths?: string[] | null;
};

type CategoryPreviewProduct = {
  categoryId?: string | null;
  category_id?: string | null;
  category?: {
    id?: string | null;
  } | null;
  imagePath?: string | null;
  image_path?: string | null;
  galleryPaths?: string[] | null;
  gallery_paths?: string[] | null;
  variants?: CategoryPreviewVariant[] | null;
};

type ProductListResponse = CategoryPreviewProduct[] | { products?: CategoryPreviewProduct[] };

export default function HomePage() {
  const { language } = useTheme();

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/products/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch trending products
  const { data: trending = [] } = useQuery<Product[]>({
    queryKey: ['trending-products'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/products/trending`);
      if (!res.ok) throw new Error('Failed to fetch trending');
      const data: BackendProduct[] = await res.json();
      return data.map(mapProductFromBackend);
    },
    staleTime: 1000 * 60 * 2,
  });

  // Fetch new arrivals
  const { data: newArrivals = [] } = useQuery<Product[]>({
    queryKey: ['new-arrivals'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/products/new-arrivals`);
      if (!res.ok) throw new Error('Failed to fetch new arrivals');
      const data: BackendProduct[] = await res.json();
      return data.map(mapProductFromBackend);
    },
    staleTime: 1000 * 60 * 2,
  });

  // Fetch products once and derive category -> preview image map on client
  const { data: categoryPreviewByCategoryId = {} } = useQuery<Record<string, string>>({
    queryKey: ['category-preview-images'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/products?limit=100&is_published=true`);
      if (!res.ok) throw new Error('Failed to fetch products for category preview');
      const data: ProductListResponse = await res.json();
      const products = Array.isArray(data) ? data : data.products ?? [];

      const previewByCategoryId: Record<string, string> = {};
      for (const product of products) {
        const categoryId = product.categoryId ?? product.category_id ?? product.category?.id;
        if (!categoryId || previewByCategoryId[categoryId]) continue;

        const firstVariant = product.variants?.[0];
        const previewImage =
          product.imagePath ??
          product.image_path ??
          product.galleryPaths?.[0] ??
          product.gallery_paths?.[0] ??
          firstVariant?.imagePath ??
          firstVariant?.image_path ??
          firstVariant?.galleryPaths?.[0] ??
          firstVariant?.gallery_paths?.[0] ??
          '';

        if (previewImage) {
          previewByCategoryId[categoryId] = previewImage;
        }
      }

      return previewByCategoryId;
    },
    staleTime: 1000 * 60 * 5,
  });

  const categoriesWithPreview = categories.map((category) => ({
    ...category,
    previewImageUrl: categoryPreviewByCategoryId[category.id] ?? null,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-background to-cyan-500/10" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <div className="inline-block mb-6">
            <span className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold border border-emerald-500/20">
              {language === 'mn' ? '🎉 Шинэ цуглуулга ирлээ' : '🎉 New Collection Arrived'}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-extrabold text-foreground mb-6 leading-tight">
            {language === 'mn' ? (
              <>
                Солонгос <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Барааны</span>
                <br />Дэлхий
              </>
            ) : (
              <>
                Premium <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Korean</span>
                <br />Products
              </>
            )}
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {language === 'mn'
              ? 'Чанар, загвар, итгэлцлээ. Солонгосын шилдэг брэндүүдийг нэг дороос.'
              : 'Quality, Style, Trust. Discover the best Korean brands all in one place.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/products"
              className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-full font-bold text-lg shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
              {language === 'mn' ? 'Худалдан авах' : 'Shop Now'}
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>

            <Link
              to="/products?filter=new"
              className="px-8 py-4 border-2 border-border hover:border-primary text-foreground hover:bg-primary/5 rounded-full font-bold text-lg transition-all duration-300"
            >
              {language === 'mn' ? 'Шинэ бараа' : 'New Arrivals'}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
            <div>
              <p className="text-4xl font-bold text-emerald-400">500+</p>
              <p className="text-sm text-muted-foreground mt-1">{language === 'mn' ? 'Бүтээгдэхүүн' : 'Products'}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-cyan-400">10K+</p>
              <p className="text-sm text-muted-foreground mt-1">{language === 'mn' ? 'Үйлчлүүлэгч' : 'Customers'}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-purple-400">99%</p>
              <p className="text-sm text-muted-foreground mt-1">{language === 'mn' ? 'Сэтгэл ханамж' : 'Satisfaction'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Category Showcase */}
      <HomeCategoryShowcase categories={categoriesWithPreview} language={language} />

      {/* 3. Mobile Product Discovery */}
      <section className="md:hidden max-w-7xl mx-auto px-6 py-16" data-testid="home-mobile-feed">
        <HomeMobileProductRail trending={trending} newArrivals={newArrivals} language={language} />
      </section>

      {/* 4. Trending Products (Desktop/Tablet) */}
      <section className="hidden md:block max-w-7xl mx-auto px-6 py-20 bg-muted/20" data-testid="home-trending-desktop">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
            🔥 {language === 'mn' ? 'Эрэлттэй бараа' : 'Trending Now'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'mn' ? 'Олон хүний сонирхож буй бараанууд' : 'Most popular products this week'}
          </p>
        </div>

        {trending.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trending.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            {language === 'mn' ? 'Мэдээлэл ачааллаж байна...' : 'Loading trending products...'}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg"
          >
            {language === 'mn' ? 'Бүгдийг харах' : 'View All Products'}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* 5. New Arrivals (Desktop/Tablet) */}
      <section className="hidden md:block max-w-7xl mx-auto px-6 py-20" data-testid="home-new-arrivals-desktop">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
            ✨ {language === 'mn' ? 'Шинэ ирсэн' : 'New Arrivals'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'mn' ? 'Хамгийн сүүлийн үеийн бүтээгдэхүүнүүд' : 'Latest additions to our collection'}
          </p>
        </div>

        {newArrivals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {newArrivals.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            {language === 'mn' ? 'Мэдээлэл ачааллаж байна...' : 'Loading new arrivals...'}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            to="/products?filter=new"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            {language === 'mn' ? 'Бүх шинэ бараа' : 'View All New Arrivals'}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* 6. Conversion Modules - Trust & Shipping */}
      <section className="max-w-7xl mx-auto px-6 py-20 bg-muted/20 space-y-8">
        {/* Shipping Promise Bar */}
        <div className="max-w-3xl mx-auto">
          <ShippingPromiseBar cutoffHour={15} showCountdown />
        </div>

        {/* Trust Badges */}
        <TrustBadges variant="default" />
      </section>

      {/* 7. Final CTA Banner */}
      <section className="relative max-w-7xl mx-auto px-6 py-20 overflow-hidden">
        <div className="relative z-10 rounded-3xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-purple-500 p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-white mb-6">
            {language === 'mn' ? 'Таны хайж байсан бараа энд байна' : 'Ready to Find Your Perfect Product?'}
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            {language === 'mn'
              ? 'Шилдэг Солонгос брэндүүдийн хамгийн сүүлийн үеийн бүтээгдэхүүнүүдийг нэг газраас олоорой.'
              : 'Explore our full collection of premium Korean products and find exactly what you need.'}
          </p>

          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-slate-900 rounded-full font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
          >
            {language === 'mn' ? 'Бүтээгдэхүүн үзэх' : 'Browse Catalog'}
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}

