import { NextRequest, NextResponse } from 'next/server';
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

export async function POST(request: NextRequest) {
  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { url, limit = 10 } = body;

    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        {
          error: 'Invalid URL. Must be from an allowed documentation domain',
        },
        { status: 400 }
      );
    }

    // Check circuit breaker before attempting to crawl
    const canRequest = await cacheService.firecrawlCircuitBreaker.canRequest();

    if (!canRequest) {
      console.error(`Circuit breaker is OPEN for Firecrawl API, failing fast for crawl ${url}`);
      return NextResponse.json(
        {
          error: 'Documentation service is temporarily unavailable',
          details: 'The service is experiencing high failure rates. Please try again in a minute.',
          circuitBreaker: 'open',
        },
        { status: 503 }
      );
    }

    try {
      // Start a crawl job with Firecrawl
      const response = await http2Fetch(`${FIRECRAWL_API_URL}/crawl`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          limit,
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
            timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Documentation-Scraper/1.0)',
            },
          },
        }),
        signal: AbortSignal.timeout(PROCESSING_CONFIG.FETCH_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.id) {
          // Store initial job metadata in Redis
          const jobMetadata = {
            id: data.id,
            url,
            limit,
            status: 'crawling',
            startedAt: new Date().toISOString(),
            totalPages: 0,
            completedPages: 0,
            failedPages: 0,
            creditsUsed: data.creditsUsed || 0,
          };

          await cacheService.setCrawlJob(data.id, jobMetadata);

          // Record success in circuit breaker
          await cacheService.firecrawlCircuitBreaker.recordSuccess();

          return NextResponse.json({
            success: true,
            jobId: data.id,
            url,
            limit,
          });
        }

        // API returned success but no job ID
        const error = data.error || 'No job ID returned from crawl API';
        console.error(`Crawl API error for ${url}:`, error);

        return NextResponse.json({ error: `Failed to start crawl: ${error}` }, { status: 500 });
      }

      // Handle error response
      let errorMessage = `Firecrawl API error (${response.status})`;
      let errorDetails = null;

      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorText;
            // Include detailed error information if available
            if (errorData.details) {
              errorDetails = errorData.details;
              console.error(`Firecrawl API detailed error for ${url}:`, errorData.details);
            }
          } catch {
            errorMessage = `Firecrawl API error: ${errorText}`;
          }
        }
      } catch {
        // If reading response fails, stick with default message
      }

      // Add helpful context based on status code
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. The API key might be invalid.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }

      // Record failure in circuit breaker for server errors
      if (response.status >= 500) {
        await cacheService.firecrawlCircuitBreaker.recordFailure();
      }

      const errorResponse: { error: string; details?: unknown } = { error: errorMessage };
      if (errorDetails) {
        errorResponse.details = errorDetails;
      }
      return NextResponse.json(errorResponse, { status: response.status });
    } catch (error) {
      // Network or other error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Record failure in circuit breaker
      await cacheService.firecrawlCircuitBreaker.recordFailure();

      console.error(`Failed to start crawl for ${url}:`, error);
      return NextResponse.json({ error: `Network error: ${errorMessage}` }, { status: 500 });
    }
  } catch (error) {
    console.error('Crawl Start API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
