import { logger } from '../lib/logger';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

logger.info('[Supabase Storage] Initializing Supabase client...');
logger.info('[Supabase Storage] URL:', SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

logger.info('[Supabase Storage] ✅ Client initialized');

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
  logger.info('[Supabase Upload] Starting upload...');
  logger.info('[Supabase Upload] Bucket:', bucket);
  logger.info('[Supabase Upload] Path:', path);
  logger.info('[Supabase Upload] Content-Type:', contentType);
  logger.info('[Supabase Upload] File size:', file.length, 'bytes');

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      logger.error('[Supabase Upload] ❌ Upload failed:', error);
      throw error;
    }

    logger.info('[Supabase Upload] ✅ Upload successful');
    logger.info('[Supabase Upload] Data:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    logger.info('[Supabase Upload] Public URL:', publicUrl);

    return publicUrl;
  } catch (error) {
    logger.error('[Supabase Upload] ❌ Error:', error);
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
  logger.info('[Supabase Product Image] Uploading product image...');
  logger.info('[Supabase Product Image] Product ID:', productId);
  logger.info('[Supabase Product Image] Filename:', filename);

  const timestamp = Date.now();
  const path = `products/${productId}/${timestamp}-${filename}`;

  logger.info('[Supabase Product Image] Path:', path);

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
  logger.info('[Supabase Delete] Deleting file...');
  logger.info('[Supabase Delete] Bucket:', bucket);
  logger.info('[Supabase Delete] Path:', path);

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    logger.error('[Supabase Delete] ❌ Failed:', error);
    throw error;
  }

  logger.info('[Supabase Delete] ✅ File deleted');
}
