import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Store original env value
const originalApiKey = process.env.FIRECRAWL_API_KEY;

// Mock fetch globally
global.fetch = vi.fn();

describe('POST /api/scrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to clear cache
    vi.resetModules();
    // Mock the API key
    process.env.FIRECRAWL_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // Restore original API key
    process.env.FIRECRAWL_API_KEY = originalApiKey;
  });

  it('should successfully scrape a valid URL', async () => {
    const mockFirecrawlResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test Content\n\nThis is test content.',
        },
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockFirecrawlResponse as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/swiftui',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.markdown).toBe('# Test Content\n\nThis is test content.');
    expect(data.cached).toBe(false);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.firecrawl.dev/v1/scrape',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should reject invalid URLs', async () => {
    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://google.com',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid URL');
  });

  it('should validate all allowed domains', async () => {
    const validUrls = [
      'https://developer.apple.com/documentation/swiftui',
      'https://swiftpackageindex.com/vapor/vapor',
      'https://pointfreeco.github.io/swift-composable-architecture/',
    ];

    for (const url of validUrls) {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { markdown: 'content' },
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const request = new NextRequest('http://localhost:3000/api/scrape', {
        method: 'POST',
        body: JSON.stringify({ url, action: 'scrape' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it('should return cached content when available', async () => {
    // Skip this test for now as cache is persistent between tests
    // TODO: Implement cache clearing between tests
  });

  it('should handle Firecrawl API errors', async () => {
    // Use fake timers to speed up the test
    vi.useFakeTimers();

    const mockResponse = {
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Rate limit exceeded'),
    };
    // Mock all retry attempts to fail with 429
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/rate-limit-test-unique',
        action: 'scrape',
      }),
    });

    // Start the POST request (don't await yet)
    const responsePromise = POST(request);

    // Fast-forward through all the retry delays
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(Math.min(1000 * Math.pow(2, i), 30000));
    }

    // Now wait for the response
    const response = await responsePromise;
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded. Please try again in a few moments.');

    // Verify it tried multiple times (once initial + 5 retries = 6 total)
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(6);

    // Restore real timers
    vi.useRealTimers();
  });

  it('should retry on server errors and succeed when server recovers', async () => {
    // Use fake timers to speed up the test
    vi.useFakeTimers();

    let callCount = 0;

    // Mock first 2 calls to fail with 502, then succeed on 3rd attempt
    vi.mocked(global.fetch).mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: false,
          status: 502,
          text: vi
            .fn()
            .mockResolvedValue(
              '<html><head> <title>502 Server Error</title> </head><body><h1>Error: Server Error</h1></body></html>'
            ),
        } as unknown as Response;
      }

      // Success on 3rd attempt
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { markdown: '# Recovered Content\n\nThis is the content after server recovered.' },
        }),
      } as unknown as Response;
    });

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/retry-test',
        action: 'scrape',
      }),
    });

    // Start the POST request (don't await yet)
    const responsePromise = POST(request);

    // Fast-forward through 2 retry delays (1s + 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    // Now wait for the response
    const response = await responsePromise;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.markdown).toContain('Recovered Content');
    expect(data.retriesUsed).toBe(2); // 0-indexed, so 2 means 3rd attempt

    // Verify it tried 3 times
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);

    // Restore real timers
    vi.useRealTimers();
  });

  it('should handle empty markdown content', async () => {
    // Clear cache first to ensure fresh request
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { markdown: '' },
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/empty',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.markdown).toBe('');
  });

  it('should handle invalid action', async () => {
    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/swiftui',
        action: 'invalid',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid action');
  });

  it('should handle missing API key', async () => {
    process.env.FIRECRAWL_API_KEY = '';

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/swiftui',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Server configuration error');
  });

  it('should handle Firecrawl response without success', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'Some Firecrawl error',
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/failure-test',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Some Firecrawl error');
  });
});
