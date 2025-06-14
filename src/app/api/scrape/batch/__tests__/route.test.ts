import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock environment
vi.stubEnv('FIRECRAWL_API_KEY', 'test-api-key');

// Mock fetch globally
global.fetch = vi.fn();

describe('/api/scrape/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate request format', async () => {
    const request = new NextRequest('http://localhost:3000/api/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({
        urls: [],
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('URLs must be a non-empty array');
  });

  it('should enforce batch size limit', async () => {
    const urls = Array(21).fill('https://developer.apple.com/documentation/test');
    const request = new NextRequest('http://localhost:3000/api/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({
        urls,
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Batch size exceeds maximum of 20 URLs');
  });

  it('should validate all URLs in batch', async () => {
    const request = new NextRequest('http://localhost:3000/api/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({
        urls: [
          'https://developer.apple.com/documentation/valid',
          'https://invalid-domain.com/docs',
        ],
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid URLs detected');
    expect(data.invalidUrls).toContain('https://invalid-domain.com/docs');
  });

  it('should process batch of URLs successfully', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { markdown: 'Test content'.repeat(50) }, // 500+ chars
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({
        urls: [
          'https://developer.apple.com/documentation/test1',
          'https://developer.apple.com/documentation/test2',
        ],
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(2);
    expect(data.summary.total).toBe(2);
    expect(data.summary.successful).toBe(2);
    expect(data.summary.failed).toBe(0);
  });

  it('should handle mixed success/failure in batch', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { markdown: 'Success content'.repeat(50) },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Not found'),
      } as unknown as Response);

    const request = new NextRequest('http://localhost:3000/api/scrape/batch', {
      method: 'POST',
      body: JSON.stringify({
        urls: [
          'https://developer.apple.com/documentation/success',
          'https://developer.apple.com/documentation/notfound',
        ],
        action: 'scrape',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary.successful).toBe(1);
    expect(data.summary.failed).toBe(1);
    expect(data.results[0].success).toBe(true);
    expect(data.results[1].success).toBe(false);
  });
});
