import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchProductBySlug, fetchProducts } from './products.api';
import type { Product } from './products';

export const PRODUCTS_QUERY_KEY = ['products'] as const;
export const productQueryKey = (slug: string) => ['product', slug] as const;

const STALE_TIME_MS = 1000 * 60 * 2;
const GC_TIME_MS = 1000 * 60 * 10;

export function useProductsQuery() {
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchProducts,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}

export function useProductQuery(slug: string | null | undefined, initialProduct?: Product | null) {
  const canQuery = !!slug;

  return useQuery({
    queryKey: canQuery ? productQueryKey(slug!) : (['product', 'missing'] as const),
    queryFn: () => fetchProductBySlug(slug!),
    enabled: canQuery,
    initialData: canQuery ? (initialProduct ?? undefined) : undefined,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}

export function prefetchProduct(queryClient: QueryClient, slug: string) {
  if (!slug) return Promise.resolve();
  return queryClient.prefetchQuery({
    queryKey: productQueryKey(slug),
    queryFn: () => fetchProductBySlug(slug),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}

export function seedProductCache(queryClient: QueryClient, product: Product) {
  if (!product.slug) return;
  queryClient.setQueryData(productQueryKey(product.slug), product);
}
