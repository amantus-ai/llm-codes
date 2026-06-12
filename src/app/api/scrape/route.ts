import { NextRequest, NextResponse } from "next/server";
import { getSupportedDomainsText, isValidDocumentationUrl } from "@/utils/url-utils";
import { PROCESSING_CONFIG } from "@/constants";
import { cacheService } from "@/lib/cache/redis-cache";
import {
  FirecrawlRequestError,
  getIncompleteContentReason,
  isCacheableFirecrawlContent,
  readFirecrawlMarkdown,
  scrapeFirecrawlUrl,
} from "@/lib/firecrawl";
import { PlaywrightRequestError, scrapePlaywrightUrl } from "@/lib/playwright-scraper";
import {
  getProviderCacheKey,
  getProviderName,
  resolveScrapeProvider,
  ScrapeProvider,
  ScrapeProviderConfigError,
} from "@/lib/scrape-provider";

interface CachedScrapePayload {
  cacheVersion: 1;
  markdown: string;
  metadata?: Record<string, unknown>;
}

interface DecodedCachedScrape {
  markdown: string;
  metadata: Record<string, unknown>;
}

const SCRAPE_CACHE_VERSION = 1;

export async function POST(request: NextRequest) {
  let action: string | undefined;

  try {
    const body = await request.json();
    const { url, codeBlocksOnly = false } = body;
    action = body.action;
    const provider = resolveScrapeProvider();
    const providerName = getProviderName(provider);
    const cacheKey = getProviderCacheKey(provider, url);

    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        {
          error: `Invalid URL. Must be from a supported documentation site. ${getSupportedDomainsText()}.`,
        },
        { status: 400 },
      );
    }

    if (action === "scrape") {
      // Check cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const cachedScrape =
          provider === "playwright"
            ? decodeCachedScrape(cached, provider, url)
            : decodeLegacyCachedScrape(cached, provider, url);

        if (getIncompleteContentReason(cachedScrape.markdown)) {
          await cacheService.delete(cacheKey);
          console.warn(
            `Removed truncated cached content for ${url} (${cachedScrape.markdown.length} chars)`,
          );
        } else {
          return NextResponse.json({
            success: true,
            data: {
              markdown: cachedScrape.markdown,
              metadata: cachedScrape.metadata,
            },
            cached: true,
            provider,
            codeBlocksOnly, // Pass through the parameter
          });
        }
      }

      // Try to acquire lock for this URL
      const lockId = await cacheService.acquireLock(cacheKey);

      if (!lockId) {
        // Another process is already scraping this URL
        console.warn(`URL ${url} is already being processed, waiting for completion...`);

        // Wait for the lock to be released
        const lockReleased = await cacheService.waitForLock(cacheKey);

        if (lockReleased) {
          // Check cache again - the other process should have populated it
          const cachedAfterWait = await cacheService.get(cacheKey);
          if (cachedAfterWait) {
            const cachedScrape =
              provider === "playwright"
                ? decodeCachedScrape(cachedAfterWait, provider, url)
                : decodeLegacyCachedScrape(cachedAfterWait, provider, url);
            return NextResponse.json({
              success: true,
              data: {
                markdown: cachedScrape.markdown,
                metadata: cachedScrape.metadata,
              },
              cached: true,
              waitedForLock: true,
              provider,
              codeBlocksOnly, // Pass through the parameter
            });
          }
        }

        // If we still don't have content, proceed with scraping
        console.warn(`Lock wait timeout or no cached content for ${url}, proceeding with scrape`);
      }

      try {
        const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY?.trim();

        if (provider === "firecrawl") {
          if (!FIRECRAWL_API_KEY) {
            return NextResponse.json(
              {
                error:
                  "Server configuration error: FIRECRAWL_API_KEY is required when SCRAPE_PROVIDER=firecrawl.",
              },
              { status: 500 },
            );
          }

          // Check circuit breaker before attempting to scrape
          const canRequest = await cacheService.firecrawlCircuitBreaker.canRequest();

          if (!canRequest) {
            console.error(`Circuit breaker is OPEN for Firecrawl API, failing fast for ${url}`);
            return NextResponse.json(
              {
                error: "Documentation service is temporarily unavailable",
                details:
                  "The service is experiencing high failure rates. Please try again in a minute.",
                provider,
                circuitBreaker: "open",
              },
              { status: 503 },
            );
          }
        }

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
              `Retry attempt ${attempt}/${MAX_RETRIES} for ${url}, waiting ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          try {
            const data =
              provider === "firecrawl"
                ? await scrapeFirecrawlUrl(FIRECRAWL_API_KEY!, url, {
                    formats: ["markdown"],
                    waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
                    timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
                  })
                : await scrapePlaywrightUrl(url, {
                    waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
                    timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
                  });

            const markdown = readFirecrawlMarkdown(data);
            const incompleteReason = getIncompleteContentReason(markdown);

            if (incompleteReason) {
              lastError = `Truncated content detected: ${incompleteReason}`;
              console.error(`Received suspicious content for ${url}: ${incompleteReason}`);
              console.error(`Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
              continue;
            }

            if (!markdown) {
              lastError =
                data.error ||
                (!data.success
                  ? "Firecrawl returned success: false"
                  : !data.data
                    ? "No data object in response"
                    : "No markdown content in response");
              break;
            }

            if (isCacheableFirecrawlContent(markdown)) {
              await cacheService.set(
                cacheKey,
                provider === "playwright"
                  ? encodeCachedScrape(
                      markdown,
                      buildScrapeMetadata(data.data?.metadata, provider, url, false),
                    )
                  : markdown,
              );
            } else {
              console.warn(`Content for ${url} is short (${markdown.length} chars) but proceeding`);
            }

            if (provider === "firecrawl") {
              await cacheService.firecrawlCircuitBreaker.recordSuccess();
              cacheService.incrementFirecrawlFetches();
            }

            return NextResponse.json({
              success: true,
              data: {
                markdown,
                metadata: buildScrapeMetadata(data.data?.metadata, provider, url, false),
              },
              cached: false,
              provider,
              retriesUsed: attempt,
              contentLength: markdown.length,
              codeBlocksOnly,
            });
          } catch (error) {
            if (error instanceof FirecrawlRequestError || error instanceof PlaywrightRequestError) {
              lastError = error.message;
              lastStatus = error.status;
              const retryable =
                error instanceof FirecrawlRequestError
                  ? RETRY_STATUS_CODES.includes(error.status)
                  : error.retryable;

              if (!retryable || attempt === MAX_RETRIES) {
                if (provider === "firecrawl" && retryable) {
                  await cacheService.firecrawlCircuitBreaker.recordFailure();
                }
                const errorResponse: { error: string; provider: string; details?: unknown } = {
                  error: error.message,
                  provider,
                };
                if (error.details) errorResponse.details = error.details;
                return NextResponse.json(errorResponse, { status: error.status });
              }
              continue;
            }

            lastError = error instanceof Error ? error.message : "Unknown error occurred";
            lastStatus = 500;

            if (attempt === MAX_RETRIES) {
              // Record failure in circuit breaker
              if (provider === "firecrawl") {
                await cacheService.firecrawlCircuitBreaker.recordFailure();
              }
              console.error(
                `Failed to scrape ${url} with ${providerName} after ${MAX_RETRIES + 1} attempts:`,
                error,
              );
              return NextResponse.json(
                {
                  error: `Network error after ${MAX_RETRIES + 1} attempts: ${lastError}`,
                  provider,
                },
                { status: 500 },
              );
            }
          }
        }

        // If we got here, all retries failed
        // Record failure in circuit breaker
        if (provider === "firecrawl") {
          await cacheService.firecrawlCircuitBreaker.recordFailure();
        }

        // Provide helpful error message for truncated content
        if (lastError?.includes("Truncated content")) {
          return NextResponse.json(
            {
              error:
                "Failed to get complete content from the page. This is usually a temporary issue.",
              details: lastError,
              suggestion:
                "Please try again in a few moments. The server may be experiencing high load.",
              attempts: MAX_RETRIES + 1,
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          { error: lastError || "Failed to scrape after multiple attempts", provider },
          { status: lastStatus || 500 },
        );
      } finally {
        // Always release the lock if we acquired one
        if (lockId) {
          await cacheService.releaseLock(cacheKey, lockId);
        }
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof ScrapeProviderConfigError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("API Error:", error);
    // Cache statistics logged even on error
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    // Cache statistics tracked at the end of request
    if (action === "scrape") {
      // Stats available via cacheService.getStats()
    }
  }
}

function encodeCachedScrape(markdown: string, metadata: Record<string, unknown>): string {
  const payload: CachedScrapePayload = {
    cacheVersion: SCRAPE_CACHE_VERSION,
    markdown,
    metadata,
  };
  return JSON.stringify(payload);
}

function decodeCachedScrape(
  cached: string,
  provider: ScrapeProvider,
  requestedUrl: string,
): DecodedCachedScrape {
  try {
    const parsed = JSON.parse(cached) as Partial<CachedScrapePayload>;
    if (parsed.cacheVersion === SCRAPE_CACHE_VERSION && typeof parsed.markdown === "string") {
      return {
        markdown: parsed.markdown,
        metadata: buildScrapeMetadata(parsed.metadata, provider, requestedUrl, true),
      };
    }
  } catch {
    // Legacy cache entries are raw markdown strings.
  }

  return {
    markdown: cached,
    metadata: buildScrapeMetadata(undefined, provider, requestedUrl, true),
  };
}

function decodeLegacyCachedScrape(
  cached: string,
  provider: ScrapeProvider,
  requestedUrl: string,
): DecodedCachedScrape {
  return {
    markdown: cached,
    metadata: buildScrapeMetadata(undefined, provider, requestedUrl, true),
  };
}

function buildScrapeMetadata(
  metadata: Record<string, unknown> | undefined,
  provider: ScrapeProvider,
  requestedUrl: string,
  cached: boolean,
): Record<string, unknown> {
  return {
    sourceURL: requestedUrl,
    url: requestedUrl,
    ...metadata,
    provider,
    cached,
  };
}
