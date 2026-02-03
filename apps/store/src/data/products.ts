import type { EcommerceProduct, BackendProduct } from './types';

const NEW_PRODUCT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type Product = {
  id: string;

  uuid?: string | null;
  slug?: string | null;

  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;

  // ✅ ONLY R2
  image_path: string;          // REQUIRED
  gallery_paths: string[];     // REQUIRED

  description: string;

  sizes?: string[];
  colors?: string[];
  features?: string[];
  isNew?: boolean;
};


const toArray = (value?: string[] | null) => (Array.isArray(value) ? value : undefined);

// ✅ Backend schema-н шинэ mapper
export const mapProductFromBackend = (row: BackendProduct): Product => {
  const createdAtMs = row.createdAt ? Date.parse(row.createdAt) : null;
  const isNewByDate =
    createdAtMs && !Number.isNaN(createdAtMs)
      ? Date.now() - createdAtMs <= 30 * 24 * 60 * 60 * 1000
      : false;

  const images = row.images || [];
  const mainImage = images[0] || '';
  const galleryImages = images;

  return {
    id: row.id,
    uuid: row.id,
    slug: row.slug,

    name: row.title,
    category: row.category?.name || 'Uncategorized',
    price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
    originalPrice: undefined, // Backend schema-д байхгүй
    rating: 4.5, // Default (backend-д reviews систем хараахан байхгүй)
    reviews: 0,

    image_path: mainImage,
    gallery_paths: galleryImages,

    description: row.description || "",
    sizes: row.sizes && row.sizes.length > 0 ? row.sizes : undefined,
    colors: row.colors && row.colors.length > 0 ? row.colors : undefined,
    features: undefined,
    isNew: isNewByDate,
  };
};

// Legacy mapper (migration-н үед хэрэг болно)
export const mapProductFromDb = (row: EcommerceProduct): Product => {
  const createdAtMs = row.created_at ? Date.parse(row.created_at) : null;
  const isNewByDate =
    createdAtMs && !Number.isNaN(createdAtMs)
      ? Date.now() - createdAtMs <= 30 * 24 * 60 * 60 * 1000
      : false;

  return {
    id: row.id,
    uuid: row.uuid,
    slug: row.slug,

    name: row.name ?? "",
    category: row.category ?? "",
    price: row.price ?? 0,
    originalPrice: row.original_price ?? undefined,
    rating: row.rating ?? 0,
    reviews: row.reviews ?? 0,

    // ✅ ONLY R2
    image_path: row.image_path,
    gallery_paths: row.gallery_paths ?? [],

    description: row.description ?? "",
    sizes: row.sizes ?? undefined,
    colors: row.colors ?? undefined,
    features: row.features ?? undefined,
    isNew: row.is_new ?? isNewByDate,
  };
};
