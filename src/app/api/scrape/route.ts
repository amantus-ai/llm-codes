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
    const { url, action, codeBlocksOnly = false } = body;

    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        {
          error:
            'Invalid URL. Must be from developer.apple.com, swiftpackageindex.com, or *.github.io',
        },
        { status: 400 }
      );
    }

    if (action === 'scrape') {
      // Check cache first
      const cached = await cacheService.get(url);
      if (cached) {
        // Validate cached content isn't truncated
        if (cached.length < 200 && cached.trim().startsWith('[Skip Navigation]')) {
          // Remove invalid cached entry
          await cacheService.delete(url);
          console.warn(`Removed truncated cached content for ${url} (${cached.length} chars)`);
        } else {
          return NextResponse.json({
            success: true,
            data: { markdown: cached },
            cached: true,
            codeBlocksOnly, // Pass through the parameter
          });
        }
      }

      // Try to acquire lock for this URL
      const lockId = await cacheService.acquireLock(url);

      if (!lockId) {
        // Another process is already scraping this URL
        console.warn(`URL ${url} is already being processed, waiting for completion...`);

        // Wait for the lock to be released
        const lockReleased = await cacheService.waitForLock(url);

        if (lockReleased) {
          // Check cache again - the other process should have populated it
          const cachedAfterWait = await cacheService.get(url);
          if (cachedAfterWait) {
            return NextResponse.json({
              success: true,
              data: { markdown: cachedAfterWait },
              cached: true,
              waitedForLock: true,
              codeBlocksOnly, // Pass through the parameter
            });
          }
        }

        // If we still don't have content, proceed with scraping
        console.warn(`Lock wait timeout or no cached content for ${url}, proceeding with scrape`);
      }

      try {
        // Check circuit breaker before attempting to scrape
        const canRequest = await cacheService.firecrawlCircuitBreaker.canRequest();

        if (!canRequest) {
          console.error(`Circuit breaker is OPEN for Firecrawl API, failing fast for ${url}`);
          return NextResponse.json(
            {
              error: 'Documentation service is temporarily unavailable',
              details:
                'The service is experiencing high failure rates. Please try again in a minute.',
              circuitBreaker: 'open',
            },
            { status: 503 }
          );
        }

        // Retry configuration from constants
        const { MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY, RETRY_STATUS_CODES } =
          PROCESSING_CONFIG;

        let lastError: string | null = null;
        let lastStatus: number | null = null;

        // Attempt to scrape with retries
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            // Calculate delay with exponential backoff
            const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
            console.warn(
              `Retry attempt ${attempt}/${MAX_RETRIES} for ${url}, waiting ${delay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          try {
            const response = await http2Fetch(`${FIRECRAWL_API_URL}/scrape`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
                timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; Documentation-Scraper/1.0)',
                },
              }),
              // Add fetch-level timeout (90s to give Firecrawl time to complete)
              signal: AbortSignal.timeout(PROCESSING_CONFIG.FETCH_TIMEOUT),
            });

            lastStatus = response.status;

            if (response.ok) {
              // Success! Process the response
              const data = await response.json();

              // Log the response structure for debugging (using console.error for production builds)
              if (!data.data?.markdown) {
                console.error(`Firecrawl response for ${url}:`, {
                  success: data.success,
                  hasData: !!data.data,
                  hasMarkdown: !!data.data?.markdown,
                  markdownLength: data.data?.markdown?.length || 0,
                  dataKeys: data.data ? Object.keys(data.data) : [],
                });
              }

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
                  const warningMsg = `Received suspicious/truncated content for ${url}: ${contentLength} chars`;
                  console.error(warningMsg);
                  console.error(`First 100 chars: ${trimmedContent.substring(0, 100)}`);
                  console.error(`Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

                  lastError = `Truncated content detected (${contentLength} chars)`;

                  // Don't cache truncated content, continue retrying
                  continue;
                }

                // Only cache valid content (at least 200 chars)
                if (contentLength >= 200) {
                  await cacheService.set(url, markdown);
                } else {
                  console.warn(
                    `Content for ${url} is short (${contentLength} chars) but proceeding`
                  );
                }

                // Record success in circuit breaker
                await cacheService.firecrawlCircuitBreaker.recordSuccess();

                return NextResponse.json({
                  success: true,
                  data: { markdown },
                  cached: false,
                  retriesUsed: attempt,
                  contentLength, // Include length in response for debugging
                  codeBlocksOnly, // Pass through the parameter
                });
              }

              // API returned success but no valid data
              lastError =
                data.error ||
                (!data.success
                  ? 'Firecrawl returned success: false'
                  : !data.data
                    ? 'No data object in response'
                    : 'No markdown content in response');

              // Don't retry for data structure issues
              break;
            }

            // Handle error response
            let errorMessage = `Firecrawl API error (${response.status})`;

            try {
              const errorText = await response.text();
              if (errorText) {
                try {
                  const errorData = JSON.parse(errorText);
                  errorMessage = errorData.error || errorData.message || errorText;
                } catch {
                  // If not JSON, use the raw text
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
            } else if (response.status === 500) {
              errorMessage = 'Firecrawl server error. Please try again later.';
            } else if (response.status === 502) {
              errorMessage = 'Server temporarily unavailable. Please try again.';
            } else if (response.status === 503) {
              errorMessage = 'Service unavailable. Please try again.';
            } else if (response.status === 504) {
              errorMessage = 'Gateway timeout. Please try again.';
            } else if (response.status === 404) {
              errorMessage = 'Page not found. Please check the URL.';
            }

            lastError = errorMessage;

            // Check if we should retry
            if (!RETRY_STATUS_CODES.includes(response.status) || attempt === MAX_RETRIES) {
              // Record failure in circuit breaker for server errors
              if (RETRY_STATUS_CODES.includes(response.status)) {
                await cacheService.firecrawlCircuitBreaker.recordFailure();
              }
              // Don't retry for non-retryable errors or if we've exhausted retries
              return NextResponse.json({ error: errorMessage }, { status: response.status });
            }
          } catch (error) {
            // Network or other error
            lastError = error instanceof Error ? error.message : 'Unknown error occurred';
            lastStatus = 500;

            if (attempt === MAX_RETRIES) {
              // Record failure in circuit breaker
              await cacheService.firecrawlCircuitBreaker.recordFailure();
              console.error(`Failed to scrape ${url} after ${MAX_RETRIES + 1} attempts:`, error);
              return NextResponse.json(
                { error: `Network error after ${MAX_RETRIES + 1} attempts: ${lastError}` },
                { status: 500 }
              );
            }
          }
        }

        // If we got here, all retries failed
        // Record failure in circuit breaker
        await cacheService.firecrawlCircuitBreaker.recordFailure();

        // Provide helpful error message for truncated content
        if (lastError?.includes('Truncated content')) {
          return NextResponse.json(
            {
              error:
                'Failed to get complete content from the page. This is usually a temporary issue.',
              details: lastError,
              suggestion:
                'Please try again in a few moments. The server may be experiencing high load.',
              attempts: MAX_RETRIES + 1,
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: lastError || 'Failed to scrape after multiple attempts' },
          { status: lastStatus || 500 }
        );
      } finally {
        // Always release the lock if we acquired one
        if (lockId) {
          await cacheService.releaseLock(url, lockId);
        }
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
