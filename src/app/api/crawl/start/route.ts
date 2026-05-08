import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentationUrl } from "@/utils/url-utils";
import { PROCESSING_CONFIG } from "@/constants";
import { cacheService } from "@/lib/cache/redis-cache";
import { FirecrawlRequestError, startFirecrawlCrawl } from "@/lib/firecrawl";

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function POST(request: NextRequest) {
  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const body = await request.json();
    const { url } = body;

    const enforcedLimit = clampInteger(body.limit, 10, 1, PROCESSING_CONFIG.MAX_ALLOWED_URLS);
    const enforcedMaxDepth = clampInteger(
      body.maxDepth,
      PROCESSING_CONFIG.DEFAULT_CRAWL_DEPTH,
      0,
      PROCESSING_CONFIG.MAX_CRAWL_DEPTH,
    );

    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        {
          error: "Invalid URL. Must be from an allowed documentation domain",
        },
        { status: 400 },
      );
    }

    // Check circuit breaker before attempting to crawl
    const canRequest = await cacheService.firecrawlCircuitBreaker.canRequest();

    if (!canRequest) {
      console.error(`Circuit breaker is OPEN for Firecrawl API, failing fast for crawl ${url}`);
      return NextResponse.json(
        {
          error: "Documentation service is temporarily unavailable",
          details: "The service is experiencing high failure rates. Please try again in a minute.",
          circuitBreaker: "open",
        },
        { status: 503 },
      );
    }

    try {
      const data = await startFirecrawlCrawl(FIRECRAWL_API_KEY, url, {
        limit: enforcedLimit,
        maxDepth: enforcedMaxDepth,
      });

      if (data.success && data.id) {
        const jobMetadata = {
          id: data.id,
          url,
          limit: enforcedLimit,
          maxDepth: enforcedMaxDepth,
          status: "crawling",
          startedAt: new Date().toISOString(),
          totalPages: 0,
          completedPages: 0,
          failedPages: 0,
          creditsUsed: data.creditsUsed || 0,
        };

        await cacheService.setCrawlJob(data.id, jobMetadata);
        await cacheService.firecrawlCircuitBreaker.recordSuccess();

        return NextResponse.json({
          success: true,
          jobId: data.id,
          url,
          limit: enforcedLimit,
          maxDepth: enforcedMaxDepth,
        });
      }

      const error = data.error || "No job ID returned from crawl API";
      console.error(`Crawl API error for ${url}:`, error);
      return NextResponse.json({ error: `Failed to start crawl: ${error}` }, { status: 500 });
    } catch (error) {
      if (error instanceof FirecrawlRequestError) {
        if (error.status >= 500) {
          await cacheService.firecrawlCircuitBreaker.recordFailure();
        }

        const errorResponse: { error: string; details?: unknown } = { error: error.message };
        if (error.details) {
          errorResponse.details = error.details;
        }
        return NextResponse.json(errorResponse, { status: error.status });
      }

      // Network or other error
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Record failure in circuit breaker
      await cacheService.firecrawlCircuitBreaker.recordFailure();

      console.error(`Failed to start crawl for ${url}:`, error);
      return NextResponse.json({ error: `Network error: ${errorMessage}` }, { status: 500 });
    }
  } catch (error) {
    console.error("Crawl Start API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
