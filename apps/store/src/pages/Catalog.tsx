// src/pages/Catalog.tsx
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import FilterSidebar from '../components/layout/FilterSidebar';
import type { Product } from '../data/products';
import { prefetchProduct, seedProductCache, useProductsQuery } from '../data/products.queries';
import { useCart } from '../context/CartContext'; // ✅ useCart нэмсэн
import { useTheme } from '../context/ThemeContext';
import { r2Url } from "@/lib/r2";
import { Eye, ShoppingBag } from 'lucide-react'; // ✅ Иконууд нэмсэн

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Filters = {
  priceRange: [number, number];
  sizes: string[];
  categories: string[];
};

const PLACEHOLDER_IMG = 'https://placehold.co/800x1000/png?text=No+Image';

export default function Catalog() {
  const { addItem, setIsCartOpen } = useCart(); // ✅ Сагсанд нэмэх функц авсан
  const { language } = useTheme();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search')?.toLowerCase() || '';

  const { data: products = [], isLoading, error } = useProductsQuery();
  const loadError =
    error instanceof Error ? error.message : error ? 'Failed to load products.' : null;

  const [filters, setFilters] = useState<Filters>({
    priceRange: [0, 1000],
    sizes: [],
    categories: [],
  });

  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  const handlePrefetch = useCallback(
    (product: Product) => {
      if (!product.slug) return;
      seedProductCache(queryClient, product);
      prefetchProduct(queryClient, product.slug);
    },
    [queryClient]
  );

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery) ||
        product.category.toLowerCase().includes(searchQuery);

      const matchesPrice =
        product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1];

      const matchesCategory =
        filters.categories.length === 0 || filters.categories.includes(product.category);

      const matchesSize =
        filters.sizes.length === 0 || (product.sizes?.some((s) => filters.sizes.includes(s)) ?? false);

      return matchesSearch && matchesPrice && matchesCategory && matchesSize;
    });

    if (sortBy === 'price-low') result.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high') result.sort((a, b) => b.price - a.price);
    else result.sort((a, b) => (b.isNew === a.isNew ? 0 : b.isNew ? 1 : -1));

    return result;
  }, [products, searchQuery, filters, sortBy]);

  const handleFilterChange = useCallback((next: Filters) => {
    setFilters(next);
  }, []);

  const title = searchQuery
    ? `"${searchQuery}"`
    : language === 'mn' ? 'Манай Бүтээгдэхүүнүүд' : 'Our Products';

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pt-28">
      <div className="flex gap-8">
        <FilterSidebar onFilterChange={handleFilterChange} />

        <div className="flex-1 min-w-0">
          {/* Header хэсэг хэвээрээ... */}
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-3xl font-heading font-bold text-foreground">{title}</h1>
              {!isLoading && !loadError && (
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredProducts.length} {language === 'mn' ? 'бараа' : 'items'}
                </p>
              )}
            </div>

            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="h-10 w-[220px] rounded-xl border-white/10 bg-white/5 text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{language === 'mn' ? 'Шинэ' : 'Newest'}</SelectItem>
                <SelectItem value="price-low">{language === 'mn' ? 'Үнэ: бага → их' : 'Price: Low to High'}</SelectItem>
                <SelectItem value="price-high">{language === 'mn' ? 'Үнэ: их → бага' : 'Price: High to Low'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-white/5 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map((product) => {
                const imgSrc = r2Url(product.image_path ?? product.gallery_paths?.[0] ?? "") || PLACEHOLDER_IMG;

                return (
                  <div
                    key={product.uuid}
                    className="group relative rounded-3xl overflow-hidden flex flex-col transition-all duration-500
                 bg-card text-card-foreground border border-border/40
                 hover:shadow-2xl hover:shadow-primary/10"
                  >

                    {/* Зургийн хэсэг */}
                    <div className="relative aspect-[4/5] overflow-hidden bg-muted/20">
                      <Link
                        to={`/product/${product.slug}`}
                        state={{ product }}
                        className="block w-full h-full cursor-pointer"
                        onMouseEnter={() => handlePrefetch(product)}
                        onFocus={() => handlePrefetch(product)}
                      >
                        <img
                          src={imgSrc}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                        />
                      </Link>

                      {/* 1-Р ЗУРАГ ШИГ ХӨВЖ БУЙ ТОВЧНУУДУУД (Overlay) */}
                      <div className="absolute inset-x-4 bottom-4 flex gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out z-20">

                        {/* Дэлгэрэнгүй товч */}
                        <Link
                          to={`/product/${product.slug}`}
                          state={{ product }}
                          className="flex-1 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center font-bold text-[11px] tracking-wider shadow-lg hover:bg-slate-100 transition-colors"
                          onMouseEnter={() => handlePrefetch(product)}
                          onFocus={() => handlePrefetch(product)}
                        >
                          {language === 'mn' ? 'ДЭЛГЭРЭНГҮЙ' : 'VIEW DETAILS'}
                        </Link>

                        {/* Сагсанд нэмэх товч */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            addItem(product, product.colors?.[0] ?? null, product.sizes?.[0] ?? null);
                            //setIsCartOpen(true); // хүсвэл нэмэхэд сагсаа нээ

                          }}
                          className="w-12 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-primary hover:text-white transition-all duration-300"
                          title="Сагсанд нэмэх"
                        >
                          <ShoppingBag size={20} />
                        </button>
                      </div>

                      {/* Dark overlay on hover (Зургийг бага зэрэг бараантуулж товчийг тодруулна) */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>

                    {/* Барааны мэдээлэл хэсэг */}
                    <div className="p-5 flex-1 flex flex-col justify-between bg-card">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                          {product.category}
                        </p>
                        <h3 className="font-bold text-base truncate mb-2 text-foreground group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-foreground font-bold text-lg">
                          ${product.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
