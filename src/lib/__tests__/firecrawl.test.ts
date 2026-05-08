import { beforeEach, describe, expect, it, vi } from "vitest";
import { http2Fetch } from "@/lib/http2-client";
import {
  FirecrawlRequestError,
  getIncompleteContentReason,
  readFirecrawlMarkdown,
  scrapeFirecrawlUrl,
  startFirecrawlCrawl,
  userFacingFirecrawlError,
} from "@/lib/firecrawl";
import { PROCESSING_CONFIG } from "@/constants";

vi.mock("@/lib/http2-client", () => ({
  http2Fetch: vi.fn(),
}));

describe("firecrawl client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scrapes markdown with the shared Firecrawl request shape", async () => {
    vi.mocked(http2Fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { markdown: "# Docs\n\nContent" },
      }),
    } as unknown as Response);

    const result = await scrapeFirecrawlUrl("test-key", "https://developer.apple.com/docs");

    expect(readFirecrawlMarkdown(result)).toBe("# Docs\n\nContent");
    expect(http2Fetch).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v1/scrape",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(vi.mocked(http2Fetch).mock.calls[0][1]?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        url: "https://developer.apple.com/docs",
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
        timeout: PROCESSING_CONFIG.FIRECRAWL_TIMEOUT,
      }),
    );
  });

  it("starts crawls with the shared crawl request shape", async () => {
    vi.mocked(http2Fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, id: "crawl-123" }),
    } as unknown as Response);

    const result = await startFirecrawlCrawl("test-key", "https://docs.example.com/", {
      limit: 25,
      maxDepth: 3,
    });

    expect(result.id).toBe("crawl-123");
    const body = JSON.parse(vi.mocked(http2Fetch).mock.calls[0][1]?.body as string);
    expect(body.limit).toBe(25);
    expect(body.maxDepth).toBe(3);
    expect(body.scrapeOptions).toEqual(
      expect.objectContaining({
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    );
  });

  it("maps Firecrawl HTTP errors once", async () => {
    vi.mocked(http2Fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: "quota" })),
    } as unknown as Response);

    await expect(scrapeFirecrawlUrl("test-key", "https://docs.example.com/")).rejects.toMatchObject(
      {
        name: "FirecrawlRequestError",
        status: 429,
        retryable: true,
        message: "Rate limit exceeded. Please try again in a few moments.",
      },
    );
  });

  it("keeps detailed error metadata for callers that expose it", async () => {
    const response = {
      ok: false,
      status: 400,
      text: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ message: "bad", details: { field: "url" } })),
    } as unknown as Response;

    const error = await FirecrawlRequestError.fromResponse(response);

    expect(error.message).toBe("bad");
    expect(error.details).toEqual({ field: "url" });
  });

  it("detects incomplete scrape payloads consistently", () => {
    expect(getIncompleteContentReason("[Skip Navigation](#main)")).toContain("placeholder");
    expect(getIncompleteContentReason("Loading...")).toContain("placeholder");
    expect(getIncompleteContentReason("plain short text")).toContain("unstructured");
    expect(getIncompleteContentReason("# Useful docs\n\n" + "content ".repeat(80))).toBeNull();
    expect(userFacingFirecrawlError(504, "raw")).toBe("Gateway timeout. Please try again.");
  });
});
