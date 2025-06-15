import { NextRequest, NextResponse } from 'next/server';
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

interface BatchRequest {
  urls: string[];
  action: 'scrape';
}

interface BatchResult {
  url: string;
  success: boolean;
  data?: { markdown: string };
  error?: string;
  cached?: boolean;
  retriesUsed?: number;
}

async function scrapeSingleUrl(url: string, apiKey: string): Promise<BatchResult> {
  // Check cache first
  const cached = await cacheService.get(url);
  if (cached) {
    return {
      url,
      success: true,
      data: { markdown: cached },
      cached: true,
    };
  }

  // Retry configuration
  const { MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY, RETRY_STATUS_CODES } =
    PROCESSING_CONFIG;

  let lastError: string | null = null;

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
          timeout: 120000, // Increased to 120s for slow documentation sites
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Documentation-Scraper/1.0)',
          },
        }),
        // Add fetch-level timeout (150s to give Firecrawl time to complete)
        signal: AbortSignal.timeout(150000),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.data && typeof data.data.markdown === 'string') {
          const markdown = data.data.markdown;

          // Detect various types of truncated/incomplete content
          const contentLength = markdown.length;
          const trimmedContent = markdown.trim();

          // Check for known truncated patterns
          const isTruncated =
            // Only navigation link (exactly 82 chars is the common case)
            (contentLength === 82 && trimmedContent.startsWith('[Skip Navigation]')) ||
            // Very short content that's likely incomplete
            (contentLength < 200 &&
              (trimmedContent.startsWith('[Skip Navigation]') ||
                trimmedContent === 'Skip Navigation' ||
                trimmedContent.endsWith('...') ||
                trimmedContent.includes('Loading') ||
                trimmedContent.includes('Please wait'))) ||
            // No actual content headers or paragraphs
            (!trimmedContent.includes('#') && contentLength < 500);

          if (isTruncated) {
            lastError = `Truncated content detected (${contentLength} chars)`;
            continue;
          }

          // Only cache valid content (at least 200 chars)
          if (contentLength >= 200) {
            await cacheService.set(url, markdown);
          }

          return {
            url,
            success: true,
            data: { markdown },
            cached: false,
            retriesUsed: attempt,
          };
        }

        lastError = data.error || 'No markdown content in response';
        break;
      }

      // Handle error responses
      if (!RETRY_STATUS_CODES.includes(response.status) || attempt === MAX_RETRIES) {
        const errorText = await response.text();
        let errorMessage = `Firecrawl API error (${response.status})`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorText;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        return {
          url,
          success: false,
          error: errorMessage,
        };
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';

      if (attempt === MAX_RETRIES) {
        return {
          url,
          success: false,
          error: `Network error after ${MAX_RETRIES + 1} attempts: ${lastError}`,
        };
      }
    }
  }

  return {
    url,
    success: false,
    error: lastError || 'Failed to scrape after multiple attempts',
  };
}

export async function POST(request: NextRequest) {
  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body: BatchRequest = await request.json();
    const { urls, action } = body;

    if (action !== 'scrape') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs must be a non-empty array' }, { status: 400 });
    }

    // Limit batch size to prevent timeouts
    const MAX_BATCH_SIZE = 10;
    if (urls.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} URLs` },
        { status: 400 }
      );
    }

    // Validate all URLs
    const invalidUrls = urls.filter((url) => !isValidDocumentationUrl(url));
    if (invalidUrls.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid URLs detected',
          invalidUrls,
          message: 'All URLs must be from allowed documentation domains',
        },
        { status: 400 }
      );
    }

    // Check cache for all URLs first
    const cacheResults = await cacheService.mget(urls);
    const results: BatchResult[] = [];
    const urlsToFetch: string[] = [];

    // Process cached results
    cacheResults.forEach((cachedContent, url) => {
      if (cachedContent) {
        results.push({
          url,
          success: true,
          data: { markdown: cachedContent },
          cached: true,
        });
      } else {
        urlsToFetch.push(url);
      }
    });

    // Fetch uncached URLs
    if (urlsToFetch.length > 0) {
      // Check if all URLs are from Apple docs (which often timeout in parallel)
      const isAppleDocs = urlsToFetch.every((url) => url.includes('developer.apple.com'));

      if (isAppleDocs && urlsToFetch.length > 5) {
        // Sequential processing for Apple docs to avoid overwhelming their servers
        const fetchResults = [];
        for (const url of urlsToFetch) {
          const result = await scrapeSingleUrl(url, FIRECRAWL_API_KEY);
          fetchResults.push(result);
          // Small delay between requests for Apple docs
          if (urlsToFetch.indexOf(url) < urlsToFetch.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        results.push(...fetchResults);
      } else {
        // Parallel processing for other domains
        const fetchResults = await Promise.all(
          urlsToFetch.map((url) => scrapeSingleUrl(url, FIRECRAWL_API_KEY))
        );
        results.push(...fetchResults);
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        cached: results.filter((r) => r.cached).length,
      },
    });
  } catch (error) {
    console.error('Batch API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
