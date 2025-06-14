import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCache } from '../redis-cache';

// Mock pipeline
const mockPipeline = {
  set: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

// Mock Redis instance
const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  mget: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
};

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedisInstance),
}));

// Mock lz-string
vi.mock('lz-string', () => ({
  compress: vi.fn((str) => `compressed_${str}`),
  decompress: vi.fn((str) => str.replace('compressed_', '')),
}));

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    cache = new RedisCache(3600, 100); // 1 hour TTL, 100 char compression threshold
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe('get', () => {
    it('should return null for cache miss', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await cache.get('https://example.com');
      expect(result).toBeNull();
    });

    it('should return cached value from Redis', async () => {
      mockRedisInstance.get.mockResolvedValue({ data: 'test content', compressed: false });
      const result = await cache.get('https://example.com');
      expect(result).toBe('test content');
    });

    it('should decompress compressed content', async () => {
      mockRedisInstance.get.mockResolvedValue({
        data: 'compressed_test content',
        compressed: true,
      });
      const result = await cache.get('https://example.com');
      expect(result).toBe('test content');
    });

    it('should use L1 cache for subsequent requests', async () => {
      mockRedisInstance.get.mockResolvedValue({ data: 'test content', compressed: false });

      // First call hits Redis
      await cache.get('https://example.com');
      expect(mockRedisInstance.get).toHaveBeenCalledTimes(1);

      // Second call should use L1 cache
      const result = await cache.get('https://example.com');
      expect(result).toBe('test content');
      expect(mockRedisInstance.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('set', () => {
    it('should store value in cache', async () => {
      await cache.set('https://example.com', 'test content');

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        expect.any(String),
        { data: 'test content', compressed: false },
        { ex: 3600 }
      );
    });

    it('should compress large content', async () => {
      const largeContent = 'a'.repeat(150); // Over 100 char threshold
      await cache.set('https://example.com', largeContent);

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        expect.any(String),
        { data: `compressed_${largeContent}`, compressed: true },
        { ex: 3600 }
      );
    });

    it('should use custom TTL when provided', async () => {
      await cache.set('https://example.com', 'test content', 7200);

      expect(mockRedisInstance.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
        ex: 7200,
      });
    });
  });

  describe('mget', () => {
    it('should return multiple values', async () => {
      mockRedisInstance.mget.mockResolvedValue([
        { data: 'content1', compressed: false },
        null,
        { data: 'compressed_content3', compressed: true },
      ]);

      const urls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'];

      const results = await cache.mget(urls);

      expect(results.get('https://example.com/1')).toBe('content1');
      expect(results.get('https://example.com/2')).toBeNull();
      expect(results.get('https://example.com/3')).toBe('content3');
    });
  });

  describe('mset', () => {
    it('should store multiple values', async () => {
      const entries = new Map([
        ['https://example.com/1', 'content1'],
        ['https://example.com/2', 'a'.repeat(150)], // Will be compressed
      ]);

      await cache.mset(entries);

      expect(mockPipeline.set).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null); // miss
      mockRedisInstance.get.mockResolvedValueOnce({ data: 'content', compressed: false }); // hit

      await cache.get('https://example.com/1');
      await cache.get('https://example.com/2');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('without Redis', () => {
    beforeEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      cache = new RedisCache();
    });

    it('should fall back to in-memory cache only', async () => {
      await cache.set('https://example.com', 'test content');
      const result = await cache.get('https://example.com');

      expect(result).toBe('test content');
      expect(cache.isRedisAvailable()).toBe(false);
    });
  });
});
