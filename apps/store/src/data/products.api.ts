// src/data/products.api.ts
import { supabase } from '../lib/supabase';
import type { BackendProduct, ProductVariant } from './types';
import { mapProductFromBackend, type Product } from './products';

type RawRow = Record<string, unknown>;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const pick = (row: RawRow, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
};

const getProductId = (row: RawRow): string =>
  asString(pick(row, 'productId', 'product_id'));

const getSortOrder = (row: RawRow): number =>
  asNumber(pick(row, 'sortOrder', 'sort_order'), 0);

const toVariant = (row: RawRow): ProductVariant => {
  const productId = getProductId(row);
  const id = asString(pick(row, 'id')) || `${productId}-${asString(pick(row, 'sku'))}`;

  return {
    id,
    productId,
    name: asString(pick(row, 'name')),
    sku: asString(pick(row, 'sku')),
    price: asNumber(pick(row, 'price')),
    originalPrice:
      pick(row, 'originalPrice', 'original_price') == null
        ? null
        : asNumber(pick(row, 'originalPrice', 'original_price')),
    sizes: asStringArray(pick(row, 'sizes')),
    imagePath: asString(pick(row, 'imagePath', 'image_path')),
    galleryPaths: asStringArray(pick(row, 'galleryPaths', 'gallery_paths')),
    stock: asNumber(pick(row, 'stock'), 0),
    isAvailable: Boolean(pick(row, 'isAvailable', 'is_available')),
    sortOrder: getSortOrder(row),
    createdAt: asString(pick(row, 'createdAt', 'created_at')),
    updatedAt: asString(pick(row, 'updatedAt', 'updated_at')),
  };
};

const toBackendProduct = (row: RawRow, variants: ProductVariant[]): BackendProduct => {
  const categoryId = asString(pick(row, 'categoryId', 'category_id'));
  const categoryRaw = pick(row, 'categoryName', 'category_name', 'category');
  const categoryObj =
    categoryRaw && typeof categoryRaw === 'object' ? (categoryRaw as RawRow) : null;
  const categoryName =
    asString(categoryRaw) ||
    asString(categoryObj?.name) ||
    asString(categoryObj?.title) ||
    'Uncategorized';
  const categorySlug =
    asString(pick(row, 'categorySlug', 'category_slug')) ||
    asString(categoryObj?.slug);

  return {
    id: asString(pick(row, 'id')),
    title: asString(pick(row, 'title', 'name')),
    slug: asString(pick(row, 'slug')),
    subtitle: asString(pick(row, 'subtitle')),
    description:
      pick(row, 'description') == null ? null : asString(pick(row, 'description')),
    basePrice: asNumber(pick(row, 'basePrice', 'base_price')),
    categoryId,
    category: {
      id: categoryId,
      name: categoryName || 'Uncategorized',
      slug: categorySlug,
    },
    variants,
    rating: asNumber(pick(row, 'rating')),
    reviews: asNumber(pick(row, 'reviews'), 0),
    features: asStringArray(pick(row, 'features')),
    benefits: asStringArray(pick(row, 'benefits')),
    productDetails: asStringArray(pick(row, 'productDetails', 'product_details')),
    shortDescription: asString(pick(row, 'shortDescription', 'short_description')),
    createdAt: asString(pick(row, 'createdAt', 'created_at')),
    updatedAt: asString(pick(row, 'updatedAt', 'updated_at')),
  };
};

async function fetchAllPublicVariants(): Promise<ProductVariant[]> {
  let query = supabase
    .from('v_product_variants_public')
    .select('*')
    .order('sortOrder', { ascending: true });

  let { data, error } = await query;

  if (error) {
    const fallback = await supabase
      .from('v_product_variants_public')
      .select('*')
      .order('sort_order', { ascending: true });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return (data ?? []).map((row) => toVariant(row as RawRow));
}

async function fetchPublicVariantsByProductId(productId: string): Promise<ProductVariant[]> {
  let query = supabase
    .from('v_product_variants_public')
    .select('*')
    .eq('productId', productId)
    .order('sortOrder', { ascending: true });

  let { data, error } = await query;

  if (error) {
    const fallback = await supabase
      .from('v_product_variants_public')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return (data ?? []).map((row) => toVariant(row as RawRow));
}

// Fetch products from Supabase public view
export async function fetchProducts(): Promise<Product[]> {
  let query = supabase
    .from('v_products_public_list')
    .select('*')
    .order('createdAt', { ascending: false });

  let { data: productRows, error: productError } = await query;

  if (productError) {
    const fallback = await supabase
      .from('v_products_public_list')
      .select('*')
      .order('created_at', { ascending: false });

    productRows = fallback.data;
    productError = fallback.error;
  }

  if (productError) throw productError;

  const allVariants = await fetchAllPublicVariants();
  const variantsByProductId = new Map<string, ProductVariant[]>();

  for (const variant of allVariants) {
    const productId = variant.productId;
    const bucket = variantsByProductId.get(productId) ?? [];
    bucket.push(variant);
    variantsByProductId.set(productId, bucket);
  }

  return (productRows ?? []).map((row) => {
    const raw = row as RawRow;
    const productId = asString(pick(raw, 'id'));
    const variants = [...(variantsByProductId.get(productId) ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    return mapProductFromBackend(toBackendProduct(raw, variants));
  });
}

// Fetch product detail by slug from Supabase public view
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;

  const { data: productRow, error: productError } = await supabase
    .from('v_products_public_list')
    .select('*')
    .eq('slug', slug)
    .single();

  if (productError) {
    if ('code' in productError && productError.code === 'PGRST116') return null;
    throw productError;
  }

  if (!productRow) return null;

  const raw = productRow as RawRow;
  const productId = asString(pick(raw, 'id'));
  const variants = await fetchPublicVariantsByProductId(productId);

  return mapProductFromBackend(toBackendProduct(raw, variants));
}
