import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreamingScrape } from '../useStreamingScrape';

// Mock fetch
global.fetch = vi.fn();

const describeFn = process.env.CI ? describe.skip : describe;

describeFn('useStreamingScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useStreamingScrape());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBe(null);
  });

  it('should process URLs and handle streaming responses', async () => {
    const onUrlStart = vi.fn();
    const onUrlComplete = vi.fn();
    const onProgress = vi.fn();
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useStreamingScrape({
        onUrlStart,
        onUrlComplete,
        onProgress,
        onComplete,
      })
    );

    // Create a mock readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"url_start","url":"https://example.com"}\n\n')
        );
        controller.enqueue(encoder.encode('data: {"type":"progress","progress":1,"total":1}\n\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"url_complete","url":"https://example.com","content":"Test content","cached":false}\n\n'
          )
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    await act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    expect(onUrlStart).toHaveBeenCalledWith('https://example.com');
    expect(onUrlComplete).toHaveBeenCalledWith('https://example.com', 'Test content', false);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(onComplete).toHaveBeenCalledWith([
      { url: 'https://example.com', content: 'Test content' },
    ]);
    expect(result.current.results).toEqual([
      { url: 'https://example.com', content: 'Test content' },
    ]);
    expect(result.current.progress).toBe(100);
  });

  it('should handle errors during streaming', async () => {
    const onUrlError = vi.fn();

    const { result } = renderHook(() =>
      useStreamingScrape({
        onUrlError,
      })
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"url_start","url":"https://example.com"}\n\n')
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"url_error","url":"https://example.com","error":"Network error"}\n\n'
          )
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    await act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    expect(onUrlError).toHaveBeenCalledWith('https://example.com', 'Network error');
  });

  it('should handle fetch errors', async () => {
    const { result } = renderHook(() => useStreamingScrape());

    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failure'));

    await act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    expect(result.current.error).toBe('Network failure');
    expect(result.current.isProcessing).toBe(false);
  });

  it('should handle non-ok responses', async () => {
    const { result } = renderHook(() => useStreamingScrape());

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    expect(result.current.error).toBe('HTTP 500: Internal Server Error');
  });

  it('should cancel ongoing requests', async () => {
    const { result } = renderHook(() => useStreamingScrape());

    // Create a stream that never closes
    const stream = new ReadableStream({
      start() {
        // Never close the controller
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    // Start processing
    const processPromise = act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    // Cancel while processing
    act(() => {
      result.current.cancel();
    });

    // Wait for the promise to resolve
    await processPromise;

    expect(result.current.isProcessing).toBe(false);
  });

  it('should apply comprehensive filters when enabled', async () => {
    const onUrlComplete = vi.fn();

    const { result } = renderHook(() =>
      useStreamingScrape({
        onUrlComplete,
        filterOptions: {
          filterUrls: true,
          filterAvailability: true,
          deduplicateContent: true,
          useComprehensiveFilter: true,
        },
      })
    );

    const encoder = new TextEncoder();
    const content = `# Test Content
    
[Skip Navigation](https://example.com/nav)
    
iOS 14.0+iPadOS 14.0+
    
Some actual content here.`;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: {"type":"url_complete","url":"https://example.com","content":${JSON.stringify(content)},"cached":false}\n\n`
          )
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    await act(async () => {
      await result.current.processUrls(['https://example.com'], 0, 1);
    });

    // Check that filters were applied
    const filteredContent = onUrlComplete.mock.calls[0][1];
    expect(filteredContent).not.toContain('[Skip Navigation]');
    expect(filteredContent).not.toContain('iOS 14.0+');
    expect(filteredContent).toContain('Some actual content here.');
  });
});
