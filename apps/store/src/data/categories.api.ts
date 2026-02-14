// src/data/categories.api.ts
import { supabase } from '../lib/supabase';

export type Category = {
  id: string;
  name: string;
  slug: string;
};

// Fetch public categories through policy-safe view, with legacy fallback.
export async function fetchCategories(): Promise<Category[]> {
  const primary = await supabase
    .from('v_categories_public')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (!primary.error) {
    return primary.data ?? [];
  }

  const fallback = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (fallback.error) throw fallback.error;
  return fallback.data ?? [];
}
