import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { cacheService } from "@/lib/cache/redis-cache";
import { scrapeFirecrawlUrl } from "@/lib/firecrawl";

vi.mock("@/lib/cache/redis-cache", () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    acquireLock: vi.fn(),
    waitForLock: vi.fn(),
    releaseLock: vi.fn(),
    incrementFirecrawlFetches: vi.fn(),
    firecrawlCircuitBreaker: {
      canRequest: vi.fn(),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    },
  },
}));

vi.mock("@/lib/firecrawl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firecrawl")>();
  return {
    ...actual,
    scrapeFirecrawlUrl: vi.fn(),
  };
});

function scrapeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/scrape", {
    method: "POST",
    body: JSON.stringify({ action: "scrape", ...body }),
  });
}

describe("POST /api/scrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRECRAWL_API_KEY = "test-api-key";
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(cacheService.acquireLock).mockResolvedValue("lock-1");
    vi.mocked(cacheService.waitForLock).mockResolvedValue(false);
    vi.mocked(cacheService.releaseLock).mockResolvedValue(true);
    vi.mocked(cacheService.firecrawlCircuitBreaker.canRequest).mockResolvedValue(true);
    vi.mocked(cacheService.firecrawlCircuitBreaker.recordSuccess).mockResolvedValue(undefined);
    vi.mocked(cacheService.firecrawlCircuitBreaker.recordFailure).mockResolvedValue(undefined);
  });

  it("returns cached content without calling Firecrawl", async () => {
    vi.mocked(cacheService.get).mockResolvedValue("# Cached\n\n" + "content ".repeat(80));

    const response = await POST(
      scrapeRequest({ url: "https://developer.apple.com/documentation/swiftui" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cached).toBe(true);
    expect(scrapeFirecrawlUrl).not.toHaveBeenCalled();
  });

  it("deletes incomplete cached content and refreshes it", async () => {
    vi.mocked(cacheService.get).mockResolvedValueOnce("[Skip Navigation](#main)");
    vi.mocked(scrapeFirecrawlUrl).mockResolvedValue({
      success: true,
      data: { markdown: "# Fresh\n\n" + "content ".repeat(80) },
    });

    const response = await POST(
      scrapeRequest({ url: "https://developer.apple.com/documentation/swiftui" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cached).toBe(false);
    expect(cacheService.delete).toHaveBeenCalledWith(
      "https://developer.apple.com/documentation/swiftui",
    );
    expect(cacheService.set).toHaveBeenCalled();
    expect(cacheService.releaseLock).toHaveBeenCalledWith(
      "https://developer.apple.com/documentation/swiftui",
      "lock-1",
    );
  });

  it("waits for an in-flight scrape and returns the populated cache", async () => {
    vi.mocked(cacheService.acquireLock).mockResolvedValue(null);
    vi.mocked(cacheService.waitForLock).mockResolvedValue(true);
    vi.mocked(cacheService.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("# After wait\n\n" + "content ".repeat(80));

    const response = await POST(
      scrapeRequest({ url: "https://developer.apple.com/documentation/swiftui" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.waitedForLock).toBe(true);
    expect(scrapeFirecrawlUrl).not.toHaveBeenCalled();
  });

  it("retries incomplete Firecrawl content before succeeding", async () => {
    vi.mocked(scrapeFirecrawlUrl)
      .mockResolvedValueOnce({ success: true, data: { markdown: "Loading..." } })
      .mockResolvedValueOnce({
        success: true,
        data: { markdown: "# Complete\n\n" + "content ".repeat(80) },
      });

    const response = await POST(
      scrapeRequest({ url: "https://developer.apple.com/documentation/swiftui" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.retriesUsed).toBe(1);
    expect(scrapeFirecrawlUrl).toHaveBeenCalledTimes(2);
    expect(cacheService.firecrawlCircuitBreaker.recordSuccess).toHaveBeenCalled();
  });

  it("lets the Firecrawl client choose main-content behavior by URL", async () => {
    vi.mocked(scrapeFirecrawlUrl).mockResolvedValue({
      success: true,
      data: { markdown: "# Tailwind\n\n" + "content ".repeat(80) },
    });

    const response = await POST(
      scrapeRequest({ url: "https://tailwindcss.com/docs/installation/using-vite" }),
    );

    expect(response.status).toBe(200);
    expect(scrapeFirecrawlUrl).toHaveBeenCalledWith(
      "test-api-key",
      "https://tailwindcss.com/docs/installation/using-vite",
      expect.not.objectContaining({ onlyMainContent: true }),
    );
  });

  it("fails fast when the circuit breaker is open", async () => {
    vi.mocked(cacheService.firecrawlCircuitBreaker.canRequest).mockResolvedValue(false);

    const response = await POST(
      scrapeRequest({ url: "https://developer.apple.com/documentation/swiftui" }),
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.circuitBreaker).toBe("open");
    expect(scrapeFirecrawlUrl).not.toHaveBeenCalled();
  });

  it("rejects invalid URLs before cache or Firecrawl work", async () => {
    const response = await POST(scrapeRequest({ url: "https://example.com/" }));

    expect(response.status).toBe(400);
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(scrapeFirecrawlUrl).not.toHaveBeenCalled();
  });
});
