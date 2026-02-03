import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

console.log('[Supabase Storage] Initializing Supabase client...');
console.log('[Supabase Storage] URL:', SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('[Supabase Storage] ✅ Client initialized');

/**
 * Upload file to Supabase Storage
 * @param bucket - Storage bucket name (e.g., 'products')
 * @param path - File path in bucket
 * @param file - File buffer
 * @param contentType - MIME type
 * @returns Public URL of uploaded file
 */
export async function uploadToSupabase(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  console.log('[Supabase Upload] Starting upload...');
  console.log('[Supabase Upload] Bucket:', bucket);
  console.log('[Supabase Upload] Path:', path);
  console.log('[Supabase Upload] Content-Type:', contentType);
  console.log('[Supabase Upload] File size:', file.length, 'bytes');

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('[Supabase Upload] ❌ Upload failed:', error);
      throw error;
    }

    console.log('[Supabase Upload] ✅ Upload successful');
    console.log('[Supabase Upload] Data:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    console.log('[Supabase Upload] Public URL:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('[Supabase Upload] ❌ Error:', error);
    throw error;
  }
}

/**
 * Upload product image to Supabase Storage
 * @param productId - Product ID
 * @param file - File buffer
 * @param filename - Original filename
 * @param contentType - MIME type
 * @returns Public URL
 */
export async function uploadProductImage(
  productId: string,
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  console.log('[Supabase Product Image] Uploading product image...');
  console.log('[Supabase Product Image] Product ID:', productId);
  console.log('[Supabase Product Image] Filename:', filename);

  const timestamp = Date.now();
  const path = `products/${productId}/${timestamp}-${filename}`;

  console.log('[Supabase Product Image] Path:', path);

  return uploadToSupabase('products', path, file, contentType);
}

/**
 * Delete file from Supabase Storage
 * @param bucket - Bucket name
 * @param path - File path
 */
export async function deleteFromSupabase(
  bucket: string,
  path: string
): Promise<void> {
  console.log('[Supabase Delete] Deleting file...');
  console.log('[Supabase Delete] Bucket:', bucket);
  console.log('[Supabase Delete] Path:', path);

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('[Supabase Delete] ❌ Failed:', error);
    throw error;
  }

  console.log('[Supabase Delete] ✅ File deleted');
}
