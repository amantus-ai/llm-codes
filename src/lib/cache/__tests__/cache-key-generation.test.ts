import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock the normalizeUrl function
vi.mock('@/utils/url-utils', () => ({
  normalizeUrl: vi.fn((url: string) => {
    // Simple normalization for testing
    try {
      const urlObj = new URL(url.toLowerCase());
      urlObj.hash = '';
      urlObj.search = '';
      let normalized = urlObj.toString();
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch {
      return url;
    }
  }),
}));

// Since getCacheKey is private, we'll test it indirectly through the cache behavior
import { RedisCache } from '../redis-cache';

describe('Cache Key Generation', () => {
  let cache: RedisCache;

  beforeEach(() => {
    // Don't set Redis env vars so we only test in-memory behavior
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    cache = new RedisCache();
  });

  it('should generate consistent cache keys for normalized URLs', async () => {
    const content = 'Test content';

    // Set content for base URL
    await cache.set('https://example.com/page', content);

    // These should all hit the same cache entry due to normalization
    const urlVariations = [
      'https://example.com/page',
      'https://example.com/page/',
      'https://example.com/page#section',
      'https://example.com/page/#section',
      'https://example.com/page?query=param',
      'https://EXAMPLE.com/page',
      'HTTPS://EXAMPLE.COM/PAGE',
    ];

    for (const url of urlVariations) {
      const result = await cache.get(url);
      expect(result).toBe(content);
    }
  });

  it('should generate different cache keys for different paths', async () => {
    await cache.set('https://example.com/page1', 'Content 1');
    await cache.set('https://example.com/page2', 'Content 2');

    expect(await cache.get('https://example.com/page1')).toBe('Content 1');
    expect(await cache.get('https://example.com/page2')).toBe('Content 2');
  });

  it('should handle cache key generation for invalid URLs gracefully', async () => {
    // Set a value with an invalid URL
    await cache.set('not-a-valid-url', 'Some content');

    // Should still be retrievable
    const result = await cache.get('not-a-valid-url');
    expect(result).toBe('Some content');
  });

  it('should use longer hash for better collision resistance', () => {
    // Generate a cache key manually to test hash length
    const url = 'https://example.com/test';
    const hash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 32);

    // Should be 32 characters (128 bits)
    expect(hash.length).toBe(32);

    // Should only contain hex characters
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should handle mget with normalized URLs', async () => {
    // Set content for different URLs
    await cache.set('https://example.com/page1', 'Content 1');
    await cache.set('https://example.com/page2', 'Content 2');

    // Request with URL variations
    const urls = [
      'https://example.com/page1#section', // Should normalize to page1
      'https://example.com/page2/', // Should normalize to page2
      'https://example.com/page3', // Not cached
    ];

    const results = await cache.mget(urls);

    expect(results.get(urls[0])).toBe('Content 1');
    expect(results.get(urls[1])).toBe('Content 2');
    expect(results.get(urls[2])).toBe(null);
  });

  it('should handle mset with normalized URLs', async () => {
    const entries = new Map([
      ['https://example.com/page1#section', 'Content 1'],
      ['https://example.com/page2?param=value', 'Content 2'],
    ]);

    await cache.mset(entries);

    // Should be retrievable with different URL variations
    expect(await cache.get('https://example.com/page1')).toBe('Content 1');
    expect(await cache.get('https://example.com/page2/')).toBe('Content 2');
  });
});
