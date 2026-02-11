// src/pages/Catalog.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterSidebar from '../components/layout/FilterSidebar';
import ProductCard from '../components/product/ProductCard';
import { useProductsQuery } from '../data/products.queries';
import { useCategoriesQuery } from '../data/categories.queries';
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

const normalizeCategoryKey = (value: string | null | undefined) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export default function Catalog() {
  const { language } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search')?.toLowerCase() || '';
  const categoryFromUrl = normalizeCategoryKey(searchParams.get('category')) || null;

  const { data: products = [], isLoading, error } = useProductsQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const loadError =
    error instanceof Error ? error.message : error ? 'Failed to load products.' : null;

  const validCategorySlugs = useMemo(
    () =>
      new Set(
        categories
          .map((category) => normalizeCategoryKey(category.slug))
          .filter((slug): slug is string => Boolean(slug))
      ),
    [categories]
  );

  const activeCategoryFromUrl = useMemo(() => {
    if (!categoryFromUrl) return null;
    if (validCategorySlugs.size === 0) return categoryFromUrl;
    return validCategorySlugs.has(categoryFromUrl) ? categoryFromUrl : null;
  }, [categoryFromUrl, validCategorySlugs]);

  const maxCatalogPrice = useMemo(() => {
    const highest = products.reduce((acc, product) => {
      const price = Number.isFinite(product.price) ? product.price : 0;
      return Math.max(acc, price);
    }, 0);

    return Math.max(1000, Math.ceil(highest / 1000) * 1000);
  }, [products]);

  const [filters, setFilters] = useState<Filters>({
    priceRange: [0, maxCatalogPrice],
    sizes: [],
    categories: activeCategoryFromUrl ? [activeCategoryFromUrl] : [],
  });

  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  useEffect(() => {
    const nextCategories = activeCategoryFromUrl ? [activeCategoryFromUrl] : [];

    setFilters((prev) => {
      const prevCategories = prev.categories
        .map((category) => normalizeCategoryKey(category))
        .filter((category): category is string => Boolean(category));
      const hasSameCategories =
        prevCategories.length === nextCategories.length &&
        prevCategories.every((category, index) => category === nextCategories[index]);

      if (hasSameCategories) return prev;
      return { ...prev, categories: nextCategories };
    });
  }, [activeCategoryFromUrl]);

  useEffect(() => {
    const normalizedSelected = filters.categories
      .map((category) => normalizeCategoryKey(category))
      .filter((category): category is string => Boolean(category));
    const nextCategory = normalizedSelected[0] ?? null;
    const currentCategory = normalizeCategoryKey(searchParams.get('category')) || null;

    if (nextCategory === currentCategory) return;

    const nextParams = new URLSearchParams(searchParams);
    if (nextCategory) {
      nextParams.set('category', nextCategory);
    } else {
      nextParams.delete('category');
    }
    setSearchParams(nextParams, { replace: true });
  }, [filters.categories, searchParams, setSearchParams]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery) ||
        product.category.toLowerCase().includes(searchQuery);

      const matchesPrice =
        product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1];

      const categoryKeys = [
        normalizeCategoryKey(product.categorySlug),
        normalizeCategoryKey(product.category),
      ].filter(Boolean);

      const matchesCategory =
        filters.categories.length === 0 ||
        filters.categories.some((selectedKey) =>
          categoryKeys.includes(normalizeCategoryKey(selectedKey))
        );

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 pt-28">
      <div className="flex flex-col lg:flex-row gap-8">
        <FilterSidebar
          onFilterChange={handleFilterChange}
          maxPrice={maxCatalogPrice}
          activeCategories={filters.categories}
        />

        <div className="flex-1 min-w-0">
          {/* Header хэсэг хэвээрээ... */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-3xl font-heading font-bold text-foreground">{title}</h1>
              {!isLoading && !loadError && (
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredProducts.length} {language === 'mn' ? 'бараа' : 'items'}
                </p>
              )}
            </div>

            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="h-10 w-full sm:w-[220px] rounded-xl border-white/10 bg-white/5 text-sm text-foreground">
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
            <div data-testid="products-loading" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-white/5 rounded-2xl" />
              ))}
            </div>
          ) : loadError ? (
            <div data-testid="products-error" className="text-center py-12">
              <p className="text-red-500 mb-4">{loadError}</p>
              <button
                data-testid="retry-products-btn"
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                {language === 'mn' ? 'Дахин оролдох' : 'Retry'}
              </button>
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
