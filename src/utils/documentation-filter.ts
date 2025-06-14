/**
 * Comprehensive documentation filter for removing useless content patterns
 * from API documentation and technical content.
 */

interface FilterOptions {
  filterUrls?: boolean;
  filterAvailability?: boolean;
  filterNavigation?: boolean;
  filterLegalBoilerplate?: boolean;
  filterEmptyContent?: boolean;
  filterRedundantTypeAliases?: boolean;
  filterExcessivePlatformNotices?: boolean;
  filterFormattingArtifacts?: boolean;
  deduplicateContent?: boolean;
}

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  filterUrls: true,
  filterAvailability: true,
  filterNavigation: true,
  filterLegalBoilerplate: true,
  filterEmptyContent: true,
  filterRedundantTypeAliases: true,
  filterExcessivePlatformNotices: true,
  filterFormattingArtifacts: true,
  deduplicateContent: true,
};

/**
 * Main function to apply all documentation filters
 */
export function filterDocumentation(
  content: string,
  options: FilterOptions = DEFAULT_FILTER_OPTIONS
): string {
  let filtered = content;

  // Apply filters in a specific order for best results
  if (options.filterNavigation) {
    filtered = filterNavigationAndUIChrome(filtered);
  }

  if (options.filterLegalBoilerplate) {
    filtered = filterLegalAndCopyrightBoilerplate(filtered);
  }

  if (options.filterEmptyContent) {
    filtered = filterEmptyOrPlaceholderContent(filtered);
  }

  if (options.filterRedundantTypeAliases) {
    filtered = filterRedundantTypeAliases(filtered);
  }

  if (options.filterUrls) {
    filtered = filterUrlsFromMarkdown(filtered);
  }

  if (options.filterAvailability) {
    filtered = filterAvailabilityStrings(filtered);
  }

  if (options.filterExcessivePlatformNotices) {
    filtered = filterExcessivePlatformNotices(filtered);
  }

  if (options.filterFormattingArtifacts) {
    filtered = filterFormattingArtifacts(filtered);
  }

  if (options.deduplicateContent) {
    filtered = deduplicateMarkdown(filtered);
  }

  // Final cleanup
  filtered = cleanupWhitespace(filtered);

  return filtered;
}

/**
 * Filter navigation and UI chrome text
 */
export function filterNavigationAndUIChrome(content: string): string {
  let filtered = content;

  // Navigation patterns to remove
  const navigationPatterns = [
    // Skip Navigation links and text
    /\[Skip Navigation\]\([^)]+\)/gi,
    /Skip Navigation/gi,

    // View sample code links
    /\[View sample code\]\([^)]+\)/gi,
    /View sample code/gi,

    // API Reference navigation
    /\[?API Reference\s*\\\\\s*\n\s*[^\]]+\]?\([^)]+\)/g,
    /API Reference\s*\\\\\s*\n\s*[^\n]+/g,
    /^API Reference$/gm,

    // View in developer documentation
    /\[View in the developer documentation\]\([^)]+\)/gi,
    /View in the developer documentation/gi,

    // Download sample project
    /\[Download the sample project\]\([^)]+\)/gi,
    /Download the sample project/gi,

    // Current page indicators
    /Current page is\s+[^\n]+/gi,

    // Back to / Return to navigation
    /\[?(Back to|Return to)\s+[^\]]+\]?\([^)]+\)/gi,
    /(Back to|Return to)\s+[^\n]+/gi,

    // Breadcrumb patterns (e.g., Home > Documentation > API)
    /^[^>\n]+(?:\s*>\s*[^>\n]+)+$/gm,

    // Image captions starting with !
    /^!\[[^\]]*\]\([^)]+\)$/gm,
    /^![^\n]+$/gm,
  ];

  navigationPatterns.forEach((pattern) => {
    filtered = filtered.replace(pattern, '');
  });

  return filtered;
}

/**
 * Filter legal and copyright boilerplate
 */
export function filterLegalAndCopyrightBoilerplate(content: string): string {
  let filtered = content;

  const legalPatterns = [
    // Copyright notices
    /Copyright\s*©?\s*\d{4}[^.\n]*\./gi,
    /©\s*\d{4}[^.\n]*\./gi,

    // All rights reserved
    /All rights reserved\.?/gi,

    // Terms of service / Privacy policy
    /Terms of (Service|Use)/gi,
    /Privacy Policy/gi,

    // Trademark notices - remove the symbols but preserve the words
    /™/g, // ™
    /®/g, // ®
    /\bTM\b/g, // TM as standalone word
    // Remove copyright symbol when standalone
    /©/g,
  ];

  legalPatterns.forEach((pattern) => {
    filtered = filtered.replace(pattern, '');
  });

  // Handle license mentions outside of code blocks
  const lines = filtered.split('\n');
  let inCodeBlock = false;
  const filteredLines = lines.map((line) => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return line;
    }

    if (!inCodeBlock && line.match(/\b(MIT|Apache|GPL|BSD|ISC) License\b/i)) {
      return ''; // Remove license mentions outside code blocks
    }

    return line;
  });

  return filteredLines.join('\n');
}

/**
 * Filter empty or placeholder content
 */
export function filterEmptyOrPlaceholderContent(content: string): string {
  const lines = content.split('\n');
  const filteredLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    // const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''; // Currently unused

    // Skip section headers with no content
    if (trimmedLine.startsWith('#')) {
      // Check if this is an empty section pattern that should always be removed
      const emptyHeaderPatterns = [
        /^##\s*Mentioned in$/i,
        /^###?\s*Conforms To$/i,
        /^###?\s*Deprecated initializers$/i,
        /^###?\s*See Also$/i,
      ];

      const isEmptyPattern = emptyHeaderPatterns.some((pattern) => pattern.test(trimmedLine));

      if (isEmptyPattern) {
        // Check if there's actual content after this header
        let hasContent = false;
        for (let j = i + 1; j < lines.length; j++) {
          const checkLine = lines[j].trim();
          if (checkLine && !checkLine.startsWith('#')) {
            hasContent = true;
            break;
          }
          if (checkLine.startsWith('#')) {
            // Hit another header without finding content
            break;
          }
        }

        if (!hasContent) {
          continue; // Skip empty pattern headers
        }
      }

      // For h1/h2 headers that aren't empty patterns, keep them
      if (trimmedLine.match(/^#{1,2}\s/) && !isEmptyPattern) {
        filteredLines.push(line);
        continue;
      }

      // For all other headers (h3+), check if they have content
      let hasContent = false;
      for (let j = i + 1; j < lines.length; j++) {
        const checkLine = lines[j].trim();
        if (checkLine && !checkLine.startsWith('#')) {
          hasContent = true;
          break;
        }
        if (checkLine.startsWith('#')) {
          // Hit another header without finding content
          break;
        }
      }

      if (hasContent) {
        filteredLines.push(line);
      }
      continue;
    }

    // Skip broken image links
    if (trimmedLine.match(/^!\[\]\([^)]*\)$/) || trimmedLine === '![]') {
      continue;
    }

    // Skip empty code blocks
    if (trimmedLine === '```') {
      // Check if this is an empty code block
      let isEmptyBlock = false;
      if (i + 1 < lines.length) {
        let nextIdx = i + 1;
        // Skip empty lines after opening ```
        while (nextIdx < lines.length && lines[nextIdx].trim() === '') {
          nextIdx++;
        }
        // Check if we hit closing ``` without content
        if (nextIdx < lines.length && lines[nextIdx].trim() === '```') {
          isEmptyBlock = true;
          i = nextIdx; // Skip to closing ```
        }
      }
      if (isEmptyBlock) {
        continue;
      }
    }

    filteredLines.push(line);
  }

  return filteredLines.join('\n');
}

/**
 * Filter redundant type aliases
 */
export function filterRedundantTypeAliases(content: string): string {
  // Match type aliases where the alias name equals the type
  // e.g., typealias UITraitBridgedEnvironmentKey = UITraitBridgedEnvironmentKey
  const redundantAliasPattern = /typealias\s+(\w+)\s*=\s*\1\b/g;

  return content.replace(redundantAliasPattern, '');
}

/**
 * Filter URLs from markdown (moved from content-processing.ts)
 */
export function filterUrlsFromMarkdown(markdown: string): string {
  // Convert markdown links: [text](url) -> text
  // Handle URLs with parentheses by matching balanced parentheses
  let filtered = markdown.replace(/\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, '$1');

  // Remove bare URLs - updated to handle parentheses in URLs
  filtered = filtered.replace(
    /(^|\s)(https?:\/\/[^\s<>\[\]]+(?:\([^\s<>\[\]]*\)[^\s<>\[\]]*)*)(?=\s|[.,;:!?]|$)/gm,
    '$1'
  );
  filtered = filtered.replace(
    /(^|\s)(ftp:\/\/[^\s<>\[\]]+(?:\([^\s<>\[\]]*\)[^\s<>\[\]]*)*)(?=\s|[.,;:!?]|$)/gm,
    '$1'
  );

  // Remove angle bracket URLs
  filtered = filtered.replace(/<https?:\/\/[^>]+>/g, '');
  filtered = filtered.replace(/<ftp:\/\/[^>]+>/g, '');

  // Clean up any double spaces left behind
  filtered = filtered.replace(/  +/g, ' ');

  return filtered;
}

/**
 * Filter availability strings (moved from content-processing.ts)
 */
export function filterAvailabilityStrings(markdown: string): string {
  const availabilityPattern =
    /(iOS|iPadOS|macOS|Mac Catalyst|tvOS|visionOS|watchOS)[\s]*[\d.]+\+(?:Beta)?(?:\s*(?:iOS|iPadOS|macOS|Mac Catalyst|tvOS|visionOS|watchOS)[\s]*[\d.]+\+(?:Beta)?)*/g;

  return markdown.replace(availabilityPattern, '');
}

/**
 * Filter excessive platform availability notices
 */
export function filterExcessivePlatformNotices(content: string): string {
  const lines = content.split('\n');
  const filteredLines: string[] = [];
  let availabilityCount = 0;
  const maxAvailabilityPerSection = 2;

  for (const line of lines) {
    // Reset counter on new sections
    if (line.trim().startsWith('#')) {
      availabilityCount = 0;
      filteredLines.push(line);
      continue;
    }

    // Check if line contains availability info
    const hasAvailability =
      /Available (on|in|since)[\s:]*(iOS|iPadOS|macOS|Mac Catalyst|tvOS|visionOS|watchOS)/i.test(
        line
      );

    if (hasAvailability) {
      availabilityCount++;
      if (availabilityCount <= maxAvailabilityPerSection) {
        filteredLines.push(line);
      }
      // Skip excessive availability notices
    } else {
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

/**
 * Filter formatting artifacts
 */
export function filterFormattingArtifacts(content: string): string {
  let filtered = content;

  // Remove excessive section separators
  filtered = filtered.replace(/^-{3,}$/gm, '');
  filtered = filtered.replace(/^={3,}$/gm, '');
  filtered = filtered.replace(/^\*{3,}$/gm, '');
  filtered = filtered.replace(/^_{3,}$/gm, '');

  // Remove standalone formatting characters
  filtered = filtered.replace(/^\s*[*_~`]+\s*$/gm, '');

  return filtered;
}

/**
 * Deduplicate markdown content (moved from content-processing.ts)
 */
export function deduplicateMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const deduplicatedLines: string[] = [];
  const seenContent = new Set<string>();
  let currentParagraph = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      if (currentParagraph) {
        const normalizedParagraph = currentParagraph.trim();
        if (!seenContent.has(normalizedParagraph)) {
          seenContent.add(normalizedParagraph);
          deduplicatedLines.push(currentParagraph);
        }
        currentParagraph = '';
      }
      if (deduplicatedLines.length > 0 && deduplicatedLines[deduplicatedLines.length - 1] !== '') {
        deduplicatedLines.push('');
      }
      continue;
    }

    if (trimmedLine.startsWith('#')) {
      if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
        seenContent.add(currentParagraph.trim());
        deduplicatedLines.push(currentParagraph);
        currentParagraph = '';
      }

      if (!seenContent.has(trimmedLine)) {
        if (trimmedLine.match(/^#{1,2}\s/)) {
          seenContent.add(trimmedLine);
        }
        deduplicatedLines.push(line);
      }
      continue;
    }

    currentParagraph += (currentParagraph ? '\n' : '') + line;
  }

  if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
    deduplicatedLines.push(currentParagraph);
  }

  return deduplicatedLines.join('\n');
}

/**
 * Final cleanup of whitespace and empty lines
 */
export function cleanupWhitespace(content: string): string {
  let cleaned = content;

  // Clean up multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ');

  // Clean up multiple empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace from each line (both leading and trailing)
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // Remove leading/trailing newlines
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Check if content is likely a 404 page (moved from content-processing.ts)
 */
export function is404Page(content: string): boolean {
  if (!content) return false;

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

  // Check for exact phrases, not partial matches
  // This prevents matching content like "Learn how to handle 404 errors"
  return notFoundIndicators.some((indicator) => {
    // Create word boundary regex to match complete phrases
    const regex = new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(content);
  });

  // Remove the duplicate return statement that was left behind
}
