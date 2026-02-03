import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '../components/product/ProductCard';
import { useTheme } from '../context/ThemeContext';
import { ArrowRight, Package, Shield, Truck, CreditCard } from 'lucide-react';
import { mapProductFromBackend, type Product } from '../data/products';
import type { BackendProduct } from '../data/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Category = {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
};

export default function HomePage() {
  const { language } = useTheme();

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/categories`);
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

      {/* 2. Category Quick Access */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
            {language === 'mn' ? 'Ангилал' : 'Shop by Category'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'mn' ? 'Өөрт таалагдсан ангиллаа сонгоно уу' : 'Find what you love faster'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.slug}`}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 text-center"
            >
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="text-emerald-400" size={32} />
                </div>
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              {category.productCount !== undefined && (
                <p className="text-sm text-muted-foreground mt-1">
                  {category.productCount} {language === 'mn' ? 'бараа' : 'items'}
                </p>
              )}
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            {language === 'mn' ? 'Бүгдийг харах' : 'View All Categories'}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* 3. Trending Products */}
      <section className="max-w-7xl mx-auto px-6 py-20 bg-muted/20">
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

      {/* 4. New Arrivals */}
      <section className="max-w-7xl mx-auto px-6 py-20">
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

      {/* 5. Trust Badges */}
      <section className="max-w-7xl mx-auto px-6 py-20 bg-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center p-8 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Truck className="text-emerald-400" size={32} />
            </div>
            <h3 className="font-bold text-foreground mb-2">
              {language === 'mn' ? 'Үнэгүй хүргэлт' : 'Free Shipping'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'mn' ? '50,000₮-с дээш худалдан авалтад' : 'On orders over $50'}
            </p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Shield className="text-cyan-400" size={32} />
            </div>
            <h3 className="font-bold text-foreground mb-2">
              {language === 'mn' ? 'Баталгаатай' : 'Secure Payment'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'mn' ? '100% аюулгүй төлбөр' : '100% secure transactions'}
            </p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
              <CreditCard className="text-purple-400" size={32} />
            </div>
            <h3 className="font-bold text-foreground mb-2">
              {language === 'mn' ? 'Олон төрлийн төлбөр' : 'Easy Returns'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'mn' ? '30 хоногийн буцаалтын баталгаа' : '30-day return guarantee'}
            </p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Package className="text-pink-400" size={32} />
            </div>
            <h3 className="font-bold text-foreground mb-2">
              {language === 'mn' ? 'Жинхэнэ бараа' : 'Authentic Products'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'mn' ? '100% жинхэнэ солонгос бараа' : '100% authentic Korean goods'}
            </p>
          </div>
        </div>
      </section>

      {/* 6. Final CTA Banner */}
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
