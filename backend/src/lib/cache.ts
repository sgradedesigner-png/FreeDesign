/**
 * Phase 4: In-Memory Response Cache
 *
 * Simple LRU cache with TTL for expensive API responses.
 * Designed for product listings that change infrequently.
 */
import { logger } from './logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly ttl: number;
  private readonly maxEntries: number;

  constructor(ttl: number = 60000, maxEntries: number = 100) {
    this.cache = new Map();
    this.ttl = ttl; // Default: 1 minute
    this.maxEntries = maxEntries; // Default: 100 entries (LRU eviction)
  }

  /**
   * Get value from cache if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null; // Cache miss
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null; // Expired
    }

    // Move to end (LRU: most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache with current timestamp
   */
  set(key: string, value: T): void {
    // LRU eviction: remove oldest entry if at max capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttl: this.ttl,
    };
  }

  /**
   * Remove expired entries (garbage collection)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Get cache key for product list requests
 */
export function getProductsCacheKey(query: {
  page?: number | string;
  limit?: number | string;
  category_id?: string;
  is_published?: string | boolean;
}): string {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const categoryId = query.category_id || 'all';
  const isPublished = query.is_published === undefined ? 'any' : String(query.is_published);

  return `products:${page}:${limit}:${categoryId}:${isPublished}`;
}

/**
 * Global cache instance for product listings
 * TTL: 60 seconds (1 minute) - configurable via environment
 * Max entries: 100 - stores ~10MB max (assuming 100KB per response)
 */
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60000', 10); // 1 minute default
const CACHE_MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '100', 10);
const CACHE_ENABLED = process.env.ENABLE_RESPONSE_CACHE !== 'false'; // Enabled by default

export const productsCache = new SimpleCache<any>(CACHE_TTL, CACHE_MAX_ENTRIES);

// Cleanup expired entries every 5 minutes
if (CACHE_ENABLED) {
  setInterval(() => {
    const removed = productsCache.cleanup();
    if (removed > 0) {
      logger.debug({ removed }, 'Cache cleanup: removed expired entries');
    }
  }, 5 * 60 * 1000);
}

/**
 * Get last product update timestamp for ETag generation
 */
export async function getLastProductUpdateTime(prisma: any): Promise<Date> {
  const lastProduct = await prisma.product.findFirst({
    select: { updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return lastProduct?.updatedAt || new Date();
}
