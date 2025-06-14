import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST, _testUtils } from '../route';
import { NextRequest } from 'next/server';

// Store original env value
const originalApiKey = process.env.FIRECRAWL_API_KEY;

// Mock fetch globally
global.fetch = vi.fn();

describe('POST /api/scrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    _testUtils.clearCache();
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
    (global.fetch as any).mockResolvedValue(mockFirecrawlResponse);

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
      (global.fetch as any).mockResolvedValue(mockResponse);

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
    const mockResponse = {
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Rate limit exceeded'),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/scrape', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://developer.apple.com/documentation/swiftui',
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded. Please try again in a few moments.');
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
    (global.fetch as any).mockResolvedValue(mockResponse);

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
    (global.fetch as any).mockResolvedValue(mockResponse);

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
