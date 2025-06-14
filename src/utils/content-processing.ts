export function is404Page(content: string): boolean {
  if (!content) return false;

  const lowercaseContent = content.toLowerCase();

  // Common 404 page indicators
  const notFoundIndicators = [
    "the page you're looking for can't be found",
    'page not found',
    '404 not found',
    '404 error',
    "this page doesn't exist",
    "we couldn't find that page",
    'the requested page could not be found',
    "sorry, we can't find that page",
    "oops! that page can't be found",
    'the page you requested was not found',
  ];

  return notFoundIndicators.some((indicator) => lowercaseContent.includes(indicator));
}

export function filterUrlsFromMarkdown(markdown: string, filterUrls: boolean): string {
  if (!filterUrls) return markdown;

  // Convert markdown links: [text](url) -> text
  // This keeps the link text but removes the URL
  let filtered = markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove bare URLs that stand alone (not part of markdown syntax)
  // Only remove URLs that are preceded by whitespace or start of line
  // and followed by whitespace, punctuation, or end of line
  filtered = filtered.replace(/(^|\s)(https?:\/\/[^\s<>\[\]()]+)(?=\s|[.,;:!?]|$)/gm, '$1');
  filtered = filtered.replace(/(^|\s)(ftp:\/\/[^\s<>\[\]()]+)(?=\s|[.,;:!?]|$)/gm, '$1');

  // Remove angle bracket URLs: <http://example.com> -> (empty)
  // These are meant to be hidden anyway
  filtered = filtered.replace(/<https?:\/\/[^>]+>/g, '');
  filtered = filtered.replace(/<ftp:\/\/[^>]+>/g, '');

  // Clean up any double spaces left behind
  filtered = filtered.replace(/  +/g, ' ');

  return filtered;
}

export function removeCommonPhrases(markdown: string): string {
  // Remove "Skip Navigation" links like [Skip Navigation](url)
  let cleaned = markdown.replace(/\[Skip Navigation\]\([^)]+\)/gi, '');

  // Also remove standalone "Skip Navigation" text
  cleaned = cleaned.replace(/Skip Navigation/gi, '');

  // Remove multi-line API Reference links like:
  // API Reference\\
  // Enumerations
  // or
  // [API Reference\\
  // Macros](url)
  cleaned = cleaned.replace(/\[?API Reference\s*\\\\\s*\n\s*[^\]]+\]?\([^)]+\)/g, '');
  cleaned = cleaned.replace(/API Reference\s*\\\\\s*\n\s*[^\n]+/g, '');

  // Remove standalone "API Reference"
  cleaned = cleaned.replace(/^API Reference$/gm, '');

  // Remove "Current page is" followed by any text
  cleaned = cleaned.replace(/Current page is\s+[^\n]+/gi, '');

  // Clean up multiple consecutive empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove lines that are now empty after cleaning
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter((line, index) => {
    const trimmed = line.trim();
    // Keep empty lines for paragraph breaks, but remove lines that only had removed content
    return trimmed.length > 0 || (index > 0 && lines[index - 1].trim().length > 0);
  });

  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function filterAvailabilityStrings(markdown: string, filterAvailability: boolean): string {
  if (!filterAvailability) return markdown;

  // Pattern to match availability strings like:
  // iOS 14.0+iPadOS 14.0+Mac Catalyst 14.0+tvOS 14.0+visionOS 1.0+watchOS 7.0+
  // iOS 2.0+Beta iPadOS 2.0+Beta macOS 10.15+ etc.
  const availabilityPattern =
    /(iOS|iPadOS|macOS|Mac Catalyst|tvOS|visionOS|watchOS)[\s]*[\d.]+\+(?:Beta)?(?:\s*(?:iOS|iPadOS|macOS|Mac Catalyst|tvOS|visionOS|watchOS)[\s]*[\d.]+\+(?:Beta)?)*/g;

  // Remove standalone availability strings
  let filtered = markdown.replace(availabilityPattern, '');

  // Also remove lines that only contain availability info (after removing the strings)
  const lines = filtered.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    // Keep the line if it has content after removing availability strings
    return trimmed.length > 0 || line === '';
  });

  // Clean up multiple consecutive empty lines
  filtered = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');

  return filtered;
}

export function deduplicateMarkdown(markdown: string, deduplicateContent: boolean): string {
  if (!deduplicateContent) return markdown;

  const lines = markdown.split('\n');
  const deduplicatedLines: string[] = [];
  const seenContent = new Set<string>();
  let currentParagraph = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // If it's an empty line, we've reached the end of a paragraph
    if (trimmedLine === '') {
      if (currentParagraph) {
        const normalizedParagraph = currentParagraph.trim();
        if (!seenContent.has(normalizedParagraph)) {
          seenContent.add(normalizedParagraph);
          deduplicatedLines.push(currentParagraph);
        }
        currentParagraph = '';
      }
      // Always keep single empty lines for readability
      if (deduplicatedLines.length > 0 && deduplicatedLines[deduplicatedLines.length - 1] !== '') {
        deduplicatedLines.push('');
      }
      continue;
    }

    // Handle headers separately - allow some duplication for structure
    if (trimmedLine.startsWith('#')) {
      // Finish current paragraph
      if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
        seenContent.add(currentParagraph.trim());
        deduplicatedLines.push(currentParagraph);
        currentParagraph = '';
      }

      // Check for truly duplicate headers (exact match)
      if (!seenContent.has(trimmedLine)) {
        if (trimmedLine.match(/^#{1,2}\s/)) {
          // For h1 and h2, check for duplicates
          seenContent.add(trimmedLine);
        }
        deduplicatedLines.push(line);
      }
      continue;
    }

    // Build paragraphs
    currentParagraph += (currentParagraph ? '\n' : '') + line;
  }

  // Don't forget the last paragraph
  if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
    deduplicatedLines.push(currentParagraph);
  }

  // Clean up multiple consecutive empty lines
  let result = deduplicatedLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
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
