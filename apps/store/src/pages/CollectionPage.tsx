import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '@/components/product/ProductCard';
import FilterSidebar from '@/components/layout/FilterSidebar';
import { useProductsQuery } from '@/data/products.queries';
import { useCollectionQuery } from '@/data/collections.api';
import type { ProductFamily } from '@/data/types';
import { useTheme } from '@/context/ThemeContext';
import { Sentry } from '@/lib/sentry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CollectionDef = {
  family: ProductFamily;
  title: { mn: string; en: string };
  description: { mn: string; en: string };
};

type Filters = {
  priceRange: [number, number];
  sizes: string[];
  categories: string[];
};

// Hardcoded family collections for backward compatibility
const familyCollections: Record<string, CollectionDef> = {
  'dtf-by-size': {
    family: 'BY_SIZE',
    title: { mn: 'DTF Transfer (Хэмжээгээр)', en: 'DTF Transfers (By Size)' },
    description: {
      mn: 'Хэмжээ, хувилбар сонгоод захиалгад нэмнэ.',
      en: 'Select size/variant and add to cart.',
    },
  },
  'dtf-gang-upload': {
    family: 'GANG_UPLOAD',
    title: { mn: 'DTF Gang Sheet (Upload)', en: 'DTF Gang Sheet (Upload)' },
    description: {
      mn: 'Бэлэн файлаа upload хийгээд үргэлжлүүлнэ.',
      en: 'Upload a ready-to-print file and continue.',
    },
  },
  'dtf-gang-builder': {
    family: 'GANG_BUILDER',
    title: { mn: 'DTF Gang Sheet (Builder)', en: 'DTF Gang Sheet (Builder)' },
    description: {
      mn: 'Онлайн builder (MVP) урсгал.',
      en: 'Online builder (MVP) flow.',
    },
  },
  'uv-by-size': {
    family: 'UV_BY_SIZE',
    title: { mn: 'UV DTF (Хэмжээгээр)', en: 'UV DTF (By Size)' },
    description: {
      mn: 'UV transfer бүтээгдэхүүнүүд.',
      en: 'UV transfer products.',
    },
  },
  'uv-gang-upload': {
    family: 'UV_GANG_UPLOAD',
    title: { mn: 'UV Gang Sheet (Upload)', en: 'UV Gang Sheet (Upload)' },
    description: {
      mn: 'UV gang sheet upload урсгал.',
      en: 'UV gang sheet upload flow.',
    },
  },
  'uv-gang-builder': {
    family: 'UV_GANG_BUILDER',
    title: { mn: 'UV Gang Sheet (Builder)', en: 'UV Gang Sheet (Builder)' },
    description: {
      mn: 'UV builder (MVP) урсгал.',
      en: 'UV builder (MVP) flow.',
    },
  },
  blanks: {
    family: 'BLANKS',
    title: { mn: 'Blanks', en: 'Blanks' },
    description: {
      mn: 'Цамц, hoodie, sweatshirt зэрэг үндсэн бараанууд.',
      en: 'Core apparel blanks (shirts, hoodies, sweatshirts).',
    },
  },
};

export default function CollectionPage() {
  const { slug } = useParams();
  const { language } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const key = (slug || '').trim();
  const familyDef = key ? familyCollections[key] : null;

  // Try to fetch from database-backed collections
  const { data: dbCollection, isLoading: isLoadingCollection } = useCollectionQuery(
    key,
    { sort: undefined } // We'll apply sorting client-side for consistency
  );

  // Fallback to all products for family-based filtering
  const { data: allProducts = [], isLoading: isLoadingProducts } = useProductsQuery();

  // Determine which data source to use
  const useDbCollection = !familyDef && dbCollection;
  const products = useDbCollection ? dbCollection.products : allProducts;
  const isLoading = useDbCollection ? isLoadingCollection : isLoadingProducts;

  // Calculate max price
  const maxCatalogPrice = useMemo(() => {
    const highest = products.reduce((acc, product) => {
      const price = Number.isFinite(product.price) ? product.price : 0;
      return Math.max(acc, price);
    }, 0);
    return Math.max(1000, Math.ceil(highest / 1000) * 1000);
  }, [products]);

  // Filters state
  const [filters, setFilters] = useState<Filters>({
    priceRange: [0, maxCatalogPrice],
    sizes: [],
    categories: [],
  });

  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  // Sync sort with query params
  useEffect(() => {
    const sortParam = searchParams.get('sort') as 'newest' | 'price-low' | 'price-high' | null;
    if (sortParam && ['newest', 'price-low', 'price-high'].includes(sortParam)) {
      setSortBy(sortParam);
    }
  }, [searchParams]);

  // Update query params when sort changes
  useEffect(() => {
    const currentSort = searchParams.get('sort');
    if (sortBy !== currentSort) {
      const nextParams = new URLSearchParams(searchParams);
      if (sortBy === 'newest') {
        nextParams.delete('sort');
      } else {
        nextParams.set('sort', sortBy);
      }
      setSearchParams(nextParams, { replace: true });
    }
  }, [sortBy, searchParams, setSearchParams]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products;

    // Apply family filter for hardcoded collections
    if (familyDef) {
      result = result.filter((p) => p.productFamily === familyDef.family);
    }

    // Apply price filter
    result = result.filter(
      (p) => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    );

    // Apply size filter
    if (filters.sizes.length > 0) {
      result = result.filter((p) => p.sizes?.some((s) => filters.sizes.includes(s)));
    }

    // Apply sorting
    if (sortBy === 'price-low') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else {
      result = [...result].sort((a, b) => (b.is_new === a.is_new ? 0 : b.is_new ? 1 : -1));
    }

    return result;
  }, [products, familyDef, filters, sortBy]);

  const handleFilterChange = useCallback((next: Filters) => {
    setFilters(next);
  }, []);

  useEffect(() => {
    if (familyDef?.family) {
      Sentry.setTag('product_family', familyDef.family);
    }
  }, [familyDef?.family]);

  // Determine title and description
  const title = familyDef
    ? language === 'mn'
      ? familyDef.title.mn
      : familyDef.title.en
    : dbCollection?.name || (language === 'mn' ? 'Цуглуулга' : 'Collection');

  const description = familyDef
    ? language === 'mn'
      ? familyDef.description.mn
      : familyDef.description.en
    : dbCollection?.description || '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 pt-28">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter Sidebar */}
        <FilterSidebar
          onFilterChange={handleFilterChange}
          maxPrice={maxCatalogPrice}
          activeCategories={filters.categories}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-heading font-bold text-foreground">{title}</h1>
                <Link
                  to="/start-order"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {language === 'mn' ? '← Буцах' : '← Back'}
                </Link>
              </div>
              {description && (
                <p className="text-sm text-muted-foreground mb-2">{description}</p>
              )}
              {!isLoading && (
                <p className="text-sm text-muted-foreground">
                  {filteredProducts.length} {language === 'mn' ? 'бараа' : 'items'}
                </p>
              )}
            </div>

            {/* Sort Selector */}
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="h-10 w-full sm:w-[220px] rounded-xl border-border bg-background text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  {language === 'mn' ? 'Шинэ' : 'Newest'}
                </SelectItem>
                <SelectItem value="price-low">
                  {language === 'mn' ? 'Үнэ: бага → их' : 'Price: Low to High'}
                </SelectItem>
                <SelectItem value="price-high">
                  {language === 'mn' ? 'Үнэ: их → бага' : 'Price: High to Low'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div
              data-testid="products-loading"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse"
            >
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-muted rounded-2xl" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {language === 'mn'
                  ? 'Энд одоогоор бүтээгдэхүүн алга.'
                  : 'No products found for this collection.'}
              </p>
              <Link
                to="/products"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {language === 'mn' ? 'Каталогоор үзэх' : 'Browse Catalog'}
              </Link>
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
