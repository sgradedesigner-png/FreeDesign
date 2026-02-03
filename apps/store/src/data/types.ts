// Product Variant Type
export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  originalPrice: number | null;
  sizes: string[];
  imagePath: string;
  galleryPaths: string[];
  stock: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

// Backend Product with Variants
export type BackendProduct = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  basePrice: number;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  variants: ProductVariant[];
  rating: number;
  reviews: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
};

// Frontend Product Type (for compatibility)
export type Product = {
  id: string;
  slug: string;
  name: string; // Maps to title
  category: string;
  description: string | null;
  rating: number;
  reviews: number;
  features: string[];

  // Variant-based properties
  variants: ProductVariant[];

  // Computed properties for backward compatibility
  price: number; // First variant price
  originalPrice: number | null; // First variant originalPrice
  colors: string[]; // Variant names
  sizes: string[]; // All sizes from all variants
  image_path: string; // First variant imagePath
  gallery_paths: string[]; // First variant galleryPaths

  is_new?: boolean;
  created_at?: string;
};
