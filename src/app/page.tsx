'use client';

import { useState, useEffect } from 'react';

interface ProcessingResult {
  url: string;
  content: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [maxUrls, setMaxUrls] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ lines: 0, size: 0, urls: 0 });
  const [showLogs, setShowLogs] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const log = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  const showNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
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

  const extractLinks = (content: string): string[] => {
    const links = new Set<string>();
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[2];
      if (href.startsWith('/documentation/')) {
        links.add(`https://developer.apple.com${href}`);
      } else if (href.startsWith('https://developer.apple.com/documentation/')) {
        links.add(href);
      }
    }
    
    return Array.from(links);
  };

  const scrapeUrl = async (urlToScrape: string): Promise<string> => {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape, action: 'scrape' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scrape URL');
      }

      const data = await response.json();
      if (data.cached) {
        log(`Using cached content for ${urlToScrape}`);
      }
      return data.data.markdown;
    } catch (error) {
      log(`Error scraping ${urlToScrape}: ${error}`);
      throw error;
    }
  };

  const processUrlsWithDepth = async (
    urls: string[],
    currentDepth: number,
    maxDepth: number,
    maxUrlsToProcess: number,
    processedUrls: Set<string> = new Set()
  ): Promise<ProcessingResult[]> => {
    if (currentDepth > maxDepth) return [];
    
    const results: ProcessingResult[] = [];
    const newUrls = new Set<string>();
    
    for (const url of urls) {
      if (processedUrls.has(url) || processedUrls.size >= maxUrlsToProcess) continue;
      
      processedUrls.add(url);
      
      try {
        log(`Processing (depth ${currentDepth}): ${url}`);
        const content = await scrapeUrl(url);
        results.push({ url, content });
        
        // Extract links for next depth level
        if (currentDepth < maxDepth) {
          const links = extractLinks(content);
          links.forEach(link => {
            if (!processedUrls.has(link)) {
              newUrls.add(link);
            }
          });
        }
        
        // Update progress
        const progressPercent = Math.round(Math.min(90, (processedUrls.size / maxUrlsToProcess) * 90));
        setProgress(progressPercent);
        
      } catch (error) {
        log(`Failed to process ${url}`);
      }
      
      if (processedUrls.size >= maxUrlsToProcess) {
        log(`Reached maximum URL limit (${maxUrlsToProcess})`);
        break;
      }
    }
    
    // Process next depth level
    if (currentDepth < maxDepth && newUrls.size > 0 && processedUrls.size < maxUrlsToProcess) {
      const nextResults = await processUrlsWithDepth(
        Array.from(newUrls),
        currentDepth + 1,
        maxDepth,
        maxUrlsToProcess,
        processedUrls
      );
      results.push(...nextResults);
    }
    
    return results;
  };

  const processUrl = async () => {
    if (!url || !url.startsWith('https://developer.apple.com')) {
      setError('URL must start with https://developer.apple.com');
      return;
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
      log(`Starting documentation processing (depth: ${depth}, max URLs: ${maxUrls})...`);
      
      const processedResults = await processUrlsWithDepth([url], 0, depth, maxUrls);
      setResults(processedResults);
      
      // Calculate stats
      const content = processedResults.map(r => `# ${r.url}\n\n${r.content}\n\n---\n\n`).join('');
      const lines = content.split('\n').length;
      const sizeKB = new Blob([content]).size / 1024;
      
      setStats({
        lines,
        size: sizeKB,
        urls: processedResults.length,
      });
      
      setProgress(100);
      log(`Processing complete! Processed ${processedResults.length} URLs.`);
      
      // Show notification
      showNotification(
        '✅ Documentation Ready!',
        `Successfully processed ${processedResults.length} URLs. Your Markdown file is ready to download.`
      );
      
    } catch (error) {
      setError(`Processing failed: ${error}`);
      showNotification(
        '❌ Processing Failed',
        'An error occurred while processing the documentation.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMarkdown = () => {
    const content = results.map(r => `# ${r.url}\n\n${r.content}\n\n---\n\n`).join('');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apple-developer-docs.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Apple Docs Converter</h1>
              <p className="text-sm text-slate-600">Transform developer documentation to clean Markdown</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
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
                <svg className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            {/* Configuration */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-700">Processing Configuration</h3>
                {typeof window !== 'undefined' && 'Notification' in window && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${
                      notificationPermission === 'granted' ? 'bg-green-500' : 
                      notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-slate-600">
                      Notifications {notificationPermission === 'granted' ? 'enabled' : 
                                   notificationPermission === 'denied' ? 'blocked' : 'not set'}
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
                    <div className="absolute right-3 top-2.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      levels
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    0 = main page only
                  </p>
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
                    <div className="absolute right-3 top-2.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      pages
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Maximum pages to process
                  </p>
                </div>
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Documentation...
                </span>
              ) : (
                'Process Documentation'
              )}
            </button>
          </div>

          {/* Status Section */}
          <div className="space-y-6">
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
                    <svg className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {showLogs ? 'Hide' : 'Show'} activity log
                  </button>
                  
                  {showLogs && (
                    <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-1 font-mono text-xs text-slate-600">
                        {logs.slice(-10).map((log, i) => (
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
                    <div className="text-2xl font-bold text-blue-600">{(stats.lines / 1000).toFixed(1)}K</div>
                    <div className="text-xs text-slate-600 mt-1">Lines</div>
                  </div>
                </div>
              </div>
            )}

            {/* Download Button */}
            {results.length > 0 && (
              <button
                onClick={downloadMarkdown}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 px-6 rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Download Markdown
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-sm text-slate-600 mb-6">
              This service is being offered and paid for by{' '}
              <a
                href="https://twitter.com/steipete"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Peter Steinberger
              </a>
              . If you want to thank me, give me a shoutout and follow my newsletter.
            </p>
            
            {/* Newsletter Form */}
            <div className="max-w-md mx-auto">
              <form
                action="https://buttondown.email/api/emails/embed-subscribe/steipete"
                method="post"
                target="popupwindow"
                onSubmit={(e) => {
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
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all text-sm shadow-md hover:shadow-lg"
                >
                  Subscribe
                </button>
              </form>
              <p className="text-xs text-slate-500 mt-3">
                Join my newsletter for insights on technology and engineering leadership.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}