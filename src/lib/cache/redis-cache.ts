/* eslint-disable no-console */
import { Redis } from '@upstash/redis';
import { compress, decompress } from 'lz-string';
import crypto from 'crypto';
import { normalizeUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';

interface CacheEntry {
  value: string;
  timestamp: number;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
}

export class RedisCache {
  private redis: Redis | null = null;
  private localCache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, errors: 0 };
  private readonly ttl: number;
  private readonly compressionThreshold: number;
  private readonly localCacheTTL: number = PROCESSING_CONFIG.LOCAL_CACHE_TTL;

  constructor(
    ttl: number = PROCESSING_CONFIG.CACHE_DURATION / 1000, // Convert ms to seconds
    compressionThreshold: number = PROCESSING_CONFIG.COMPRESSION_THRESHOLD
  ) {
    this.ttl = ttl;
    this.compressionThreshold = compressionThreshold;
    this.initializeRedis();
  }

  private initializeRedis() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      try {
        this.redis = new Redis({ url, token });
        console.info('Redis cache initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Redis:', error);
        this.redis = null;
      }
    } else {
      console.warn('Redis credentials not found, falling back to in-memory cache only');
    }
  }

  /**
   * Generate a cache key from a URL
   * Normalizes the URL first to ensure consistent caching
   */
  private getCacheKey(url: string): string {
    // Normalize URL to improve cache hit rate
    const normalized = normalizeUrl(url);
    // Use 32 characters (128 bits) for better collision resistance
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
    return `page:${hash}:v3`; // Bump version to v3 to invalidate old cache entries
  }

  /**
   * Check if a local cache entry is expired
   */
  private isLocalCacheExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.localCacheTTL;
  }

  /**
   * Compress content if it exceeds threshold
   */
  private compressContent(content: string): { data: string; compressed: boolean } {
    if (content.length > this.compressionThreshold) {
      return {
        data: compress(content),
        compressed: true,
      };
    }
    return {
      data: content,
      compressed: false,
    };
  }

  /**
   * Decompress content if it was compressed
   */
  private decompressContent(data: string, compressed: boolean): string {
    return compressed ? decompress(data) : data;
  }

  /**
   * Get a single value from cache
   */
  async get(url: string): Promise<string | null> {
    const key = this.getCacheKey(url);

    // Check L1 cache first
    const localEntry = this.localCache.get(key);
    if (localEntry && !this.isLocalCacheExpired(localEntry)) {
      this.stats.hits++;
      return localEntry.value;
    }

    // Check L2 cache (Redis)
    if (this.redis) {
      try {
        const cached = await this.redis.get<{ data: string; compressed?: boolean }>(key);
        if (cached) {
          const value = this.decompressContent(cached.data, cached.compressed || false);

          // Populate L1 cache
          this.localCache.set(key, {
            value,
            timestamp: Date.now(),
            compressed: cached.compressed,
          });

          this.stats.hits++;
          return value;
        }
      } catch (error) {
        console.error('Redis get error:', error);
        this.stats.errors++;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set a single value in cache
   */
  async set(url: string, value: string, customTtl?: number): Promise<void> {
    const key = this.getCacheKey(url);
    const ttl = customTtl || this.ttl;
    const { data, compressed } = this.compressContent(value);

    // Set in L1 cache
    this.localCache.set(key, {
      value,
      timestamp: Date.now(),
      compressed,
    });

    // Set in L2 cache (Redis)
    if (this.redis) {
      try {
        await this.redis.set(key, { data, compressed }, { ex: ttl });
      } catch (error) {
        console.error('Redis set error:', error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget(urls: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const missingUrls: string[] = [];
    const keyToUrl = new Map<string, string>();

    // Check L1 cache first
    for (const url of urls) {
      const key = this.getCacheKey(url);
      const localEntry = this.localCache.get(key);

      if (localEntry && !this.isLocalCacheExpired(localEntry)) {
        results.set(url, localEntry.value);
        this.stats.hits++;
      } else {
        missingUrls.push(url);
        keyToUrl.set(key, url);
      }
    }

    // Check L2 cache for missing URLs
    if (this.redis && missingUrls.length > 0) {
      try {
        const keys = missingUrls.map((url) => this.getCacheKey(url));
        const values = await this.redis.mget<{ data: string; compressed?: boolean }[]>(...keys);

        values.forEach((cached, index) => {
          const key = keys[index];
          const url = keyToUrl.get(key)!;

          if (cached) {
            const value = this.decompressContent(cached.data, cached.compressed || false);
            results.set(url, value);

            // Populate L1 cache
            this.localCache.set(key, {
              value,
              timestamp: Date.now(),
              compressed: cached.compressed,
            });

            this.stats.hits++;
          } else {
            results.set(url, null);
            this.stats.misses++;
          }
        });
      } catch (error) {
        console.error('Redis mget error:', error);
        this.stats.errors++;

        // Set all missing URLs to null
        missingUrls.forEach((url) => {
          results.set(url, null);
          this.stats.misses++;
        });
      }
    } else {
      // No Redis or no missing URLs
      missingUrls.forEach((url) => {
        results.set(url, null);
        this.stats.misses++;
      });
    }

    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset(entries: Map<string, string>, customTtl?: number): Promise<void> {
    const ttl = customTtl || this.ttl;
    const pipeline = this.redis?.pipeline();

    entries.forEach((value, url) => {
      const key = this.getCacheKey(url);
      const { data, compressed } = this.compressContent(value);

      // Set in L1 cache
      this.localCache.set(key, {
        value,
        timestamp: Date.now(),
        compressed,
      });

      // Add to pipeline for L2 cache
      if (pipeline) {
        pipeline.set(key, { data, compressed }, { ex: ttl });
      }
    });

    // Execute pipeline
    if (pipeline) {
      try {
        await pipeline.exec();
      } catch (error) {
        console.error('Redis mset error:', error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(url: string): Promise<void> {
    const key = this.getCacheKey(url);

    // Delete from L1 cache
    this.localCache.delete(key);

    // Delete from L2 cache
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Clear all local cache
   */
  clearLocalCache(): void {
    this.localCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; localCacheSize: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      localCacheSize: this.localCache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.redis !== null;
  }
}

// Export a singleton instance
export const cacheService = new RedisCache();
