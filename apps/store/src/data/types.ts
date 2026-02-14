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

export type ProductFamily =
  | 'BY_SIZE'
  | 'GANG_UPLOAD'
  | 'GANG_BUILDER'
  | 'BLANKS'
  | 'UV_BY_SIZE'
  | 'UV_GANG_UPLOAD'
  | 'UV_GANG_BUILDER';

// Backend Product with Variants
export type BackendProduct = {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  description: string | null;
  basePrice: number;
  categoryId: string;
  productFamily?: ProductFamily;
  productSubfamily?: string | null;
  requiresUpload?: boolean;
  requiresBuilder?: boolean;
  uploadProfileId?: string | null;
  isCustomizable?: boolean;
  mockupImagePath?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  variants: ProductVariant[];
  rating: number;
  reviews: number;
  features: string[];
  benefits?: string[];
  productDetails?: string[];
  shortDescription?: string;
  createdAt: string;
  updatedAt: string;
};

// Frontend Product Type (for compatibility)
export type Product = {
  id: string;
  slug: string;
  name: string; // Maps to title
  subtitle?: string;
  category: string;
  categoryId?: string;
  categorySlug?: string;
  description: string | null;
  shortDescription?: string;
  rating: number;
  reviews: number;
  features: string[];
  benefits: string[];
  productDetails: string[];
  productFamily: ProductFamily;
  productSubfamily?: string | null;
  requiresUpload?: boolean;
  requiresBuilder?: boolean;
  uploadProfileId?: string | null;

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
  isCustomizable?: boolean;
  mockupImagePath?: string | null;
};

