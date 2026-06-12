export type ScrapeProvider = "firecrawl" | "playwright";

export class ScrapeProviderConfigError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "ScrapeProviderConfigError";
  }
}

export function resolveScrapeProvider(value = process.env.SCRAPE_PROVIDER): ScrapeProvider {
  const provider = (value || "firecrawl").trim().toLowerCase();

  if (provider === "firecrawl" || provider === "playwright") {
    return provider;
  }

  throw new ScrapeProviderConfigError(
    `Unsupported SCRAPE_PROVIDER "${value}". Use "firecrawl" or "playwright".`,
  );
}

export function getProviderCacheKey(provider: ScrapeProvider, url: string): string {
  if (provider === "firecrawl") return url;
  return `${provider}:${url}`;
}

export function getProviderName(provider: ScrapeProvider): string {
  return provider === "firecrawl" ? "Firecrawl" : "Playwright";
}
