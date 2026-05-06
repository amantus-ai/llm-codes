import {
  filterDocumentation,
  is404Page as is404PageFromFilter,
  filterUrlsFromMarkdown as filterUrlsBase,
  filterAvailabilityStrings as filterAvailabilityBase,
  deduplicateMarkdown as deduplicateBase,
} from "./documentation-filter";
import { normalizeUrl } from "./url-utils";

export function is404Page(content: string): boolean {
  return is404PageFromFilter(content);
}

export function filterUrlsFromMarkdown(markdown: string, filterUrls: boolean): string {
  if (!filterUrls) return markdown;
  return filterUrlsBase(markdown);
}

export function removeCommonPhrases(markdown: string): string {
  // Use the comprehensive filter with specific options
  return filterDocumentation(markdown, {
    filterUrls: false,
    filterAvailability: false,
    filterNavigation: true,
    filterLegalBoilerplate: false,
    filterEmptyContent: false,
    filterRedundantTypeAliases: false,
    filterExcessivePlatformNotices: false,
    filterFormattingArtifacts: false,
    deduplicateContent: false,
  });
}

export function filterAvailabilityStrings(markdown: string, filterAvailability: boolean): string {
  if (!filterAvailability) return markdown;
  return filterAvailabilityBase(markdown);
}

export function deduplicateMarkdown(markdown: string, deduplicateContent: boolean): string {
  if (!deduplicateContent) return markdown;
  return deduplicateBase(markdown);
}

export function extractLinks(markdown: string, baseUrl: string): string[] {
  const baseUrlObj = new URL(baseUrl);
  const isAppleDocs = baseUrlObj.hostname === "developer.apple.com";
  const potentialLinks: string[] = [];

  const patterns = [
    /\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    /href="([^"]+)"/g,
    /href='([^']+)'/g,
    /https?:\/\/[^\s<>"{}|\\^\[\]`]+/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const url = match[2] || match[1] || match[0];
      if (
        url &&
        !url.startsWith("#") &&
        !url.startsWith("mailto:") &&
        !url.startsWith("javascript:")
      ) {
        potentialLinks.push(url);
      }
    }
  }

  const resolvedLinks = potentialLinks.flatMap((href) => resolveLink(href, baseUrlObj));
  const allowedOrigins = inferAllowedOrigins(resolvedLinks, baseUrlObj);
  const links = new Set<string>();

  for (const linkUrl of resolvedLinks) {
    if (!allowedOrigins.has(linkUrl.origin)) {
      continue;
    }

    if (!isAllowedDocumentationPath(linkUrl, baseUrlObj, isAppleDocs)) {
      continue;
    }

    links.add(normalizeUrl(linkUrl.href));
  }

  return Array.from(links);
}

function resolveLink(href: string, baseUrl: URL): URL[] {
  try {
    const cleanHref = stripTrailingUrlPunctuation(href);
    if (!cleanHref) return [];
    return [new URL(cleanHref, baseUrl)];
  } catch {
    return [];
  }
}

function stripTrailingUrlPunctuation(href: string): string {
  let cleanHref = href.replace(/[.,;:!?]+$/, "");

  while (cleanHref.endsWith(")") && hasUnmatchedClosingParen(cleanHref)) {
    cleanHref = cleanHref.slice(0, -1);
  }

  return cleanHref;
}

function hasUnmatchedClosingParen(value: string): boolean {
  const openCount = (value.match(/\(/g) || []).length;
  const closeCount = (value.match(/\)/g) || []).length;
  return closeCount > openCount;
}

function inferAllowedOrigins(links: URL[], baseUrl: URL): Set<string> {
  const allowedOrigins = new Set([baseUrl.origin]);
  const sameOriginLinks = links.filter((link) => link.origin === baseUrl.origin);

  if (sameOriginLinks.length > 0) {
    return allowedOrigins;
  }

  const originCounts = new Map<string, number>();
  for (const link of links) {
    if (!isDocumentationHost(link.hostname)) {
      continue;
    }
    originCounts.set(link.origin, (originCounts.get(link.origin) || 0) + 1);
  }

  const [canonicalOrigin, count] =
    Array.from(originCounts.entries()).sort((a, b) => b[1] - a[1])[0] || [];

  if (canonicalOrigin && count >= 3) {
    allowedOrigins.add(canonicalOrigin);
  }

  return allowedOrigins;
}

function isDocumentationHost(hostname: string): boolean {
  return (
    hostname === "developer.apple.com" ||
    hostname.endsWith(".github.io") ||
    hostname.startsWith("docs.") ||
    hostname.startsWith("doc.") ||
    hostname.startsWith("developer.") ||
    hostname.startsWith("learn.") ||
    hostname.startsWith("help.") ||
    hostname.startsWith("api.")
  );
}

function isAllowedDocumentationPath(linkUrl: URL, baseUrl: URL, isAppleDocs: boolean): boolean {
  if (isAppleDocs) {
    if (!linkUrl.pathname.startsWith("/documentation/")) {
      return false;
    }

    const pathLower = linkUrl.pathname.toLowerCase();
    if (isNonContentPath(pathLower)) {
      return false;
    }

    const pathParts = linkUrl.pathname.split("/").filter((p) => p);
    return pathParts.length > 1;
  }

  const pathLower = linkUrl.pathname.toLowerCase();
  if (isNonContentPath(pathLower) || isAssetPath(pathLower)) {
    return false;
  }

  if (baseUrl.hostname.includes("swiftpackageindex.com")) {
    const basePackageMatch = baseUrl.pathname.match(/\/([^\/]+\/[^\/]+)/);
    const linkPackageMatch = linkUrl.pathname.match(/\/([^\/]+\/[^\/]+)/);

    if (basePackageMatch && linkPackageMatch && basePackageMatch[1] === linkPackageMatch[1]) {
      return true;
    }
    return linkUrl.pathname.startsWith(baseUrl.pathname);
  }

  return true;
}

function isNonContentPath(pathLower: string): boolean {
  return (
    pathLower.includes("/search") ||
    pathLower.includes("/login") ||
    pathLower.includes("/signin") ||
    pathLower.includes("/signup") ||
    pathLower.includes("/download")
  );
}

function isAssetPath(pathLower: string): boolean {
  return [
    ".zip",
    ".tar.gz",
    ".dmg",
    ".pkg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
    ".woff",
    ".woff2",
  ].some((extension) => pathLower.endsWith(extension));
}
