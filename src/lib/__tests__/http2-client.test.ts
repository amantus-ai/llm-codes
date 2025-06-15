import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http2Fetch } from '../http2-client';
import { request } from 'undici';

// Mock undici
vi.mock('undici', () => ({
  request: vi.fn(),
}));

describe('http2Fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make a successful GET request', async () => {
    const mockResponse = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: {
        text: vi.fn().mockResolvedValue('{"data": "test"}'),
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    const response = await http2Fetch('https://example.com/api');

    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ data: 'test' });
    expect(request).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: undefined,
    });
  });

  it('should make a POST request with body', async () => {
    const mockResponse = {
      statusCode: 201,
      headers: {
        'content-type': 'application/json',
      },
      body: {
        text: vi.fn().mockResolvedValue('{"created": true}'),
        json: vi.fn().mockResolvedValue({ created: true }),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    const response = await http2Fetch('https://example.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'test' }),
    });

    expect(response.status).toBe(201);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ created: true });
    expect(request).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'test' }),
      signal: undefined,
    });
  });

  it('should handle 4xx errors', async () => {
    const mockResponse = {
      statusCode: 404,
      headers: {},
      body: {
        text: vi.fn().mockResolvedValue('Not Found'),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    const response = await http2Fetch('https://example.com/api/missing');

    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
    expect(await response.text()).toBe('Not Found');
  });

  it('should handle 5xx errors', async () => {
    const mockResponse = {
      statusCode: 500,
      headers: {},
      body: {
        text: vi.fn().mockResolvedValue('Internal Server Error'),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    const response = await http2Fetch('https://example.com/api');

    expect(response.status).toBe(500);
    expect(response.ok).toBe(false);
    expect(response.statusText).toBe('Internal Server Error');
  });

  it('should handle network errors', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Network error'));

    await expect(http2Fetch('https://example.com/api')).rejects.toThrow('Network error');
  });

  it('should pass through abort signal', async () => {
    const controller = new AbortController();
    const mockResponse = {
      statusCode: 200,
      headers: {},
      body: {
        text: vi.fn().mockResolvedValue('OK'),
        json: vi.fn().mockResolvedValue({}),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    await http2Fetch('https://example.com/api', {
      signal: controller.signal,
    });

    expect(request).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: controller.signal,
    });
  });

  it('should handle different status codes correctly', async () => {
    const testCases = [
      { status: 200, ok: true, statusText: 'OK' },
      { status: 201, ok: true, statusText: 'Created' },
      { status: 204, ok: true, statusText: 'No Content' },
      { status: 301, ok: false, statusText: 'Moved Permanently' },
      { status: 400, ok: false, statusText: 'Bad Request' },
      { status: 401, ok: false, statusText: 'Unauthorized' },
      { status: 403, ok: false, statusText: 'Forbidden' },
      { status: 404, ok: false, statusText: 'Not Found' },
      { status: 500, ok: false, statusText: 'Internal Server Error' },
      { status: 502, ok: false, statusText: 'Bad Gateway' },
      { status: 503, ok: false, statusText: 'Service Unavailable' },
    ];

    for (const testCase of testCases) {
      vi.mocked(request).mockResolvedValue({
        statusCode: testCase.status,
        headers: {},
        body: {
          text: vi.fn().mockResolvedValue(''),
          json: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Awaited<ReturnType<typeof request>>);

      const response = await http2Fetch('https://example.com/api');

      expect(response.status).toBe(testCase.status);
      expect(response.ok).toBe(testCase.ok);
      expect(response.statusText).toBe(testCase.statusText);
    }
  });

  it('should handle headers correctly', async () => {
    const responseHeaders = {
      'content-type': 'application/json',
      'x-custom-header': 'custom-value',
      'cache-control': 'no-cache',
    };

    vi.mocked(request).mockResolvedValue({
      statusCode: 200,
      headers: responseHeaders as unknown as Record<string, string>,
      body: {
        text: vi.fn().mockResolvedValue('{}'),
        json: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Awaited<ReturnType<typeof request>>);

    const response = await http2Fetch('https://example.com/api');

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-custom-header')).toBe('custom-value');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('should handle request with all options', async () => {
    const mockResponse = {
      statusCode: 200,
      headers: {},
      body: {
        text: vi.fn().mockResolvedValue('OK'),
        json: vi.fn().mockResolvedValue({}),
      },
    };

    vi.mocked(request).mockResolvedValue(
      mockResponse as unknown as Awaited<ReturnType<typeof request>>
    );

    const controller = new AbortController();

    await http2Fetch('https://example.com/api', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ update: true }),
      signal: controller.signal,
    });

    expect(request).toHaveBeenCalledWith('https://example.com/api', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ update: true }),
      signal: controller.signal,
    });
  });
});
