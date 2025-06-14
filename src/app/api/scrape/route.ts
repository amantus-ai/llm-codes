import { NextRequest, NextResponse } from 'next/server';
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

// Cache implementation using Edge Runtime KV storage would go here
// For now, we'll use in-memory cache (resets on deployment)
const cache = new Map<string, { content: string; timestamp: number }>();

export async function POST(request: NextRequest) {
  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { url, action } = body;

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
      // Check cache
      const cacheKey = `scrape_${url}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROCESSING_CONFIG.CACHE_DURATION) {
        // Validate cached content isn't truncated
        if (cached.content.length < 200 && cached.content.trim().startsWith('[Skip Navigation]')) {
          // Remove invalid cached entry
          cache.delete(cacheKey);
          console.warn(
            `Removed truncated cached content for ${url} (${cached.content.length} chars)`
          );
        } else {
          return NextResponse.json({
            success: true,
            data: { markdown: cached.content },
            cached: true,
          });
        }
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
          console.warn(`Retry attempt ${attempt}/${MAX_RETRIES} for ${url}, waiting ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        try {
          const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
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
              timeout: 30000, // Add explicit timeout
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Documentation-Scraper/1.0)',
              },
            }),
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
                cache.set(cacheKey, {
                  content: markdown,
                  timestamp: Date.now(),
                });
              } else {
                console.warn(`Content for ${url} is short (${contentLength} chars) but proceeding`);
              }

              return NextResponse.json({
                success: true,
                data: { markdown },
                cached: false,
                retriesUsed: attempt,
                contentLength, // Include length in response for debugging
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
            // Don't retry for non-retryable errors or if we've exhausted retries
            return NextResponse.json({ error: errorMessage }, { status: response.status });
          }
        } catch (error) {
          // Network or other error
          lastError = error instanceof Error ? error.message : 'Unknown error occurred';
          lastStatus = 500;

          if (attempt === MAX_RETRIES) {
            console.error(`Failed to scrape ${url} after ${MAX_RETRIES + 1} attempts:`, error);
            return NextResponse.json(
              { error: `Network error after ${MAX_RETRIES + 1} attempts: ${lastError}` },
              { status: 500 }
            );
          }
        }
      }

      // If we got here, all retries failed
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
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
