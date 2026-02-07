import { uploadProductImage } from './r2';

const allowedRemoteImageTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

function normalizeHost(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/^https?:\/\//i, '').split('/')[0]?.trim().toLowerCase() ?? '';
}

const r2PublicHost = normalizeHost(process.env.R2_PUBLIC_DOMAIN);

export function isHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isR2PublicUrl(value: string | undefined | null): boolean {
  if (!isHttpUrl(value)) return false;
  if (!r2PublicHost) return false;

  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === r2PublicHost || host.endsWith(`.${r2PublicHost}`);
  } catch {
    return false;
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function inferFilename(imageUrl: string, contentType: string): string {
  const fallbackExt = extensionByMime[contentType] ?? 'jpg';

  try {
    const { pathname } = new URL(imageUrl);
    const rawName = pathname.split('/').pop() || `remote-image.${fallbackExt}`;
    const safeName = sanitizeFilename(decodeURIComponent(rawName));

    if (!safeName) return `remote-image.${fallbackExt}`;
    if (safeName.includes('.')) return safeName;
    return `${safeName}.${fallbackExt}`;
  } catch {
    return `remote-image.${fallbackExt}`;
  }
}

function inferContentTypeFromUrl(imageUrl: string): string | null {
  try {
    const { pathname } = new URL(imageUrl);
    const filename = pathname.split('/').pop() || '';
    const parts = filename.toLowerCase().split('.');
    const ext = parts.length > 1 ? parts.pop() : null;
    if (!ext) return null;
    return mimeByExtension[ext] ?? null;
  } catch {
    return null;
  }
}

export async function importRemoteImageToR2(params: {
  imageUrl: string;
  productId: string;
  maxBytes?: number;
}): Promise<{
  publicUrl: string;
  filename: string;
  size: number;
  contentType: string;
}> {
  const { imageUrl, productId, maxBytes = 10 * 1024 * 1024 } = params;

  if (!isHttpUrl(imageUrl)) {
    throw new Error('Only http/https image URLs are allowed');
  }

  const remoteResponse = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AdminImageImporter/1.0)',
    },
  });

  if (!remoteResponse.ok) {
    throw new Error(`Failed to download image (${remoteResponse.status})`);
  }

  let contentType = (remoteResponse.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (!allowedRemoteImageTypes.has(contentType)) {
    const inferred = inferContentTypeFromUrl(imageUrl);
    if (!inferred || !allowedRemoteImageTypes.has(inferred)) {
      throw new Error(`Unsupported remote image type: ${contentType || 'unknown'}`);
    }
    contentType = inferred;
  }

  const arrayBuffer = await remoteResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error('Downloaded image is empty');
  }

  if (buffer.length > maxBytes) {
    throw new Error(`Remote image exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB size limit`);
  }

  const filename = `${Date.now()}-${inferFilename(imageUrl, contentType)}`;
  const publicUrl = await uploadProductImage(productId, buffer, filename, contentType);

  return {
    publicUrl,
    filename,
    size: buffer.length,
    contentType,
  };
}
