export interface FirecrawlScrapeResponse {
  success: boolean;
  markdown?: string;
  data?: {
    content?: string;
    markdown?: string;
  };
}

export interface ProgressiveTimeoutConfig {
  initialTimeout: number; // Starting timeout in ms
  maxTimeout: number; // Maximum timeout in ms
  timeoutIncrement: number; // How much to increase each iteration
  waitTime: number; // Wait time for JS rendering
  maxRetries: number; // Maximum retry attempts
}

export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveTimeoutConfig = {
  initialTimeout: 10000, // Start with 10 seconds
  maxTimeout: 60000, // Max 60 seconds
  timeoutIncrement: 10000, // Increase by 10 seconds each time
  waitTime: 5000, // Initial wait time for JS
  maxRetries: 3, // Try up to 3 times with increasing timeouts
};

export interface ScrapeResult {
  data: FirecrawlScrapeResponse;
  attemptCount: number;
  finalTimeout: number;
  totalTime: number;
}

/**
 * Determines if content appears to be fully loaded based on heuristics
 */
function isContentReady(content: string | null): boolean {
  if (!content) return false;

  // Check for minimum content length
  if (content.length < 500) return false;

  // Check for common loading indicators
  const loadingIndicators = [
    'loading...',
    'please wait',
    'initializing',
    'fetching data',
    '<div class="spinner"',
    '<div class="loader"',
    'skeleton-loader',
  ];

  const contentLower = content.toLowerCase();
  const hasLoadingIndicator = loadingIndicators.some((indicator) =>
    contentLower.includes(indicator)
  );

  if (hasLoadingIndicator) return false;

  // Check for reasonable content structure
  const hasHeaders = content.includes('#') || content.includes('<h1') || content.includes('<h2');
  const hasParagraphs = content.includes('\n\n') || content.includes('<p>');
  const hasCodeBlocks = content.includes('```') || content.includes('<code');

  // Consider content ready if it has some structure
  return hasHeaders || (hasParagraphs && content.length > 1000) || hasCodeBlocks;
}

/**
 * Calculate dynamic wait time based on URL characteristics
 */
function calculateWaitTime(url: string, baseWaitTime: number): number {
  const urlLower = url.toLowerCase();

  // Increase wait time for known heavy documentation sites
  if (
    urlLower.includes('react.dev') ||
    urlLower.includes('angular.io') ||
    urlLower.includes('vuejs.org')
  ) {
    return baseWaitTime * 2;
  }

  // Decrease wait time for simple sites
  if (urlLower.includes('/api/') || urlLower.includes('/reference/') || urlLower.includes('.md')) {
    return Math.max(2000, baseWaitTime * 0.5);
  }

  return baseWaitTime;
}

/**
 * Scrape with progressive timeout strategy
 */
interface ScrapeOptions {
  formats?: string[];
  waitFor?: number;
  timeout?: number;
  removeBase64Images?: boolean;
  skipTlsVerification?: boolean;
}

export async function scrapeWithProgressiveTimeout(
  scrapeFn: (url: string, options: ScrapeOptions) => Promise<FirecrawlScrapeResponse>,
  url: string,
  config: ProgressiveTimeoutConfig = DEFAULT_PROGRESSIVE_CONFIG
): Promise<ScrapeResult> {
  let currentTimeout = config.initialTimeout;
  let attemptCount = 0;
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (attemptCount < config.maxRetries && currentTimeout <= config.maxTimeout) {
    attemptCount++;

    try {
      // Calculate dynamic wait time based on URL
      const waitTime = calculateWaitTime(url, config.waitTime);

      // Attempt to scrape with current timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), currentTimeout);

      const scrapePromise = scrapeFn(url, {
        formats: ['markdown'],
        waitFor: waitTime,
        timeout: Math.floor(currentTimeout / 1000), // Firecrawl expects seconds
        removeBase64Images: true,
        skipTlsVerification: false,
      });

      // Race between scrape and timeout
      const result = await Promise.race([
        scrapePromise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Progressive timeout after ${currentTimeout}ms`));
          });
        }),
      ]);

      clearTimeout(timeoutId);

      // Check if content is ready
      const content = result.markdown || result.data?.markdown || result.data?.content || null;
      if (isContentReady(content)) {
        return {
          data: result,
          attemptCount,
          finalTimeout: currentTimeout,
          totalTime: Date.now() - startTime,
        };
      }

      // Content not ready, increase timeout for next attempt
      currentTimeout = Math.min(currentTimeout + config.timeoutIncrement, config.maxTimeout);
    } catch (error) {
      lastError = error as Error;

      // If it's not a timeout error, throw immediately
      if (!(error instanceof Error) || !error.message?.includes('timeout')) {
        throw error;
      }

      // Increase timeout for next attempt
      currentTimeout = Math.min(currentTimeout + config.timeoutIncrement, config.maxTimeout);
    }
  }

  // If we've exhausted retries, throw the last error
  throw lastError || new Error(`Failed to scrape after ${attemptCount} attempts`);
}

/**
 * Create a custom progressive timeout configuration based on URL type
 */
export function createCustomConfig(url: string): ProgressiveTimeoutConfig {
  const urlLower = url.toLowerCase();

  // Fast config for simple documentation
  if (urlLower.includes('/api/') || urlLower.includes('.md')) {
    return {
      initialTimeout: 5000,
      maxTimeout: 20000,
      timeoutIncrement: 5000,
      waitTime: 2000,
      maxRetries: 2,
    };
  }

  // Slower config for complex SPAs
  if (
    urlLower.includes('react.dev') ||
    urlLower.includes('angular.io') ||
    urlLower.includes('nextjs.org')
  ) {
    return {
      initialTimeout: 15000,
      maxTimeout: 90000,
      timeoutIncrement: 15000,
      waitTime: 10000,
      maxRetries: 4,
    };
  }

  // Default config for everything else
  return DEFAULT_PROGRESSIVE_CONFIG;
}

/**
 * Batch scraping with progressive timeout
 */
export async function batchScrapeWithProgressiveTimeout(
  scrapeFn: (url: string, options: ScrapeOptions) => Promise<FirecrawlScrapeResponse>,
  urls: string[],
  config?: ProgressiveTimeoutConfig
): Promise<Map<string, ScrapeResult | Error>> {
  const results = new Map<string, ScrapeResult | Error>();

  await Promise.all(
    urls.map(async (url) => {
      try {
        const customConfig = config || createCustomConfig(url);
        const result = await scrapeWithProgressiveTimeout(scrapeFn, url, customConfig);
        results.set(url, result);
      } catch (error) {
        results.set(url, error as Error);
      }
    })
  );

  return results;
}
