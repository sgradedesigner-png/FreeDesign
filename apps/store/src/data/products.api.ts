// src/data/products.api.ts
import { supabase } from "../lib/supabase";
import type { BackendProduct } from "../data/types";
import { mapProductFromBackend, type Product } from "./products";

// ✅ Шинэ backend schema ашиглана (products table + categories join)
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      title,
      slug,
      description,
      price,
      stock,
      images,
      categoryId,
      category:categories (
        id,
        name,
        slug
      ),
      createdAt,
      updatedAt
    `)
    .order("createdAt", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapProductFromBackend(row as any as BackendProduct));
}

// Slug-аар бүтээгдэхүүн хайх
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      title,
      slug,
      description,
      price,
      stock,
      images,
      categoryId,
      category:categories (
        id,
        name,
        slug
      ),
      createdAt,
      updatedAt
    `)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProductFromBackend(data as any as BackendProduct) : null;
}
