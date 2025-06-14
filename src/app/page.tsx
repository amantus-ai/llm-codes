'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ALLOWED_DOMAINS } from '@/constants';
import { getSupportedDomainsText, isValidDocumentationUrl } from '@/utils/url-utils';
import { filterDocumentation } from '@/utils/documentation-filter';

interface ProcessingResult {
  url: string;
  content: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(2);
  const [maxUrls, setMaxUrls] = useState(200);
  const [filterUrls, setFilterUrls] = useState(true);
  const [deduplicateContent, setDeduplicateContent] = useState(true);
  const [filterAvailability, setFilterAvailability] = useState(true);
  const [useComprehensiveFilter, setUseComprehensiveFilter] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ lines: 0, size: 0, urls: 0 });
  const [showLogs, setShowLogs] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  const [isIOS, setIsIOS] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);

  const log = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Check for iOS and notification permission on mount
  useEffect(() => {
    // Detect iOS devices (iPhone, iPad, iPod)
    const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(checkIOS);

    // Only check notification permission if not on iOS and Notification API is available
    if (!checkIOS && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Check for URL parameter on mount
  useEffect(() => {
    // Get the full query string after the ?
    const queryString = window.location.search.substring(1);

    if (queryString) {
      // Check if it looks like a URL (starts with http)
      if (queryString.startsWith('http://') || queryString.startsWith('https://')) {
        setUrl(decodeURIComponent(queryString));
      }
    }
  }, []);

  // Auto-scroll logs to bottom when new messages arrive (if user isn't scrolling)
  useEffect(() => {
    if (logContainerRef.current && !userScrollingRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleLogScroll = () => {
    if (!logContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold

    userScrollingRef.current = !isAtBottom;
  };

  const requestNotificationPermission = async () => {
    // Skip notification permission on iOS
    if (isIOS) return false;

    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const showNotification = (title: string, body: string) => {
    // Skip notifications on iOS
    if (isIOS) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'apple-docs-converter',
        requireInteraction: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  };

  const extractLinks = (content: string, baseUrl: string): string[] => {
    const links = new Set<string>();

    // Multiple regex patterns to catch different link formats
    const patterns = [
      /\[([^\]]+)\]\(([^)]+)\)/g, // Markdown links: [text](url)
      /href="([^"]+)"/g, // HTML links that might remain
      /href='([^']+)'/g, // HTML links with single quotes
      /https?:\/\/[^\s<>"{}|\\^\[\]`]+/g, // Plain URLs
    ];

    // Determine the base domain and path structure
    const urlObj = new URL(baseUrl);
    const baseDomain = urlObj.origin;
    const basePath = urlObj.pathname;

    // Extract all potential links
    const potentialLinks: string[] = [];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Get the URL from the appropriate capture group
        const url = match[2] || match[1] || match[0];
        if (
          url &&
          !url.startsWith('#') &&
          !url.startsWith('mailto:') &&
          !url.startsWith('javascript:')
        ) {
          potentialLinks.push(url);
        }
      }
    });

    // Process and filter links
    potentialLinks.forEach((href) => {
      let fullUrl = '';

      try {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          // Absolute URL
          fullUrl = href;
        } else if (href.startsWith('//')) {
          // Protocol-relative URL
          fullUrl = 'https:' + href;
        } else if (href.startsWith('/')) {
          // Absolute path
          fullUrl = `${baseDomain}${href}`;
        } else {
          // Relative path - improved handling
          const baseDir = basePath.endsWith('/')
            ? basePath
            : basePath.substring(0, basePath.lastIndexOf('/') + 1);
          fullUrl = `${baseDomain}${baseDir}${href}`;
        }

        // Normalize URL
        const normalizedUrl = new URL(fullUrl);
        fullUrl = normalizedUrl.href;

        // Apply domain-specific filtering
        if (baseDomain === 'https://developer.apple.com') {
          // For Apple, maintain strict section filtering
          if (fullUrl.includes('/documentation/')) {
            const linkPath = normalizedUrl.pathname.toLowerCase();
            const basePathLower = basePath.toLowerCase();
            const basePathParts = basePathLower.split('/').filter((p) => p);
            const linkPathParts = linkPath.split('/').filter((p) => p);

            if (basePathParts.length >= 2 && linkPathParts.length >= 2) {
              if (linkPathParts[0] === basePathParts[0] && linkPathParts[1] === basePathParts[1]) {
                links.add(fullUrl);
              }
            }
          }
        } else {
          // For non-Apple sites, be more permissive
          // Include if it's on the same domain and shares some path similarity
          if (normalizedUrl.origin === baseDomain) {
            // For Swift Package Index, allow exploring the package documentation
            if (baseDomain.includes('swiftpackageindex.com')) {
              // Allow any path under the same package
              const basePackageMatch = basePath.match(/\/([^\/]+\/[^\/]+)/);
              const linkPackageMatch = normalizedUrl.pathname.match(/\/([^\/]+\/[^\/]+)/);

              if (
                basePackageMatch &&
                linkPackageMatch &&
                basePackageMatch[1] === linkPackageMatch[1]
              ) {
                links.add(fullUrl);
              } else if (normalizedUrl.pathname.startsWith(basePath)) {
                links.add(fullUrl);
              }
            } else {
              // For GitHub Pages and other sites, allow same directory and subdirectories
              const baseDir = basePath.endsWith('/')
                ? basePath
                : basePath.substring(0, basePath.lastIndexOf('/') + 1);
              if (normalizedUrl.pathname.startsWith(baseDir)) {
                links.add(fullUrl);
              }
            }
          }
        }
      } catch {
        // Invalid URL, skip it
      }
    });

    return Array.from(links);
  };

  const scrapeUrl = async (urlToScrape: string): Promise<string> => {
    try {
      log(`Fetching content from ${urlToScrape}...`);

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape, action: 'scrape' }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use the default error message
        }
        log(`❌ Failed to fetch ${urlToScrape}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Check if we have the expected response structure
      if (!data.success) {
        const errorMsg = data.error || 'Scraping failed - unknown error';
        log(`❌ Scraping failed for ${urlToScrape}: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      if (data.cached) {
        log(`📦 Using cached content for ${urlToScrape}`);
      }

      const markdown = data.data?.markdown || '';
      if (!markdown) {
        log(`⚠️ Warning: Empty content returned for ${urlToScrape}`);
      } else {
        log(
          `✅ Successfully scraped ${markdown.length.toLocaleString()} characters from ${urlToScrape}`
        );
      }

      return markdown;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for common error patterns
      if (errorMessage.includes('Failed to fetch')) {
        log(`❌ Network error for ${urlToScrape}: Unable to connect to server`);
      } else if (errorMessage.includes('timeout')) {
        log(`❌ Timeout error for ${urlToScrape}: Page took too long to load`);
      } else if (!errorMessage.includes('❌')) {
        // Only log if we haven't already logged a specific error
        log(`❌ Error scraping ${urlToScrape}: ${errorMessage}`);
      }

      throw error;
    }
  };

  const processUrlsWithDepth = async (
    urls: string[],
    currentDepth: number,
    maxDepth: number,
    maxUrlsToProcess: number,
    processedUrls: Set<string> = new Set(),
    baseUrl: string = ''
  ): Promise<ProcessingResult[]> => {
    if (currentDepth > maxDepth) return [];

    const results: ProcessingResult[] = [];
    const newUrls = new Set<string>();

    // Process URLs in batches for parallel fetching
    const BATCH_SIZE = 10; // Process 10 URLs concurrently
    const urlsToProcess = urls.filter(
      (url) => !processedUrls.has(url) && processedUrls.size < maxUrlsToProcess
    );

    // Process in batches
    for (let i = 0; i < urlsToProcess.length; i += BATCH_SIZE) {
      if (processedUrls.size >= maxUrlsToProcess) break;

      const batch = urlsToProcess.slice(i, i + BATCH_SIZE);
      const remainingCapacity = maxUrlsToProcess - processedUrls.size;
      const batchToProcess = batch.slice(0, remainingCapacity);

      // Mark URLs as processed before fetching to avoid duplicates
      batchToProcess.forEach((url) => processedUrls.add(url));

      // Log batch processing
      log(`🚀 Processing batch of ${batchToProcess.length} URLs at depth ${currentDepth}...`);

      // Process batch in parallel
      const batchPromises = batchToProcess.map(async (url) => {
        try {
          log(`🔄 Fetching: ${url}`);
          const content = await scrapeUrl(url);

          // Extract links for next depth level
          if (currentDepth < maxDepth && content) {
            const links = extractLinks(content, baseUrl || urls[0]);
            links.forEach((link) => {
              if (!processedUrls.has(link)) {
                newUrls.add(link);
              }
            });
            if (links.length > 0) {
              log(`🔗 Found ${links.length} links to follow from ${url}`);
            } else if (currentDepth < maxDepth) {
              log(`⚠️ No links found to follow from ${url}`);
            }
          }

          return { url, content };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Provide specific guidance based on error type
          if (errorMessage.includes('Invalid URL')) {
            log(`❌ Invalid URL format: ${url}`);
          } else if (errorMessage.includes('Firecrawl API error')) {
            log(`❌ API error for ${url}: ${errorMessage}`);
            log(`💡 Tip: This might be a temporary issue. Try again in a few moments.`);
          } else if (errorMessage.includes('No content returned')) {
            log(
              `❌ No content found for ${url}: The page might be empty or require authentication`
            );
          }

          // Return with empty content
          return { url, content: '' };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update progress after each batch
      const progressPercent = Math.round(
        Math.min(90, (processedUrls.size / maxUrlsToProcess) * 90)
      );
      setProgress(progressPercent);

      // Small delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < urlsToProcess.length && processedUrls.size < maxUrlsToProcess) {
        log(`⏳ Waiting before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Process next depth level
    if (currentDepth < maxDepth && newUrls.size > 0 && processedUrls.size < maxUrlsToProcess) {
      // Only pass as many URLs as we have room for
      const remainingCapacity = maxUrlsToProcess - processedUrls.size;
      const urlsToProcess = Array.from(newUrls).slice(0, remainingCapacity);

      const nextResults = await processUrlsWithDepth(
        urlsToProcess,
        currentDepth + 1,
        maxDepth,
        maxUrlsToProcess,
        processedUrls,
        baseUrl || urls[0]
      );
      results.push(...nextResults);
    }

    return results;
  };

  const processUrl = async () => {
    // Validate URL
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    const trimmedUrl = url.trim();

    // Check for common URL mistakes
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('URL must start with https:// or http://');
      return;
    }

    if (!isValidDocumentationUrl(trimmedUrl)) {
      setError(`URL must be from one of the ${getSupportedDomainsText()}`);

      // Provide helpful suggestions
      if (trimmedUrl.includes('apple.com') && !trimmedUrl.includes('/documentation/')) {
        setError(
          'For Apple documentation, use URLs starting with https://developer.apple.com/documentation/'
        );
      } else if (trimmedUrl.includes('github.com')) {
        setError('For GitHub documentation, use GitHub Pages URLs (*.github.io), not github.com');
      }

      return;
    }

    // Update URL with trimmed version
    if (trimmedUrl !== url) {
      setUrl(trimmedUrl);
    }

    setError('');
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    setResults([]);
    setStats({ lines: 0, size: 0, urls: 0 });

    // Request notification permission on first use
    await requestNotificationPermission();

    try {
      log(`🚀 Starting documentation processing...`);
      log(`📊 Configuration: Depth ${depth}, Max URLs: ${maxUrls}`);
      log(`🔗 Starting URL: ${trimmedUrl}`);

      const processedResults = await processUrlsWithDepth(
        [trimmedUrl],
        0,
        depth,
        maxUrls,
        new Set(),
        trimmedUrl
      );
      setResults(processedResults);

      // Calculate stats
      const successfulResults = processedResults.filter((r) => r.content);
      const failedResults = processedResults.filter((r) => !r.content);

      const content = processedResults.map((r) => `# ${r.url}\n\n${r.content}\n\n---\n\n`).join('');
      const lines = content.split('\n').length;
      const sizeKB = new Blob([content]).size / 1024;

      setStats({
        lines,
        size: sizeKB,
        urls: processedResults.length,
      });

      setProgress(100);

      // Provide summary
      log(`✅ Processing complete!`);
      log(
        `📈 Summary: ${successfulResults.length} successful, ${failedResults.length} failed, ${processedResults.length} total URLs`
      );

      if (failedResults.length > 0) {
        log(`⚠️ Failed URLs:`);
        failedResults.forEach((r) => log(`  - ${r.url}`));
      }

      if (successfulResults.length === 0) {
        log(`❌ No content was successfully scraped. Please check:`);
        log(`  - Is the URL accessible?`);
        log(`  - Does the site require authentication?`);
        log(`  - Is the content loaded dynamically?`);
        setError('No content could be extracted from any URL');
      }

      // Collapse activity log when processing is complete
      setShowLogs(false);

      // Show notification
      if (successfulResults.length > 0) {
        showNotification(
          '✅ Documentation Ready!',
          `Successfully processed ${successfulResults.length} URLs. Your Markdown file is ready to download.`
        );
      } else {
        showNotification(
          '❌ No Content Found',
          'Unable to extract content from any URLs. Check the activity log for details.'
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      log(`❌ Processing failed: ${errorMessage}`);

      // Provide helpful error messages
      if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        log(`💡 Tip: Check your internet connection and try again`);
        setError('Network error: Unable to connect to the server');
      } else if (errorMessage.includes('timeout')) {
        log(`💡 Tip: The website might be slow. Try reducing the number of URLs or depth`);
        setError('Timeout: The website took too long to respond');
      } else {
        setError(`Processing failed: ${errorMessage}`);
      }

      showNotification(
        '❌ Processing Failed',
        'An error occurred. Check the activity log for details.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const filterUrlsFromMarkdown = (markdown: string): string => {
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
  };

  const removeCommonPhrases = (markdown: string): string => {
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
  };

  const filterAvailabilityStrings = (markdown: string): string => {
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
  };

  const deduplicateMarkdown = (markdown: string): string => {
    if (!deduplicateContent) return markdown;

    // Split content into lines
    const lines = markdown.split('\n');
    const seenContent = new Set<string>();
    const deduplicatedLines: string[] = [];

    // Track paragraphs for de-duplication
    let currentParagraph = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Handle empty lines (paragraph breaks)
      if (trimmedLine === '') {
        if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
          seenContent.add(currentParagraph.trim());
          deduplicatedLines.push(currentParagraph);
        }
        if (currentParagraph) {
          deduplicatedLines.push('');
        }
        currentParagraph = '';
        continue;
      }

      // Handle headers - always keep but track their content
      if (trimmedLine.match(/^#{1,6}\s/)) {
        // Flush current paragraph
        if (currentParagraph && !seenContent.has(currentParagraph.trim())) {
          seenContent.add(currentParagraph.trim());
          deduplicatedLines.push(currentParagraph);
          deduplicatedLines.push('');
        }
        currentParagraph = '';

        // Check if we've seen this exact header before
        if (!seenContent.has(trimmedLine)) {
          seenContent.add(trimmedLine);
          deduplicatedLines.push(line);
        }
        continue;
      }

      // Handle list items
      if (trimmedLine.match(/^[-*+]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        // For list items, check if we've seen this exact item
        if (!seenContent.has(trimmedLine)) {
          seenContent.add(trimmedLine);
          if (currentParagraph) {
            deduplicatedLines.push(currentParagraph);
            currentParagraph = '';
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
  };

  const downloadMarkdown = () => {
    // Generate header with attribution
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const header = `<!--
Downloaded via https://llm.codes by @steipete on ${dateStr} at ${timeStr}
Source URL: ${url}
Total pages processed: ${results.length}
URLs filtered: ${filterUrls ? 'Yes' : 'No'}
Content de-duplicated: ${deduplicateContent ? 'Yes' : 'No'}
Availability strings filtered: ${filterAvailability ? 'Yes' : 'No'}
Comprehensive filtering: ${useComprehensiveFilter ? 'Yes' : 'No'}
-->

`;

    const processedResults = results.map((r) => {
      let content = r.content;

      if (useComprehensiveFilter) {
        // Use the comprehensive documentation filter
        content = filterDocumentation(content, {
          filterUrls,
          filterAvailability,
          filterNavigation: true,
          filterLegalBoilerplate: true,
          filterEmptyContent: true,
          filterRedundantTypeAliases: true,
          filterExcessivePlatformNotices: true,
          filterFormattingArtifacts: true,
          deduplicateContent,
        });
      } else {
        // Use the original simple filters
        content = removeCommonPhrases(content); // Remove common phrases first
        content = filterUrlsFromMarkdown(content);
        content = filterAvailabilityStrings(content);
        content = deduplicateMarkdown(content);
      }

      return { url: r.url, content };
    });

    const content =
      header + processedResults.map((r) => `# ${r.url}\n\n${r.content}\n\n---\n\n`).join('');
    const blob = new Blob([content], { type: 'text/markdown' });
    const downloadUrl = URL.createObjectURL(blob);

    // Generate filename from the original URL
    const urlPath = url.replace('https://developer.apple.com/documentation/', '');
    const pathParts = urlPath.split('/').filter((part) => part.length > 0);
    const filename = pathParts.length > 0 ? `${pathParts.join('-')}.md` : 'apple-developer-docs.md';

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Documentation to llms.txt Generator"
              width={40}
              height={40}
              className="rounded-xl shadow-sm"
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Documentation to llms.txt Generator
              </h1>
              <p className="text-sm text-slate-600">
                Transform developer documentation to clean, LLM-friendly Markdown
              </p>
            </div>
            <div className="ml-auto text-xs text-slate-500 text-right">
              <div>
                Made by{' '}
                <a
                  href="https://steipete.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  @steipete
                </a>
              </div>
              <div>
                Powered by{' '}
                <a
                  href="https://www.firecrawl.dev/referral?rid=9CG538BE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Firecrawl
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* URL Input */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-3">
              Documentation URL
            </label>
            <div className="relative">
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://developer.apple.com/documentation/..."
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <svg
                className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}
            <div className="mt-3">
              <Popover open={showPopover} onOpenChange={setShowPopover}>
                <PopoverTrigger asChild>
                  <button className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer transition-colors">
                    This document parser supports {getSupportedDomainsText()}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[36rem] max-h-[36rem] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200"
                  align="start"
                >
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Supported Documentation Sites
                    </h3>

                    {/* Group domains by category */}
                    {Object.entries(
                      Object.values(ALLOWED_DOMAINS).reduce(
                        (acc, domain) => {
                          const category = domain.category || 'General';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(domain);
                          return acc;
                        },
                        {} as Record<
                          string,
                          (typeof ALLOWED_DOMAINS)[keyof typeof ALLOWED_DOMAINS][]
                        >
                      )
                    ).map(([category, domains]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                          {category}
                        </h4>
                        <ul className="space-y-1">
                          {domains.map((domain) => (
                            <li key={domain.name} className="text-xs">
                              <button
                                className="w-full text-left hover:bg-slate-50 rounded px-2 py-1 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setUrl(domain.example);
                                  setError('');
                                  setShowPopover(false);
                                }}
                              >
                                <span className="text-slate-700 font-medium">{domain.name}</span>
                                <span className="text-slate-400 ml-2 text-[11px]">
                                  {domain.example}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {/* Add GitHub issue link */}
                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-xs text-slate-600">
                        Missing a site?{' '}
                        <a
                          href="https://github.com/amantus-ai/llm-codes/issues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Open an issue on GitHub
                        </a>
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Configuration & Options */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-700">Processing Configuration</h3>
              {typeof window !== 'undefined' &&
                !isIOS &&
                'Notification' in window &&
                notificationPermission !== 'default' && (
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        notificationPermission === 'granted' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-slate-600">
                      Notifications {notificationPermission === 'granted' ? 'enabled' : 'blocked'}
                    </span>
                  </div>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="depth" className="block text-sm text-slate-600 mb-2">
                  Crawl Depth
                </label>
                <div className="relative">
                  <input
                    id="depth"
                    type="number"
                    min="0"
                    max="5"
                    value={depth}
                    onChange={(e) => setDepth(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded pointer-events-none">
                    levels
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">0 = main page only</p>
              </div>
              <div>
                <label htmlFor="maxUrls" className="block text-sm text-slate-600 mb-2">
                  Max URLs
                </label>
                <div className="relative">
                  <input
                    id="maxUrls"
                    type="number"
                    min="1"
                    max="1000"
                    value={maxUrls}
                    onChange={(e) => setMaxUrls(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded pointer-events-none">
                    pages
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Maximum pages to process</p>
              </div>
            </div>

            {/* Collapsible Options */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Options
              </button>

              {showOptions && (
                <div className="mt-4 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterUrls}
                      onChange={(e) => setFilterUrls(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-slate-600">Filter out all URLs</span>
                  </label>
                  <p className="text-xs text-slate-500 ml-7 -mt-2">
                    Remove all hyperlinks from the markdown output
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deduplicateContent}
                      onChange={(e) => setDeduplicateContent(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-slate-600">De-duplicate content</span>
                  </label>
                  <p className="text-xs text-slate-500 ml-7 -mt-2">
                    Remove duplicate sections and paragraphs from the output
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterAvailability}
                      onChange={(e) => setFilterAvailability(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-slate-600">Filter availability strings</span>
                  </label>
                  <p className="text-xs text-slate-500 ml-7 -mt-2">
                    Remove platform availability info (iOS 14.0+, macOS 10.15+, etc.)
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useComprehensiveFilter}
                      onChange={(e) => setUseComprehensiveFilter(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-slate-600">
                      Comprehensive documentation filter
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 ml-7 -mt-2">
                    Apply advanced filtering to remove navigation, legal text, empty sections, and
                    other documentation noise
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Process Button */}
          <button
            onClick={processUrl}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing Documentation...
              </span>
            ) : (
              'Process Documentation'
            )}
          </button>

          {/* Help text - shown only when not processing */}
          {!isProcessing && (
            <p className="mt-4 text-sm text-slate-600 text-center">
              Generates a cleaned markdown file (llms.txt), so your agent knows the latest Apple (or
              3rd-party) API.
              <br />
              Store the file in your project and reference the name to load it into the context, and
              get better code.
            </p>
          )}

          {/* Progress */}
          {(isProcessing || results.length > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-slate-600 mb-2">
                    <span>Processing</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Logs Toggle */}
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  {showLogs ? 'Hide' : 'Show'} activity log
                </button>

                {showLogs && (
                  <div
                    ref={logContainerRef}
                    onScroll={handleLogScroll}
                    className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto"
                  >
                    <div className="space-y-1 font-mono text-xs text-slate-600">
                      {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statistics */}
          {stats.urls > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-200 p-6">
              <h4 className="text-sm font-medium text-slate-700 mb-4">Statistics</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.urls}</div>
                  <div className="text-xs text-slate-600 mt-1">URLs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{Math.round(stats.size)}K</div>
                  <div className="text-xs text-slate-600 mt-1">Size</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(stats.lines / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Lines</div>
                </div>
              </div>
            </div>
          )}

          {/* Download Button */}
          {results.length > 0 && (
            <button
              onClick={downloadMarkdown}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 px-6 rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 flex items-center justify-center gap-3 animate-splash animate-pulse-ring"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Download Markdown
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-slate-600 mb-6">
            This service is being offered and <em>paid</em> for by{' '}
            <a
              href="https://twitter.com/steipete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Peter Steinberger (@steipete)
            </a>
            .<br />
            If you want to thank me, give me a shoutout and follow my newsletter.
          </p>

          {/* Newsletter Form */}
          <div className="max-w-md mx-auto">
            <form
              action="https://buttondown.email/api/emails/embed-subscribe/steipete"
              method="post"
              target="popupwindow"
              onSubmit={(_e) => {
                window.open('https://buttondown.email/steipete', 'popupwindow');
              }}
              className="flex gap-3"
            >
              <input type="hidden" value="1" name="embed" />
              <input type="hidden" name="tag" value="llm-tech" />
              <input
                type="email"
                name="email"
                id="bd-email"
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all text-sm shadow-md hover:shadow-lg"
              >
                Subscribe
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-3">2× per month, pure signal, zero fluff.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
