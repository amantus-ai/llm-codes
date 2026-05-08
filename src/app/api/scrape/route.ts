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

export async function POST(request: NextRequest) {
  let action: string | undefined;

  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const body = await request.json();
    const { url, codeBlocksOnly = false } = body;
    action = body.action;

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
      const cached = await cacheService.get(url);
      if (cached) {
        if (getIncompleteContentReason(cached)) {
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
              error: "Documentation service is temporarily unavailable",
              details:
                "The service is experiencing high failure rates. Please try again in a minute.",
              circuitBreaker: "open",
            },
            { status: 503 },
          );
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
            const data = await scrapeFirecrawlUrl(FIRECRAWL_API_KEY, url, {
              formats: ["markdown"],
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
              await cacheService.set(url, markdown);
            } else {
              console.warn(`Content for ${url} is short (${markdown.length} chars) but proceeding`);
            }

            await cacheService.firecrawlCircuitBreaker.recordSuccess();
            cacheService.incrementFirecrawlFetches();

            return NextResponse.json({
              success: true,
              data: { markdown },
              cached: false,
              retriesUsed: attempt,
              contentLength: markdown.length,
              codeBlocksOnly,
            });
          } catch (error) {
            if (error instanceof FirecrawlRequestError) {
              lastError = error.message;
              lastStatus = error.status;

              if (!RETRY_STATUS_CODES.includes(error.status) || attempt === MAX_RETRIES) {
                if (RETRY_STATUS_CODES.includes(error.status)) {
                  await cacheService.firecrawlCircuitBreaker.recordFailure();
                }
                return NextResponse.json({ error: error.message }, { status: error.status });
              }
              continue;
            }

            lastError = error instanceof Error ? error.message : "Unknown error occurred";
            lastStatus = 500;

            if (attempt === MAX_RETRIES) {
              // Record failure in circuit breaker
              await cacheService.firecrawlCircuitBreaker.recordFailure();
              console.error(`Failed to scrape ${url} after ${MAX_RETRIES + 1} attempts:`, error);
              return NextResponse.json(
                { error: `Network error after ${MAX_RETRIES + 1} attempts: ${lastError}` },
                { status: 500 },
              );
            }
          }
        }

        // If we got here, all retries failed
        // Record failure in circuit breaker
        await cacheService.firecrawlCircuitBreaker.recordFailure();

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
          { error: lastError || "Failed to scrape after multiple attempts" },
          { status: lastStatus || 500 },
        );
      } finally {
        // Always release the lock if we acquired one
        if (lockId) {
          await cacheService.releaseLock(url, lockId);
        }
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
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
