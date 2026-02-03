// src/data/categories.queries.ts
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from './categories.api';

export const CATEGORIES_QUERY_KEY = ['categories'] as const;

const STALE_TIME_MS = 1000 * 60 * 5; // 5 minutes
const GC_TIME_MS = 1000 * 60 * 15; // 15 minutes

export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}
