import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/cache/redis-cache');
vi.mock('@/lib/http2-client');

describe('GET /api/crawl/[jobId]/status', () => {
  const mockJobId = 'test-job-123';
  const mockRequest = new NextRequest('http://localhost:3000');
  const mockParams = Promise.resolve({ jobId: mockJobId });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRECRAWL_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.FIRECRAWL_API_KEY;
  });

  it('should return 404 when job is not found', async () => {
    vi.mocked(cacheService.getCrawlJob).mockResolvedValue(null);

    const response = await GET(mockRequest, { params: mockParams });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should return 500 when API key is missing', async () => {
    delete process.env.FIRECRAWL_API_KEY;

    const response = await GET(mockRequest, { params: mockParams });

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('should start streaming and handle successful crawl status', async () => {
    // Mock job metadata
    vi.mocked(cacheService.getCrawlJob).mockResolvedValue({
      jobId: mockJobId,
      url: 'https://example.com',
      limit: 10,
      startTime: new Date().toISOString(),
      status: 'scraping',
    });

    // Mock successful Firecrawl API response
    vi.mocked(http2Fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'completed',
        total: 1,
        completed: 1,
        creditsUsed: 1,
        data: [
          {
            markdown: 'Test content',
            metadata: { sourceURL: 'https://example.com/page1' },
          },
        ],
      }),
    } as Response);

    vi.mocked(cacheService.updateCrawlJobStatus).mockResolvedValue();
    vi.mocked(cacheService.setCrawlResults).mockResolvedValue();
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(cacheService.set).mockResolvedValue();

    const response = await GET(mockRequest, { params: mockParams });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    // Verify cache methods were called
    expect(cacheService.getCrawlJob).toHaveBeenCalledWith(mockJobId);
    expect(http2Fetch).toHaveBeenCalled();
  });

  it('should log 502 errors without sending them to client', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    // Mock job metadata
    vi.mocked(cacheService.getCrawlJob).mockResolvedValue({
      jobId: mockJobId,
      url: 'https://example.com',
      limit: 10,
      startTime: new Date().toISOString(),
      status: 'scraping',
    });

    // Mock 502 error response
    vi.mocked(http2Fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn(),
    } as Response);

    const response = await GET(mockRequest, { params: mockParams });

    expect(response.status).toBe(200);
    // Give the stream a moment to start processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify error was logged but not sent to client
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get crawl status for job test-job-123: 502')
    );
    // We removed the console.log for 502 errors, so we don't test for it anymore

    consoleErrorSpy.mockRestore();
  });

  it('should handle network errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    // Mock job metadata
    vi.mocked(cacheService.getCrawlJob).mockResolvedValue({
      jobId: mockJobId,
      url: 'https://example.com',
      limit: 10,
      startTime: new Date().toISOString(),
      status: 'scraping',
    });

    // Mock network error
    vi.mocked(http2Fetch).mockRejectedValue(new Error('Network error'));

    const response = await GET(mockRequest, { params: mockParams });

    expect(response.status).toBe(200);
    // Give the stream a moment to start processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error polling crawl status for job test-job-123:'),
      expect.any(Error)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Network error occurred, will retry... (attempt 1/5)')
    );

    consoleErrorSpy.mockRestore();
  });
});
