import { describe, expect, it } from "vitest";
import {
  getProviderCacheKey,
  resolveScrapeProvider,
  ScrapeProviderConfigError,
} from "@/lib/scrape-provider";

describe("scrape-provider", () => {
  it("defaults to Firecrawl", () => {
    expect(resolveScrapeProvider(undefined)).toBe("firecrawl");
  });

  it("accepts Playwright case-insensitively", () => {
    expect(resolveScrapeProvider(" Playwright ")).toBe("playwright");
  });

  it("rejects unsupported providers", () => {
    expect(() => resolveScrapeProvider("crawl4ai")).toThrow(ScrapeProviderConfigError);
  });

  it("keeps Firecrawl cache keys stable and scopes Playwright keys", () => {
    expect(getProviderCacheKey("firecrawl", "https://docs.example.com")).toBe(
      "https://docs.example.com",
    );
    expect(getProviderCacheKey("playwright", "https://docs.example.com")).toBe(
      "playwright:https://docs.example.com",
    );
  });
});
