import { useQuery } from '@tanstack/react-query';
import type { Product } from './products';

export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  metadata: any;
  products: Product[];
  productCount: number;
};

export type CollectionFilters = {
  size?: string;
  in_stock?: boolean;
  sort?: 'newest' | 'price-low' | 'price-high';
};

/**
 * Fetch all active collections
 */
export async function fetchCollections(): Promise<Collection[]> {
  const response = await fetch('/api/collections');
  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }
  const data = await response.json();
  return data.collections;
}

/**
 * Fetch single collection by slug with optional filters
 */
export async function fetchCollectionBySlug(
  slug: string,
  filters?: CollectionFilters
): Promise<Collection> {
  const params = new URLSearchParams();

  if (filters?.size) {
    params.append('size', filters.size);
  }
  if (filters?.in_stock !== undefined) {
    params.append('in_stock', String(filters.in_stock));
  }
  if (filters?.sort) {
    params.append('sort', filters.sort);
  }

  const url = `/api/collections/${slug}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Collection not found');
    }
    throw new Error('Failed to fetch collection');
  }

  const data = await response.json();
  return data.collection;
}

/**
 * React Query hook for fetching all collections
 */
export function useCollectionsQuery() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * React Query hook for fetching single collection with filters
 */
export function useCollectionQuery(slug: string, filters?: CollectionFilters) {
  return useQuery({
    queryKey: ['collection', slug, filters],
    queryFn: () => fetchCollectionBySlug(slug, filters),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
