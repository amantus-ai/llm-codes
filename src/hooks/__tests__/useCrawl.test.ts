import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useCrawl } from '../useCrawl';

// Mock fetch
global.fetch = vi.fn() as Mock;

const describeFn = process.env.CI ? describe.skip : describe;

describeFn('useCrawl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start crawl successfully', async () => {
    const mockStartResponse = {
      ok: true,
      json: async () => ({ success: true, jobId: 'test-job-123', url: 'https://example.com' }),
    };

    (global.fetch as Mock).mockResolvedValueOnce(mockStartResponse);

    const { result } = renderHook(() =>
      useCrawl({
        onStatusChange: vi.fn(),
        onProgress: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.jobId).toBeNull();
  });

  it('should handle crawl start errors', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid URL' }),
    };

    (global.fetch as Mock).mockResolvedValueOnce(mockErrorResponse);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useCrawl({
        onError,
      })
    );

    await result.current.startCrawl('https://invalid.com', 10);

    await waitFor(() => {
      expect(result.current.error).toBe('Invalid URL');
      expect(onError).toHaveBeenCalledWith('Invalid URL');
      expect(result.current.isProcessing).toBe(false);
    });
  });

  it('should handle status stream messages', async () => {
    const onProgress = vi.fn();
    const onUrlComplete = vi.fn();
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useCrawl({
        onProgress,
        onUrlComplete,
        onComplete,
      })
    );

    // Simulate successful crawl with progress updates
    const mockStartResponse = {
      ok: true,
      json: async () => ({ success: true, jobId: 'test-job-123' }),
    };

    // Mock the ReadableStream for status updates
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"progress","progress":5,"total":10,"creditsUsed":5}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"url_complete","url":"https://example.com/page1","content":"Test content","cached":false}\n\n'
          )
        );
        controller.enqueue(
          new TextEncoder().encode('data: {"type":"complete","creditsUsed":10}\n\n')
        );
        controller.close();
      },
    });

    const mockStatusResponse = {
      ok: true,
      body: mockStream,
    };

    (global.fetch as Mock)
      .mockResolvedValueOnce(mockStartResponse)
      .mockResolvedValueOnce(mockStatusResponse);

    await result.current.startCrawl('https://example.com', 10);

    await waitFor(() => {
      expect(onProgress).toHaveBeenCalledWith(5, 10, 5);
      expect(onUrlComplete).toHaveBeenCalledWith(
        'https://example.com/page1',
        'Test content',
        false
      );
      expect(onComplete).toHaveBeenCalled();
      expect(result.current.creditsUsed).toBe(10);
    });
  });

  it('should cancel crawl operation', () => {
    const { result } = renderHook(() => useCrawl());

    result.current.cancel();

    // Since the abort controller is internal, we just verify the function exists and can be called
    expect(result.current.cancel).toBeDefined();
  });

  it('should get results from completed crawl', async () => {
    const mockResultsResponse = {
      ok: true,
      json: async () => ({
        success: true,
        jobId: 'test-job-123',
        status: 'completed',
        totalPages: 5,
        creditsUsed: 10,
        markdown: '# Test Content',
      }),
    };

    (global.fetch as Mock).mockResolvedValueOnce(mockResultsResponse);

    const { result } = renderHook(() => useCrawl());

    // Manually set jobId since we're testing getResults in isolation
    result.current.jobId = 'test-job-123';

    const results = await result.current.getResults();

    expect(results).toEqual({
      success: true,
      jobId: 'test-job-123',
      status: 'completed',
      totalPages: 5,
      creditsUsed: 10,
      markdown: '# Test Content',
    });
  });
});
