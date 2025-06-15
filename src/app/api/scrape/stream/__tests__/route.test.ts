import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the cache service
vi.mock('@/lib/cache/redis-cache', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    acquireLock: vi.fn().mockResolvedValue('test-lock-id'),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    firecrawlCircuitBreaker: {
      canRequest: vi.fn().mockResolvedValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    },
  },
}));

// Mock the HTTP client
vi.mock('@/lib/http2-client', () => ({
  http2Fetch: vi.fn(),
}));

describe('POST /api/scrape/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRECRAWL_API_KEY = 'test-api-key';
  });

  it('should stream results for valid URLs', async () => {
    const { http2Fetch } = await import('@/lib/http2-client');

    vi.mocked(http2Fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test Content\n\nThis is test content.',
        },
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://developer.apple.com/documentation/swiftui'],
        depth: 0,
        maxUrls: 1,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('data: {"type":"url_start"');
    expect(output).toContain('data: {"type":"url_complete"');
    expect(output).toContain('data: {"type":"done"}');
  });

  it('should handle multiple URLs with depth', async () => {
    const { http2Fetch } = await import('@/lib/http2-client');

    vi.mocked(http2Fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          markdown: '# Page Content\n\n[Link](https://example.com/page2)',
        },
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://developer.apple.com/documentation/swiftui'],
        depth: 1,
        maxUrls: 5,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('data: {"type":"progress"');
  });

  it('should handle errors gracefully', async () => {
    const { http2Fetch } = await import('@/lib/http2-client');

    vi.mocked(http2Fetch).mockRejectedValue(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://developer.apple.com/documentation/swiftui'],
        depth: 0,
        maxUrls: 1,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('data: {"type":"url_error"');
    expect(output).toContain('Network error');
  });

  it('should validate URLs before processing', async () => {
    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://invalid-domain.com/docs'],
        depth: 0,
        maxUrls: 1,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('Invalid URL');
  });

  it('should handle missing API key', async () => {
    process.env.FIRECRAWL_API_KEY = '';

    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://developer.apple.com/documentation/swiftui'],
        depth: 0,
        maxUrls: 1,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('Server configuration error');
  });

  it('should use cached content when available', async () => {
    const { cacheService } = await import('@/lib/cache/redis-cache');

    vi.mocked(cacheService.get).mockResolvedValue('# Cached Content\n\nThis is cached.');

    const request = new NextRequest('http://localhost:3000/api/scrape/stream', {
      method: 'POST',
      body: JSON.stringify({
        urls: ['https://developer.apple.com/documentation/swiftui'],
        depth: 0,
        maxUrls: 1,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    }

    const output = chunks.join('');
    expect(output).toContain('"cached":true');
    expect(output).toContain('Cached Content');
  });
});
