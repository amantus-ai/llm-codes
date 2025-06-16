import { DOCUMENTATION_PATTERNS, ALLOWED_EXCEPTIONS, SPECIAL_DOMAINS } from '@/constants';

export function isValidDocumentationUrl(url: string): boolean {
  if (!url) return false;

  // First check against documentation patterns
  const matchesPattern = DOCUMENTATION_PATTERNS.some((patternConfig) => {
    return patternConfig.pattern.test(url);
  });

  if (matchesPattern) return true;

  // Then check against explicit exceptions
  return Object.values(ALLOWED_EXCEPTIONS).some((exception) => {
    return url.startsWith(exception.pattern);
  });
}

export function getSupportedDomainsText(): string {
  return 'Most documentation pages are supported';
}

export function extractUrlFromQueryString(queryString: string): string | null {
  if (!queryString) return null;

  // Try to decode first in case it's URL-encoded
  const decoded = decodeURIComponent(queryString);

  // Check if it looks like a URL (starts with http)
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    return decoded;
  }

  return null;
}

export function updateUrlWithDocumentation(url: string): void {
  if (!url) return;

  // Update the URL without reloading the page
  const newUrl = `${window.location.pathname}?${encodeURIComponent(url)}`;
  window.history.replaceState({}, '', newUrl);
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove fragment and query parameters
    urlObj.hash = '';
    urlObj.search = '';
    // Remove trailing slash if it's not the root path
    let normalized = urlObj.toString();
    if (normalized.endsWith('/') && urlObj.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

export function generateFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Check special domains first (Apple, Swift Package Index)
    const specialDomain = Object.values(SPECIAL_DOMAINS).find((domain) => {
      return url.startsWith(domain.pattern);
    });

    if (specialDomain) {
      const baseName = specialDomain.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const pathParts = pathname.split('/').filter((p) => p && p.length > 0);

      if (pathParts.length > 0) {
        const pathSuffix = pathParts.slice(0, 2).join('-');
        return `${baseName}-${pathSuffix}-docs.md`;
      }
      return `${baseName}-docs.md`;
    }

    // Check if it's an exception with a specific name
    const matchedException = Object.values(ALLOWED_EXCEPTIONS).find((exception) => {
      return url.startsWith(exception.pattern);
    });

    if (matchedException) {
      // Use the exception name as a base for the filename
      const baseName = matchedException.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const pathParts = pathname.split('/').filter((p) => p && p.length > 0);

      if (pathParts.length > 0) {
        // Take up to 2 path parts for the filename
        const pathSuffix = pathParts.slice(0, 2).join('-');
        return `${baseName}-${pathSuffix}-docs.md`;
      }
      return `${baseName}-docs.md`;
    }

    // Fallback: use the hostname and any path
    const pathParts = pathname.split('/').filter((p) => p);
    if (pathParts.length > 0) {
      return `${hostname.replace(/\./g, '-')}-${pathParts[0]}-docs.md`;
    }
    return `${hostname.replace(/\./g, '-')}-docs.md`;
  } catch {
    return 'documentation.md';
  }
}
