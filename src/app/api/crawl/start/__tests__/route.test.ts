import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/cache/redis-cache', () => ({
  cacheService: {
    firecrawlCircuitBreaker: {
      canRequest: vi.fn().mockResolvedValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    },
    setCrawlJob: vi.fn(),
  },
}));

vi.mock('@/lib/http2-client', () => ({
  http2Fetch: vi.fn(),
}));

vi.mock('@/utils/url-utils', () => ({
  isValidDocumentationUrl: vi.fn(),
}));

describe('POST /api/crawl/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRECRAWL_API_KEY = 'test-api-key';
  });

  it('should start crawl successfully', async () => {
    const { isValidDocumentationUrl } = await import('@/utils/url-utils');
    const { http2Fetch } = await import('@/lib/http2-client');
    const { cacheService } = await import('@/lib/cache/redis-cache');

    (isValidDocumentationUrl as Mock).mockReturnValue(true);
    (http2Fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        id: 'test-job-123',
        creditsUsed: 5,
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://docs.example.com',
        limit: 10,
        maxDepth: 2,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      jobId: 'test-job-123',
      url: 'https://docs.example.com',
      limit: 10,
      maxDepth: 2,
    });
    expect(cacheService.setCrawlJob).toHaveBeenCalledWith(
      'test-job-123',
      expect.objectContaining({
        id: 'test-job-123',
        url: 'https://docs.example.com',
        status: 'crawling',
      })
    );
  });

  it('should reject invalid URLs', async () => {
    const { isValidDocumentationUrl } = await import('@/utils/url-utils');
    (isValidDocumentationUrl as Mock).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://invalid.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid URL');
  });

  it('should handle circuit breaker open state', async () => {
    const { isValidDocumentationUrl } = await import('@/utils/url-utils');
    const { cacheService } = await import('@/lib/cache/redis-cache');

    (isValidDocumentationUrl as Mock).mockReturnValue(true);
    (cacheService.firecrawlCircuitBreaker.canRequest as Mock).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://docs.example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain('temporarily unavailable');
    expect(data.circuitBreaker).toBe('open');
  });

  it('should handle API errors', async () => {
    const { isValidDocumentationUrl } = await import('@/utils/url-utils');
    const { http2Fetch } = await import('@/lib/http2-client');
    const { cacheService } = await import('@/lib/cache/redis-cache');

    (isValidDocumentationUrl as Mock).mockReturnValue(true);
    (http2Fetch as Mock).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const request = new NextRequest('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://docs.example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Rate limit exceeded');
    expect(cacheService.firecrawlCircuitBreaker.recordFailure).not.toHaveBeenCalled();
  });

  it('should handle missing API key', async () => {
    delete process.env.FIRECRAWL_API_KEY;

    const request = new NextRequest('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://docs.example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Server configuration error');
  });
});
