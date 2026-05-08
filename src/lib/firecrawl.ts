import { PROCESSING_CONFIG } from "@/constants";
import { http2Fetch } from "@/lib/http2-client";

export const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

export interface FirecrawlScrapeResponse {
  success: boolean;
  error?: string;
  data?: {
    markdown?: string;
    content?: string;
    data?: {
      markdown?: string;
    };
    metadata?: {
      sourceURL?: string;
      url?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  markdown?: string;
}

export interface FirecrawlCrawlStartResponse {
  success?: boolean;
  id?: string;
  error?: string;
  creditsUsed?: number;
}

export interface FirecrawlCrawlOptions {
  limit: number;
  maxDepth: number;
}

export interface FirecrawlCrawlPage {
  markdown?: string;
  metadata?: {
    sourceURL?: string;
    url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface FirecrawlCrawlStatusResponse {
  status?: string;
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  next?: string;
  data?: FirecrawlCrawlPage[];
}

export interface FirecrawlScrapeOptions {
  formats?: string[];
  waitFor?: number;
  timeout?: number;
  onlyMainContent?: boolean;
  removeBase64Images?: boolean;
  skipTlsVerification?: boolean;
}

export class FirecrawlRequestError extends Error {
  status: number;
  retryable: boolean;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "FirecrawlRequestError";
    this.status = status;
    this.retryable = isRetryableFirecrawlStatus(status);
    this.details = details;
  }

  static async fromResponse(response: Response): Promise<FirecrawlRequestError> {
    let message = `Firecrawl API error (${response.status})`;
    let details: unknown;

    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText) as {
            error?: string;
            message?: string;
            details?: unknown;
          };
          message = errorData.error || errorData.message || errorText;
          details = errorData.details;
        } catch {
          message = `Firecrawl API error: ${errorText}`;
        }
      }
    } catch {
      // Keep default message when the error body cannot be read.
    }

    return new FirecrawlRequestError(
      userFacingFirecrawlError(response.status, message),
      response.status,
      details,
    );
  }
}

export function isRetryableFirecrawlStatus(status: number): boolean {
  return PROCESSING_CONFIG.RETRY_STATUS_CODES.includes(status);
}

export function userFacingFirecrawlError(status: number, fallback: string): string {
  if (status === 429) return "Rate limit exceeded. Please try again in a few moments.";
  if (status === 403) return "Access forbidden. The API key might be invalid.";
  if (status === 404) return "Page not found. Please check the URL.";
  if (status === 500) return "Firecrawl server error. Please try again later.";
  if (status === 502) return "Server temporarily unavailable. Please try again.";
  if (status === 503) return "Service unavailable. Please try again.";
  if (status === 504) return "Gateway timeout. Please try again.";
  return fallback;
}

export function readFirecrawlMarkdown(response: FirecrawlScrapeResponse): string | null {
  const markdown =
    response.data?.markdown ||
    response.markdown ||
    response.data?.content ||
    response.data?.data?.markdown;

  return typeof markdown === "string" ? markdown : null;
}

export function getIncompleteContentReason(
  markdown: string | null,
  minLength = PROCESSING_CONFIG.MIN_CONTENT_LENGTH,
): string | null {
  if (!markdown) return "empty content";

  const contentLength = markdown.length;
  const trimmed = markdown.trim();

  if (contentLength === 82 && trimmed.startsWith("[Skip Navigation]")) {
    return `navigation-only content (${contentLength} chars)`;
  }

  if (
    contentLength < minLength &&
    (trimmed.startsWith("[Skip Navigation]") ||
      trimmed === "Skip Navigation" ||
      trimmed.endsWith("...") ||
      trimmed.includes("Loading") ||
      trimmed.includes("Please wait"))
  ) {
    return `incomplete placeholder content (${contentLength} chars)`;
  }

  if (!trimmed.includes("#") && contentLength < 500) {
    return `unstructured short content (${contentLength} chars)`;
  }

  return null;
}

export function isCacheableFirecrawlContent(markdown: string): boolean {
  return markdown.length >= PROCESSING_CONFIG.MIN_CONTENT_LENGTH;
}

export async function scrapeFirecrawlUrl(
  apiKey: string,
  url: string,
  options: FirecrawlScrapeOptions = {},
): Promise<FirecrawlScrapeResponse> {
  const response = await firecrawlFetch(apiKey, "/scrape", {
    method: "POST",
    body: JSON.stringify({
      url,
      formats: options.formats || ["markdown"],
      onlyMainContent: options.onlyMainContent ?? true,
      waitFor: options.waitFor ?? PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
      timeout: options.timeout ?? PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
      removeBase64Images: options.removeBase64Images,
      skipTlsVerification: options.skipTlsVerification,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Documentation-Scraper/1.0)",
      },
    }),
  });

  return (await response.json()) as FirecrawlScrapeResponse;
}

export async function startFirecrawlCrawl(
  apiKey: string,
  url: string,
  options: FirecrawlCrawlOptions,
): Promise<FirecrawlCrawlStartResponse> {
  const response = await firecrawlFetch(apiKey, "/crawl", {
    method: "POST",
    body: JSON.stringify({
      url,
      limit: options.limit,
      maxDepth: options.maxDepth,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
        timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Documentation-Scraper/1.0)",
        },
      },
    }),
  });

  return (await response.json()) as FirecrawlCrawlStartResponse;
}

export async function getFirecrawlCrawlStatus(
  apiKey: string,
  statusUrl: string,
): Promise<FirecrawlCrawlStatusResponse> {
  const response = await firecrawlFetch(apiKey, statusUrl, {
    method: "GET",
    timeout: 30000,
  });

  return (await response.json()) as FirecrawlCrawlStatusResponse;
}

async function firecrawlFetch(
  apiKey: string,
  pathOrUrl: string,
  init: {
    method: "GET" | "POST";
    body?: string;
    timeout?: number;
  },
): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${FIRECRAWL_API_URL}${pathOrUrl}`;
  const response = await http2Fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body,
    signal: AbortSignal.timeout(init.timeout ?? PROCESSING_CONFIG.FETCH_TIMEOUT),
  });

  if (!response.ok) {
    throw await FirecrawlRequestError.fromResponse(response);
  }

  return response;
}
