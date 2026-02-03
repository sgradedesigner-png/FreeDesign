// src/data/products.api.ts
import type { BackendProduct } from "../data/types";
import { mapProductFromBackend, type Product } from "./products";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fetch products from backend API
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_URL}/api/products`);

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }

  const data = await response.json();
  return (data ?? []).map((row: BackendProduct) => mapProductFromBackend(row));
}

// Fetch product by slug from backend API
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;

  const response = await fetch(`${API_URL}/api/products/${slug}`);

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }

  const data = await response.json();
  return data ? mapProductFromBackend(data as BackendProduct) : null;
}
