import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { PROCESSING_CONFIG } from "@/constants";
import { isValidDocumentationUrl } from "@/utils/url-utils";

interface PlaywrightScrapeMetadata {
  sourceURL?: string;
  url?: string;
  title?: string;
  requestedURL?: string;
  provider: "playwright";
  status?: number;
  [key: string]: unknown;
}

export interface PlaywrightScrapeResponse {
  success: boolean;
  error?: string;
  data?: {
    markdown?: string;
    metadata?: PlaywrightScrapeMetadata;
  };
}

interface PageExtractionResult {
  markdown: string;
  blockedReason?: string;
  metadata: PlaywrightScrapeMetadata;
}

export interface PlaywrightScrapeOptions {
  waitFor?: number;
  timeout?: number;
}

export class PlaywrightRequestError extends Error {
  status: number;
  retryable: boolean;
  details?: unknown;

  constructor(message: string, status: number, retryable = false, details?: unknown) {
    super(message);
    this.name = "PlaywrightRequestError";
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const DNS_NEGATIVE_CACHE_TTL_MS = 30 * 1000;

const dnsResolutionCache = new Map<
  string,
  { promise: Promise<string | null>; expiresAt: number }
>();

export async function scrapePlaywrightUrl(
  url: string,
  options: PlaywrightScrapeOptions = {},
): Promise<PlaywrightScrapeResponse> {
  await assertAllowedPlaywrightNavigationUrl(url);

  const timeout =
    readPositiveInteger(process.env.PLAYWRIGHT_TIMEOUT_MS, options.timeout) ??
    PROCESSING_CONFIG.FIRECRAWL_TIMEOUT;
  const waitFor =
    readPositiveInteger(process.env.PLAYWRIGHT_WAIT_MS, options.waitFor) ??
    PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME;

  let browser: import("playwright").Browser | null = null;
  let context: import("playwright").BrowserContext | null = null;

  try {
    const { chromium } = await import("playwright");
    const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT?.trim();

    if (wsEndpoint) {
      throw new PlaywrightRequestError(
        "PLAYWRIGHT_WS_ENDPOINT is not supported because remote browser DNS cannot be pinned safely. Unset it to launch local Chromium.",
        500,
        false,
      );
    }

    const navigationHost = normalizeHostname(new URL(url).hostname);
    const pinnedAddress = await resolvePublicHostname(navigationHost);

    if (!pinnedAddress) {
      throw new PlaywrightRequestError(
        "Playwright navigation was blocked because the URL does not resolve to a public address.",
        400,
        false,
        { url },
      );
    }

    browser = await chromium.launch({
      headless: true,
      timeout,
      args: isIP(navigationHost)
        ? []
        : [
            `--host-resolver-rules=MAP ${navigationHost} ${formatHostResolverAddress(pinnedAddress)}`,
          ],
    });

    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; Documentation-Scraper/1.0)",
      javaScriptEnabled: true,
      serviceWorkers: "block",
    });

    let blockedNavigationUrl: string | null = null;

    await context.routeWebSocket("**/*", async (webSocket) => {
      await webSocket.close({
        code: 1008,
        reason: "WebSocket egress is disabled for Playwright scraping.",
      });
    });

    await context.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      const requestUrl = route.request().url();

      if (!isAllowedPlaywrightSameHostRequestUrl(requestUrl, navigationHost, false)) {
        if (resourceType === "document") blockedNavigationUrl = requestUrl;
        await route.abort("blockedbyclient");
        return;
      }

      if (
        resourceType === "document" &&
        !isAllowedPlaywrightSameHostRequestUrl(requestUrl, navigationHost, true)
      ) {
        blockedNavigationUrl = requestUrl;
        await route.abort("blockedbyclient");
        return;
      }

      if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
        await route.abort();
        return;
      }

      await route.continue();
    });

    const page = await context.newPage();

    let response: import("playwright").Response | null = null;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    } catch (error) {
      if (blockedNavigationUrl) {
        throw new PlaywrightRequestError(
          "Playwright navigation was blocked because the final URL is not an allowed public documentation URL.",
          400,
          false,
          { url: blockedNavigationUrl },
        );
      }
      throw error;
    }

    const status = response?.status();
    const finalUrl = response?.url() || page.url();

    assertAllowedPlaywrightSameHostNavigationUrl(finalUrl, navigationHost);

    if (status && status >= 400) {
      throw new PlaywrightRequestError(
        status === 404 ? "Page not found. Please check the URL." : `Page returned HTTP ${status}.`,
        status,
        status >= 500 || status === 429,
      );
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: waitFor });
    } catch {
      // Some documentation sites keep long-polling or analytics requests open.
    }

    const extraction = (await page.evaluate(
      `(() => {\n${PLAYWRIGHT_EXTRACTOR_SOURCE}\nreturn extractMarkdownFromPage(${JSON.stringify(url)});\n})()`,
    )) as PageExtractionResult;

    if (extraction.blockedReason) {
      throw new PlaywrightRequestError(extraction.blockedReason, 403, false, extraction.metadata);
    }

    if (!extraction.markdown.trim()) {
      throw new PlaywrightRequestError("Playwright returned empty page content.", 500, true);
    }

    extraction.metadata.status = status;

    return {
      success: true,
      data: {
        markdown: extraction.markdown,
        metadata: extraction.metadata,
      },
    };
  } catch (error) {
    if (error instanceof PlaywrightRequestError) throw error;

    const message = stripAnsi(error instanceof Error ? error.message : "Unknown Playwright error");
    const isBrowserInstallError = message.includes("Executable doesn't exist");
    const isExtractionError = message.includes("page.evaluate");

    throw new PlaywrightRequestError(
      isBrowserInstallError
        ? "Playwright browser is not installed. Run `pnpm exec playwright install chromium` on the self-hosted server."
        : `Playwright scrape failed: ${message}`,
      500,
      !isBrowserInstallError && !isExtractionError,
    );
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number | undefined,
): number | null {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!parsed || !Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
}

export function isAllowedPlaywrightNavigationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      isValidDocumentationUrl(parsed.toString()) &&
      !isPrivateOrLocalHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedPlaywrightSubresourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !isPrivateOrLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export async function isAllowedPlaywrightNetworkUrl(
  url: string,
  requireDocumentationUrl: boolean,
): Promise<boolean> {
  if (requireDocumentationUrl) {
    if (!isAllowedPlaywrightNavigationUrl(url)) return false;
  } else if (!isAllowedPlaywrightSubresourceUrl(url)) {
    return false;
  }

  const parsed = new URL(url);
  return (await resolvePublicHostname(parsed.hostname)) !== null;
}

export function isAllowedPlaywrightSameHostRequestUrl(
  url: string,
  expectedHostname: string,
  requireDocumentationUrl: boolean,
): boolean {
  try {
    const parsed = new URL(url);
    const host = normalizeHostname(parsed.hostname);

    if (host !== normalizeHostname(expectedHostname)) return false;
    if (requireDocumentationUrl) return isAllowedPlaywrightNavigationUrl(url);
    return isAllowedPlaywrightSubresourceUrl(url);
  } catch {
    return false;
  }
}

async function assertAllowedPlaywrightNavigationUrl(url: string): Promise<void> {
  if (await isAllowedPlaywrightNetworkUrl(url, true)) return;

  throw new PlaywrightRequestError(
    "Playwright navigation was blocked because the URL is not an allowed public documentation URL.",
    400,
    false,
    { url },
  );
}

function assertAllowedPlaywrightSameHostNavigationUrl(url: string, expectedHostname: string): void {
  if (isAllowedPlaywrightSameHostRequestUrl(url, expectedHostname, true)) return;

  throw new PlaywrightRequestError(
    "Playwright navigation was blocked because the final URL is not an allowed public documentation URL.",
    400,
    false,
    { url },
  );
}

async function resolvePublicHostname(hostname: string): Promise<string | null> {
  const host = normalizeHostname(hostname);

  if (isPrivateOrLocalHostname(host)) return null;
  if (isIP(host)) return host;

  const now = Date.now();
  let cached = dnsResolutionCache.get(host);
  if (!cached || cached.expiresAt <= now) {
    const promise = lookup(host, { all: true, verbatim: true })
      .then((records) => {
        const safeRecord = records.find((record) => !isPrivateOrLocalHostname(record.address));
        return safeRecord?.address || null;
      })
      .catch(() => null);
    cached = { promise, expiresAt: now + DNS_CACHE_TTL_MS };
    dnsResolutionCache.set(host, cached);
  }

  const result = await cached.promise;
  if (result === null) {
    const current = dnsResolutionCache.get(host);
    if (current?.promise === cached.promise) {
      current.expiresAt = Date.now() + DNS_NEGATIVE_CACHE_TTL_MS;
    }
  }
  return result;
}

function formatHostResolverAddress(address: string): string {
  return address.includes(":") ? `[${address}]` : address;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  if (host === "::" || host === "::1") {
    return true;
  }

  if (host.startsWith("::ffff:")) {
    return true;
  }

  if (host.includes(":")) {
    const firstHextet = Number.parseInt(host.split(":")[0] || "0", 16);
    return (
      (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
      (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
      (firstHextet >= 0xfec0 && firstHextet <= 0xfeff)
    );
  }

  const octets = host.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && octets[2] === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

const PLAYWRIGHT_EXTRACTOR_SOURCE = String.raw`
function extractMarkdownFromPage(requestedURL) {
  function selectContentRoot() {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.theme-doc-markdown',
      '.documentation',
      '.docs',
      '.content',
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim()) return element;
    }
    return document.body;
  }

  function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ');
  }

  function languageFromCodeElement(code) {
    const className = (code && code.getAttribute('class')) || '';
    const match = className.match(/language-([a-z0-9_-]+)/i);
    return (match && match[1]) || '';
  }

  function tableToMarkdown(element) {
    const rows = Array.from(element.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.querySelectorAll('th,td'))
          .map((cell) => normalizeWhitespace(cell.textContent).replace(/\|/g, '\\|'))
          .filter(Boolean),
      )
      .filter((cells) => cells.length > 0);
    if (rows.length === 0) return '';
    const header = rows[0];
    const separator = header.map(() => '---');
    const body = rows.slice(1);
    return '\n\n' + [header, separator, ...body].map((cells) => '| ' + cells.join(' | ') + ' |').join('\n') + '\n\n';
  }

  function childMarkdown(element, listDepth) {
    return Array.from(element.childNodes).map((child) => nodeToMarkdown(child, listDepth)).join('');
  }

  function listItemToMarkdown(element, orderedIndex, listDepth) {
    if (element.tagName.toLowerCase() !== 'li') return '';
    const marker = orderedIndex ? String(orderedIndex) + '.' : '-';
    const indent = '  '.repeat(listDepth);
    const text = childMarkdown(element, listDepth + 1)
      .trim()
      .replace(/\n{2,}/g, '\n')
      .replace(/\n/g, '\n' + indent + '  ');
    return text ? indent + marker + ' ' + text + '\n' : '';
  }

  function nodeToMarkdown(node, listDepth) {
    listDepth = listDepth || 0;
    if (node.nodeType === Node.TEXT_NODE) return normalizeWhitespace(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node;
    const tag = element.tagName.toLowerCase();

    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';

    if (/^h[1-6]$/.test(tag)) {
      const level = Number.parseInt(tag.slice(1), 10);
      const text = childMarkdown(element, listDepth).trim();
      return text ? '\n\n' + '#'.repeat(level) + ' ' + text + '\n\n' : '';
    }

    if (tag === 'pre') {
      const code = element.querySelector('code');
      const language = languageFromCodeElement(code);
      const text = ((code && code.textContent) || element.textContent || '').replace(/\n+$/, '');
      return text ? '\n\n\`\`\`' + language + '\n' + text + '\n\`\`\`\n\n' : '';
    }

    if (tag === 'code') {
      const text = normalizeWhitespace(element.textContent);
      const tick = String.fromCharCode(96);
      return text ? tick + text.replace(new RegExp(tick, 'g'), '\\' + tick) + tick : '';
    }

    if (tag === 'a') {
      const text = childMarkdown(element, listDepth).trim() || normalizeWhitespace(element.textContent);
      const href = element.getAttribute('href');
      if (!text) return '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text;
      try {
        return '[' + text + '](' + new URL(href, window.location.href).href + ')';
      } catch {
        return text;
      }
    }

    if (tag === 'ul' || tag === 'ol') {
      return '\n' + Array.from(element.children)
        .map((child, index) => listItemToMarkdown(child, tag === 'ol' ? index + 1 : null, listDepth))
        .join('') + '\n';
    }

    if (tag === 'table') return tableToMarkdown(element);

    if (['p', 'div', 'section', 'article', 'main', 'blockquote'].includes(tag)) {
      const text = childMarkdown(element, listDepth).trim();
      if (!text) return '';
      return tag === 'blockquote' ? '\n\n> ' + text + '\n\n' : '\n\n' + text + '\n\n';
    }

    return childMarkdown(element, listDepth);
  }

  function normalizeMarkdown(markdown) {
    return markdown
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');
  }

  const bodyText = (document.body && document.body.innerText) || '';
  const lowerBodyText = bodyText.toLowerCase();
  const titleText = (document.title || '').toLowerCase();
  const verificationIndicators = [
    'verify you are human',
    'checking your browser',
    'enable javascript and cookies',
    'attention required',
    'access denied',
  ];
  function looksLikeVerificationWall() {
    const shortBody = lowerBodyText.length < 2000;
    const hasChallengeContainer = Boolean(
      document.querySelector('[id*="challenge"],[class*="challenge"],[id*="captcha"],[class*="captcha"],.cf-browser-verification'),
    );
    const strongBodySignals = [
      'verify you are human',
      'checking your browser',
      'enable javascript and cookies',
    ];
    const weakBodySignals = ['attention required', 'access denied'];
    const hasStrongTitle = strongBodySignals.some((indicator) => titleText.includes(indicator));
    const hasWeakTitle = weakBodySignals.some((indicator) => titleText.includes(indicator));
    return (
      hasStrongTitle ||
      hasChallengeContainer ||
      strongBodySignals.some((indicator) => lowerBodyText.includes(indicator)) ||
      (shortBody && hasWeakTitle) ||
      (shortBody && weakBodySignals.some((indicator) => lowerBodyText.includes(indicator)))
    );
  }
  const metadata = {
    sourceURL: window.location.href,
    url: window.location.href,
    title: document.title || undefined,
    requestedURL,
    provider: 'playwright',
  };

  if (looksLikeVerificationWall()) {
    return {
      markdown: '',
      blockedReason: 'Page appears to be behind a verification wall. Playwright cannot extract it honestly.',
      metadata,
    };
  }

  const root = selectContentRoot();
  const clone = root.cloneNode(true);
  clone
    .querySelectorAll('script,style,noscript,svg,canvas,iframe,nav,header,footer,aside,form,button,input,select,textarea,[aria-hidden="true"]')
    .forEach((node) => node.remove());

  return {
    markdown: normalizeMarkdown(nodeToMarkdown(clone)),
    metadata,
  };
}
`;
