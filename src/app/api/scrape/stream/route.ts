import { NextRequest } from 'next/server';
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';
import { extractLinks } from '@/utils/content-processing';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

interface StreamMessage {
  type: 'url_start' | 'url_complete' | 'url_error' | 'progress' | 'done';
  url?: string;
  content?: string;
  error?: string;
  progress?: number;
  total?: number;
  cached?: boolean;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Helper to send SSE messages
  const sendMessage = (message: StreamMessage) => {
    return encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
  };

  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'url_error', error: 'Server configuration error' })}\n\n`
        ),
        { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    const body = await request.json();
    const { urls, depth = 0, maxUrls = 10 } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'url_error', error: 'No URLs provided' })}\n\n`
        ),
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    // Validate all URLs
    for (const url of urls) {
      if (!isValidDocumentationUrl(url)) {
        return new Response(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'url_error', url, error: 'Invalid URL' })}\n\n`
          ),
          { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
        );
      }
    }

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const processedUrls = new Set<string>();
        const urlQueue: { url: string; depth: number }[] = urls.map((url) => ({ url, depth: 0 }));
        const results: Array<{ url: string; content: string }> = [];

        while (urlQueue.length > 0 && processedUrls.size < maxUrls) {
          const batch = urlQueue.splice(
            0,
            Math.min(PROCESSING_CONFIG.CONCURRENT_LIMIT, maxUrls - processedUrls.size)
          );

          await Promise.all(
            batch.map(async ({ url, depth: currentDepth }) => {
              if (processedUrls.has(url)) return;
              processedUrls.add(url);

              controller.enqueue(sendMessage({ type: 'url_start', url }));
              controller.enqueue(
                sendMessage({
                  type: 'progress',
                  progress: processedUrls.size,
                  total: Math.min(urlQueue.length + processedUrls.size, maxUrls),
                })
              );

              try {
                // Check cache first
                const cached = await cacheService.get(url);
                if (cached && cached.length >= 200) {
                  controller.enqueue(
                    sendMessage({
                      type: 'url_complete',
                      url,
                      content: cached,
                      cached: true,
                    })
                  );
                  results.push({ url, content: cached });

                  // Extract links if not at max depth
                  if (currentDepth < depth) {
                    const links = extractLinks(cached, url);
                    links.forEach((link: string) => {
                      if (
                        !processedUrls.has(link) &&
                        urlQueue.length + processedUrls.size < maxUrls
                      ) {
                        urlQueue.push({ url: link, depth: currentDepth + 1 });
                      }
                    });
                  }
                  return;
                }

                // Scrape the URL
                const content = await scrapeUrlWithRetries(url, FIRECRAWL_API_KEY);

                if (content) {
                  // Cache the content
                  if (content.length >= 200) {
                    await cacheService.set(url, content);
                  }

                  controller.enqueue(
                    sendMessage({
                      type: 'url_complete',
                      url,
                      content,
                      cached: false,
                    })
                  );
                  results.push({ url, content });

                  // Extract links if not at max depth
                  if (currentDepth < depth) {
                    const links = extractLinks(content, url);
                    links.forEach((link: string) => {
                      if (
                        !processedUrls.has(link) &&
                        urlQueue.length + processedUrls.size < maxUrls
                      ) {
                        urlQueue.push({ url: link, depth: currentDepth + 1 });
                      }
                    });
                  }
                } else {
                  controller.enqueue(
                    sendMessage({
                      type: 'url_error',
                      url,
                      error: 'No content retrieved',
                    })
                  );
                }
              } catch (error) {
                controller.enqueue(
                  sendMessage({
                    type: 'url_error',
                    url,
                    error: error instanceof Error ? error.message : 'Unknown error',
                  })
                );
              }
            })
          );
        }

        // Send final done message
        controller.enqueue(sendMessage({ type: 'done' }));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream API Error:', error);
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({ type: 'url_error', error: 'Internal server error' })}\n\n`
      ),
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }
}

async function scrapeUrlWithRetries(url: string, apiKey: string): Promise<string | null> {
  const { MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY, RETRY_STATUS_CODES } =
    PROCESSING_CONFIG;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const response = await http2Fetch(`${FIRECRAWL_API_URL}/scrape`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
          timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
        }),
        signal: AbortSignal.timeout(PROCESSING_CONFIG.FETCH_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.markdown) {
          const markdown = data.data.markdown;

          // Check for truncated content
          if (markdown.length < 200 && markdown.trim().startsWith('[Skip Navigation]')) {
            continue; // Retry
          }

          await cacheService.firecrawlCircuitBreaker.recordSuccess();
          return markdown;
        }
      } else if (!RETRY_STATUS_CODES.includes(response.status) || attempt === MAX_RETRIES) {
        await cacheService.firecrawlCircuitBreaker.recordFailure();
        return null;
      }
    } catch {
      if (attempt === MAX_RETRIES) {
        await cacheService.firecrawlCircuitBreaker.recordFailure();
        return null;
      }
    }
  }

  return null;
}
