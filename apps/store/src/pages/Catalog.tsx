// src/pages/Catalog.tsx
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterSidebar from '../components/layout/FilterSidebar';
import ProductCard from '../components/product/ProductCard';
import { useProductsQuery } from '../data/products.queries';
import { useTheme } from '../context/ThemeContext';

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

export default function Catalog() {
  const { language } = useTheme();
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
    else result.sort((a, b) => (b.is_new === a.is_new ? 0 : b.is_new ? 1 : -1));


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
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
