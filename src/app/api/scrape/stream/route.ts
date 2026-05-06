import { NextRequest } from "next/server";
import { isValidDocumentationUrl } from "@/utils/url-utils";
import { PROCESSING_CONFIG } from "@/constants";
import { cacheService } from "@/lib/cache/redis-cache";
import {
  getIncompleteContentReason,
  isCacheableFirecrawlContent,
  readFirecrawlMarkdown,
  scrapeFirecrawlUrl,
  type FirecrawlScrapeOptions,
} from "@/lib/firecrawl";
import { extractLinks } from "@/utils/content-processing";
import { WorkerPool, getUrlPriority } from "@/utils/worker-pool";
import { scrapeWithProgressiveTimeout, createCustomConfig } from "@/utils/progressive-timeout";

interface StreamMessage {
  type: "url_start" | "url_complete" | "url_error" | "progress" | "done" | "stats";
  url?: string;
  content?: string;
  error?: string;
  progress?: number;
  total?: number;
  cached?: boolean;
  stats?: string;
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
          `data: ${JSON.stringify({ type: "url_error", error: "Server configuration error" })}\n\n`,
        ),
        { status: 500, headers: { "Content-Type": "text/event-stream" } },
      );
    }

    const body = await request.json();
    const { urls, depth = 0, maxUrls = 10 } = body;

    // Enforce hard limits
    const enforcedDepth = Math.min(depth, PROCESSING_CONFIG.MAX_CRAWL_DEPTH);
    const enforcedMaxUrls = Math.min(maxUrls, PROCESSING_CONFIG.MAX_ALLOWED_URLS);

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        encoder.encode(
          `data: ${JSON.stringify({ type: "url_error", error: "No URLs provided" })}\n\n`,
        ),
        { status: 400, headers: { "Content-Type": "text/event-stream" } },
      );
    }

    // Validate all URLs
    for (const url of urls) {
      if (!isValidDocumentationUrl(url)) {
        return new Response(
          encoder.encode(
            `data: ${JSON.stringify({ type: "url_error", url, error: "Invalid URL" })}\n\n`,
          ),
          { status: 400, headers: { "Content-Type": "text/event-stream" } },
        );
      }
    }

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const processedUrls = new Set<string>();
        const results: Array<{ url: string; content: string }> = [];
        let totalUrlsFound = urls.length;

        const scrapeFn = (url: string, options: FirecrawlScrapeOptions) =>
          scrapeFirecrawlUrl(FIRECRAWL_API_KEY, url, options);

        // Create the worker pool for processing URLs
        const workerPool = new WorkerPool(
          async ({ url, depth: currentDepth }: { url: string; depth: number }) => {
            if (processedUrls.has(url)) return null;
            processedUrls.add(url);

            controller.enqueue(sendMessage({ type: "url_start", url }));
            controller.enqueue(
              sendMessage({
                type: "progress",
                progress: processedUrls.size,
                total: Math.min(totalUrlsFound, enforcedMaxUrls),
              }),
            );

            try {
              // Check cache first
              const cached = await cacheService.get(url);
              if (cached && cached.length >= 200) {
                controller.enqueue(
                  sendMessage({
                    type: "url_complete",
                    url,
                    content: cached,
                    cached: true,
                  }),
                );
                results.push({ url, content: cached });

                // Extract links if not at max depth
                if (currentDepth < enforcedDepth) {
                  const links = extractLinks(cached, url);
                  links.forEach((link: string) => {
                    if (
                      !processedUrls.has(link) &&
                      processedUrls.size + workerPool.getStatus().queueLength < enforcedMaxUrls
                    ) {
                      totalUrlsFound++;
                      workerPool.add({ url: link, depth: currentDepth + 1 }, getUrlPriority(link));
                    }
                  });
                }
                return { url, content: cached, cached: true };
              }

              // Scrape the URL with progressive timeout
              const progressiveConfig = createCustomConfig(url);
              const scrapeResult = await scrapeWithProgressiveTimeout(
                scrapeFn,
                url,
                progressiveConfig,
              );
              const content = readFirecrawlMarkdown(scrapeResult.data);
              const incompleteReason = getIncompleteContentReason(content);

              if (content && !incompleteReason) {
                if (isCacheableFirecrawlContent(content)) {
                  await cacheService.set(url, content);
                }

                controller.enqueue(
                  sendMessage({
                    type: "url_complete",
                    url,
                    content,
                    cached: false,
                  }),
                );
                results.push({ url, content });

                // Extract links if not at max depth
                if (currentDepth < enforcedDepth) {
                  const links = extractLinks(content, url);
                  links.forEach((link: string) => {
                    if (
                      !processedUrls.has(link) &&
                      processedUrls.size + workerPool.getStatus().queueLength < enforcedMaxUrls
                    ) {
                      totalUrlsFound++;
                      workerPool.add({ url: link, depth: currentDepth + 1 }, getUrlPriority(link));
                    }
                  });
                }

                await cacheService.firecrawlCircuitBreaker.recordSuccess();
                cacheService.incrementFirecrawlFetches();
                // Success recorded in circuit breaker
                return { url, content, cached: false };
              } else {
                controller.enqueue(
                  sendMessage({
                    type: "url_error",
                    url,
                    error: incompleteReason
                      ? `Incomplete content: ${incompleteReason}`
                      : "No content retrieved",
                  }),
                );
                await cacheService.firecrawlCircuitBreaker.recordFailure();
                return null;
              }
            } catch (error) {
              controller.enqueue(
                sendMessage({
                  type: "url_error",
                  url,
                  error: error instanceof Error ? error.message : "Unknown error",
                }),
              );
              await cacheService.firecrawlCircuitBreaker.recordFailure();
              return null;
            }
          },
          {
            concurrency: PROCESSING_CONFIG.CONCURRENT_LIMIT,
            onTaskComplete: () => {
              // Progress is already sent in the worker function
            },
            onTaskError: (error) => {
              console.error("Worker error:", error);
            },
            onQueueEmpty: () => {
              // Queue is empty, we're done
              // Send final statistics
              const stats = cacheService.getStats();
              controller.enqueue(
                sendMessage({
                  type: "stats",
                  stats: stats.summary,
                }),
              );
              // Stats already sent to client via SSE

              controller.enqueue(sendMessage({ type: "done" }));
              controller.close();
            },
          },
        );

        // Add initial URLs to the worker pool with priority
        urls.forEach((url: string) => {
          workerPool.add({ url, depth: 0 }, getUrlPriority(url));
        });

        // Start processing
        workerPool.start();

        // Wait for completion
        await workerPool.waitForCompletion();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream API Error:", error);
    // Cache statistics available via cacheService.getStats()
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({ type: "url_error", error: "Internal server error" })}\n\n`,
      ),
      { status: 500, headers: { "Content-Type": "text/event-stream" } },
    );
  }
}
