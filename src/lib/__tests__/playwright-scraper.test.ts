import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAllowedPlaywrightNavigationUrl,
  isAllowedPlaywrightNetworkUrl,
  isAllowedPlaywrightSameHostRequestUrl,
  isAllowedPlaywrightSubresourceUrl,
} from "@/lib/playwright-scraper";

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  default: { lookup: lookupMock },
  lookup: lookupMock,
}));

describe("playwright-scraper navigation policy", () => {
  beforeEach(() => {
    vi.useRealTimers();
    lookupMock.mockReset();
  });

  it("allows public documentation URLs", () => {
    expect(isAllowedPlaywrightNavigationUrl("https://docs.python.org/3/library/json.html")).toBe(
      true,
    );
    expect(
      isAllowedPlaywrightNavigationUrl("https://developer.apple.com/documentation/swiftui"),
    ).toBe(true);
  });

  it("blocks localhost and private literal hosts even with documentation paths", () => {
    expect(isAllowedPlaywrightNavigationUrl("https://localhost/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://127.0.0.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://10.0.0.5/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://172.16.0.5/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://192.168.1.5/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://169.254.1.5/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://198.18.0.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://192.0.2.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://192.88.99.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://224.0.0.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://240.0.0.1/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[::1]/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[fd00::1]/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[fc00::1]/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[fe80::1]/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[fec0::1]/docs")).toBe(false);
    expect(isAllowedPlaywrightNavigationUrl("https://[::ffff:127.0.0.1]/docs")).toBe(false);
  });

  it("blocks non-https and non-documentation final URLs", () => {
    expect(isAllowedPlaywrightNavigationUrl("http://docs.python.org/3/library/json.html")).toBe(
      false,
    );
    expect(isAllowedPlaywrightNavigationUrl("https://example.com/")).toBe(false);
  });

  it("allows public HTTPS subresources but blocks private/local subresources", () => {
    expect(isAllowedPlaywrightSubresourceUrl("https://cdn.example.com/app.js")).toBe(true);
    expect(isAllowedPlaywrightSubresourceUrl("http://cdn.example.com/app.js")).toBe(false);
    expect(isAllowedPlaywrightSubresourceUrl("https://127.0.0.1/app.js")).toBe(false);
    expect(isAllowedPlaywrightSubresourceUrl("https://[fd00::1]/app.js")).toBe(false);
    expect(isAllowedPlaywrightSubresourceUrl("https://[::ffff:127.0.0.1]/app.js")).toBe(false);
  });

  it("allows only same-host Playwright requests after DNS pinning", () => {
    expect(
      isAllowedPlaywrightSameHostRequestUrl(
        "https://docs.python.org/static/app.js",
        "docs.python.org",
        false,
      ),
    ).toBe(true);
    expect(
      isAllowedPlaywrightSameHostRequestUrl(
        "https://cdn.python.org/static/app.js",
        "docs.python.org",
        false,
      ),
    ).toBe(false);
    expect(
      isAllowedPlaywrightSameHostRequestUrl(
        "https://docs.python.org/3/library/json.html",
        "docs.python.org",
        true,
      ),
    ).toBe(true);
  });

  it("blocks documentation hostnames that resolve to private addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    await expect(isAllowedPlaywrightNetworkUrl("https://docs.example.com/", true)).resolves.toBe(
      false,
    );
  });

  it("allows public HTTPS subresources that resolve to public addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    await expect(
      isAllowedPlaywrightNetworkUrl("https://cdn.example.com/app.js", false),
    ).resolves.toBe(true);
  });

  it("refreshes DNS pinning after the cache TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-cache-ttl.com/", true),
    ).resolves.toBe(true);
    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-cache-ttl.com/", true),
    ).resolves.toBe(true);
    expect(lookupMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:05:01Z"));

    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-cache-ttl.com/", true),
    ).resolves.toBe(true);
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });

  it("negative-caches rejected DNS lookups briefly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    lookupMock.mockRejectedValue(new Error("temporary DNS failure"));

    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-negative-cache.com/", true),
    ).resolves.toBe(false);
    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-negative-cache.com/", true),
    ).resolves.toBe(false);
    expect(lookupMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));

    await expect(
      isAllowedPlaywrightNetworkUrl("https://docs.example-negative-cache.com/", true),
    ).resolves.toBe(false);
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });
});
