import {
  filterDocumentation,
  is404Page as is404PageFromFilter,
  filterUrlsFromMarkdown as filterUrlsBase,
  filterAvailabilityStrings as filterAvailabilityBase,
  deduplicateMarkdown as deduplicateBase,
} from './documentation-filter';

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
  const links = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  const isAppleDocs = baseUrlObj.hostname === 'developer.apple.com';

  // Extract URLs from markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(markdown)) !== null) {
    const url = match[2];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      links.add(url);
    }
  }

  // Extract URLs from HTML links: <a href="url">
  const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlLinkRegex.exec(markdown)) !== null) {
    const url = match[1];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      links.add(url);
    }
  }

  // Extract plain URLs that might appear in the text
  const plainUrlRegex = /https?:\/\/[^\s<>\[\]()]+(?:\([^\s<>\[\]()]*\))?[^\s<>\[\]()]*/g;
  while ((match = plainUrlRegex.exec(markdown)) !== null) {
    const url = match[0];
    // Clean up the URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?]+$/, '');
    links.add(cleanUrl);
  }

  // Filter and validate links
  return Array.from(links).filter((link) => {
    try {
      const linkUrl = new URL(link);

      // Must be same domain
      if (linkUrl.hostname !== baseUrlObj.hostname) {
        return false;
      }

      // Filter out non-documentation URLs for Apple
      if (isAppleDocs) {
        // Must be in the documentation path
        if (!linkUrl.pathname.startsWith('/documentation/')) {
          return false;
        }

        // Filter out search, login, and other non-content pages
        const pathLower = linkUrl.pathname.toLowerCase();
        if (
          pathLower.includes('/search') ||
          pathLower.includes('/login') ||
          pathLower.includes('/download')
        ) {
          return false;
        }

        // Must be deeper than just /documentation/
        const pathParts = linkUrl.pathname.split('/').filter((p) => p);
        if (pathParts.length <= 1) {
          return false;
        }
      } else {
        // For non-Apple sites (Swift Package Index, GitHub Pages)
        // Be less restrictive about path hierarchy
        // Just filter out obviously non-content URLs
        const pathLower = linkUrl.pathname.toLowerCase();
        if (
          pathLower.includes('/search') ||
          pathLower.includes('/login') ||
          pathLower.includes('/signin') ||
          pathLower.includes('/signup') ||
          pathLower.includes('/download') ||
          pathLower.endsWith('.zip') ||
          pathLower.endsWith('.tar.gz') ||
          pathLower.endsWith('.dmg') ||
          pathLower.endsWith('.pkg')
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  });
}
