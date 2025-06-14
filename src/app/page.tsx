'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  isValidDocumentationUrl,
  getSupportedDomainsText,
  extractUrlFromQueryString,
  updateUrlWithDocumentation,
  normalizeUrl,
} from '@/utils/url-utils';
import { extractLinks, is404Page } from '@/utils/content-processing';
import { scrapeUrl } from '@/utils/scraping';
import { downloadMarkdown } from '@/utils/file-utils';
import { requestNotificationPermission, showNotification } from '@/utils/notifications';
import { PROCESSING_CONFIG, UI_CONFIG, ALLOWED_DOMAINS } from '@/constants';

interface ProcessingResult {
  url: string;
  content: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(PROCESSING_CONFIG.DEFAULT_CRAWL_DEPTH);
  const [maxUrls, setMaxUrls] = useState(PROCESSING_CONFIG.DEFAULT_MAX_URLS);
  const [filterUrls, setFilterUrls] = useState(true);
  const [deduplicateContent, setDeduplicateContent] = useState(true);
  const [filterAvailability, setFilterAvailability] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ lines: 0, size: 0, urls: 0 });
  const [showLogs, setShowLogs] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  const [isIOS, setIsIOS] = useState(false);
  const [showWebsitesList, setShowWebsitesList] = useState(false);

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
    const extractedUrl = extractUrlFromQueryString(queryString);

    if (extractedUrl) {
      setUrl(extractedUrl);
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
    const isAtBottom = scrollHeight - scrollTop - clientHeight < UI_CONFIG.LOG_SCROLL_THRESHOLD;

    userScrollingRef.current = !isAtBottom;
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
    const urlsToProcess = urls.filter(
      (url) => !processedUrls.has(normalizeUrl(url)) && processedUrls.size < maxUrlsToProcess
    );

    // Process in batches
    for (let i = 0; i < urlsToProcess.length; i += PROCESSING_CONFIG.BATCH_SIZE) {
      if (processedUrls.size >= maxUrlsToProcess) break;

      const batch = urlsToProcess.slice(i, i + PROCESSING_CONFIG.BATCH_SIZE);
      const remainingCapacity = maxUrlsToProcess - processedUrls.size;
      const batchToProcess = batch.slice(0, remainingCapacity);

      // Mark URLs as processed before fetching to avoid duplicates
      batchToProcess.forEach((url) => processedUrls.add(normalizeUrl(url)));

      // Log batch processing
      log(`🚀 Processing batch of ${batchToProcess.length} URLs at depth ${currentDepth}...`);

      // Process batch in parallel
      const batchPromises = batchToProcess.map(async (url) => {
        try {
          log(`🔄 Fetching: ${url}`);
          const content = await scrapeUrl(url);

          if (!content) {
            log(`⚠️ Warning: Empty content returned for ${url}`);
          } else if (is404Page(content)) {
            log(`❌ 404 Page detected: ${url}`);
            return { url, content: '' }; // Return empty content for 404 pages
          } else {
            log(
              `✅ Successfully scraped ${content.length.toLocaleString()} characters from ${url}`
            );
          }

          // Extract links for next depth level
          if (currentDepth < maxDepth && content) {
            const links = extractLinks(content, baseUrl || urls[0]);
            links.forEach((link) => {
              if (!processedUrls.has(normalizeUrl(link))) {
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
          } else if (!errorMessage.includes('❌')) {
            // Only log if we haven't already logged a specific error
            log(`❌ Error scraping ${url}: ${errorMessage}`);
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
      if (
        i + PROCESSING_CONFIG.BATCH_SIZE < urlsToProcess.length &&
        processedUrls.size < maxUrlsToProcess
      ) {
        log(`⏳ Waiting before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_CONFIG.BATCH_DELAY));
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
      setError(`URL must be from ${getSupportedDomainsText()}`);

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

    // Update the browser URL
    updateUrlWithDocumentation(trimmedUrl);

    setError('');
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    setResults([]);
    setStats({ lines: 0, size: 0, urls: 0 });

    // Request notification permission on first use
    await requestNotificationPermission(isIOS);

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
      const successfulResults = processedResults.filter(
        (r) => r.content && r.content.trim().length > 0 && !is404Page(r.content)
      );
      const failedResults = processedResults.filter(
        (r) => !r.content || r.content.trim().length === 0 || is404Page(r.content)
      );

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

      // Show notification
      showNotification(
        '✅ Processing Complete',
        `Successfully processed ${processedResults.length} URLs`,
        isIOS
      );
    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      log(`❌ Fatal error: ${errorMessage}`);

      // Additional error context
      if (errorMessage.includes('fetch')) {
        log(`💡 Tip: Check your internet connection and try again.`);
      } else if (errorMessage.includes('timeout')) {
        log(`💡 Tip: The server might be slow. Try reducing the max URLs or depth.`);
      }

      showNotification(
        '❌ Processing Failed',
        'An error occurred. Check the activity log for details.',
        isIOS
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    downloadMarkdown({
      url,
      results,
      filterUrls,
      deduplicateContent,
      filterAvailability,
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/logo.png"
              alt="Apple Docs to Markdown Logo"
              width={50}
              height={50}
              className="rounded-lg"
              priority
            />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Web Documentation to Markdown Converter
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Convert developer documentation from {getSupportedDomainsText()} to clean, LLM-friendly
            Markdown format. Process pages with smart filtering, deduplication, and bulk export.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Made by{' '}
            <a
              href="https://twitter.com/steipete"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              @steipete
            </a>{' '}
            •{' '}
            <a
              href="https://github.com/steipete/apple-docs-to-markdown"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View on GitHub
            </a>
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Documentation URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://developer.apple.com/documentation/swiftui"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-lg"
              disabled={isProcessing}
            />
            <div className="relative inline-block mt-2">
              <button
                onClick={() => setShowWebsitesList(!showWebsitesList)}
                onBlur={() => setTimeout(() => setShowWebsitesList(false), 200)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline cursor-pointer transition-colors"
              >
                This document parser supports a list of selected websites.
              </button>

              {/* Popover */}
              {showWebsitesList && (
                <div className="absolute z-50 mt-2 left-0 w-96 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Supported Websites
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
                      {} as Record<string, (typeof ALLOWED_DOMAINS)[keyof typeof ALLOWED_DOMAINS][]>
                    )
                  ).map(([category, domains]) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {category}
                      </h4>
                      <ul className="space-y-1">
                        {domains.map((domain) => (
                          <li
                            key={domain.name}
                            className="text-xs text-gray-600 dark:text-gray-400"
                          >
                            <a
                              href={domain.example}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {domain.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Add GitHub issue link */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Are you missing a page?{' '}
                      <a
                        href="https://github.com/amantus-ai/llm-codes/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open an Issue on GitHub!
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showOptions ? 'Hide' : 'Show'} Options
          </button>

          {/* Options */}
          {showOptions && (
            <div className="space-y-4 mb-6 p-4 bg-white dark:bg-gray-700 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="depth"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Crawl Depth
                  </label>
                  <input
                    type="number"
                    id="depth"
                    value={depth}
                    onChange={(e) =>
                      setDepth(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))
                    }
                    min="0"
                    max="5"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white"
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    How many levels deep to follow links (0-5)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="maxUrls"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Max URLs
                  </label>
                  <input
                    type="number"
                    id="maxUrls"
                    value={maxUrls}
                    onChange={(e) =>
                      setMaxUrls(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))
                    }
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white"
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum pages to process (1-1000)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterUrls}
                    onChange={(e) => setFilterUrls(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Filter out URLs from content (recommended for LLMs)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deduplicateContent}
                    onChange={(e) => setDeduplicateContent(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Remove duplicate paragraphs (reduces token usage)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterAvailability}
                    onChange={(e) => setFilterAvailability(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Filter availability strings (iOS 14.0+, etc.)
                  </span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={processUrl}
            disabled={isProcessing || !url}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </>
            ) : (
              'Process Documentation'
            )}
          </button>
        </div>

        {/* Processing Results */}
        {(isProcessing || results.length > 0) && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Processing Configuration
              </h2>
              {notificationPermission === 'default' && !isIOS && (
                <button
                  onClick={() => requestNotificationPermission(isIOS)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Enable notifications
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Crawl Depth</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {depth} levels
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Max URLs</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {maxUrls} pages
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Options</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {[
                    filterUrls && 'Filter URLs',
                    deduplicateContent && 'Deduplicate',
                    filterAvailability && 'Filter Availability',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-2 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</h3>
              <span className="text-sm text-gray-600 dark:text-gray-400">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Activity Log Toggle */}
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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

            {/* Activity Log */}
            {showLogs && (
              <div className="mt-4">
                <div
                  ref={logContainerRef}
                  onScroll={handleLogScroll}
                  className="bg-black text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-xs"
                >
                  {logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        {results.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.urls}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">URLs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.size.toFixed(1)}K
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Size</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(stats.lines / 1000).toFixed(1)}K
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Lines</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Markdown
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
