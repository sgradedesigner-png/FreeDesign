// Backend schema-тай тааруулсан шинэ type
export type BackendProduct = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[]; // R2 URLs
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
};

// Legacy type (migration-н үед ашиглана)
export type EcommerceProduct = {
  id: string;
  created_at?: string | null;

  uuid: string;
  slug: string;

  name?: string | null;
  category?: string | null;
  price?: number | null;
  original_price?: number | null;
  rating?: number | null;
  reviews?: number | null;

  // ✅ ONLY R2
  image_path: string;
  gallery_paths: string[];

  description?: string | null;

  sizes?: string[] | null;
  colors?: string[] | null;
  features?: string[] | null;
  is_new?: boolean | null;
};
