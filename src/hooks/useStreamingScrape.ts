import { useState, useCallback, useRef } from 'react';
import { filterDocumentation } from '@/utils/documentation-filter';

interface StreamMessage {
  type: 'url_start' | 'url_complete' | 'url_error' | 'progress' | 'done' | 'stats';
  url?: string;
  content?: string;
  error?: string;
  progress?: number;
  total?: number;
  cached?: boolean;
  stats?: string;
}

interface ProcessingResult {
  url: string;
  content: string;
}

interface UseStreamingScrapeOptions {
  onUrlStart?: (url: string) => void;
  onUrlComplete?: (url: string, content: string, cached: boolean) => void;
  onUrlError?: (url: string, error: string) => void;
  onProgress?: (progress: number, total: number) => void;
  onComplete?: (results: ProcessingResult[]) => void;
  onStats?: (stats: string) => void;
  filterOptions?: {
    filterUrls: boolean;
    filterAvailability: boolean;
    deduplicateContent: boolean;
    useComprehensiveFilter: boolean;
  };
}

export function useStreamingScrape(options: UseStreamingScrapeOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const processUrls = useCallback(
    async (urls: string[], depth: number = 0, maxUrls: number = 10) => {
      setIsProcessing(true);
      setError(null);
      setProgress(0);
      setResults([]);

      const collectedResults: ProcessingResult[] = [];
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/scrape/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls, depth, maxUrls }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr.trim()) {
                try {
                  const message: StreamMessage = JSON.parse(jsonStr);

                  switch (message.type) {
                    case 'url_start':
                      if (message.url && options.onUrlStart) {
                        options.onUrlStart(message.url);
                      }
                      break;

                    case 'url_complete':
                      if (message.url && message.content) {
                        let filteredContent = message.content;

                        // Apply filtering if options are provided
                        if (options.filterOptions?.useComprehensiveFilter) {
                          filteredContent = filterDocumentation(filteredContent, {
                            filterUrls: options.filterOptions.filterUrls,
                            filterAvailability: options.filterOptions.filterAvailability,
                            filterNavigation: true,
                            filterLegalBoilerplate: true,
                            filterEmptyContent: true,
                            filterRedundantTypeAliases: true,
                            filterExcessivePlatformNotices: true,
                            filterFormattingArtifacts: true,
                            deduplicateContent: options.filterOptions.deduplicateContent,
                          });
                        }

                        const result = { url: message.url, content: filteredContent };
                        collectedResults.push(result);
                        setResults([...collectedResults]);

                        if (options.onUrlComplete) {
                          options.onUrlComplete(
                            message.url,
                            filteredContent,
                            message.cached || false
                          );
                        }
                      }
                      break;

                    case 'url_error':
                      if (message.url && message.error && options.onUrlError) {
                        options.onUrlError(message.url, message.error);
                      }
                      break;

                    case 'progress':
                      if (message.progress !== undefined && message.total !== undefined) {
                        const progressPercent = Math.round(
                          (message.progress / message.total) * 100
                        );
                        setProgress(progressPercent);

                        if (options.onProgress) {
                          options.onProgress(message.progress, message.total);
                        }
                      }
                      break;

                    case 'stats':
                      if (message.stats && options.onStats) {
                        options.onStats(message.stats);
                      }
                      // Also log to console for debugging
                      if (message.stats) {
                        console.log('\n' + message.stats);
                      }
                      break;

                    case 'done':
                      setProgress(100);
                      if (options.onComplete) {
                        options.onComplete(collectedResults);
                      }
                      break;
                  }
                } catch (e) {
                  console.error('Error parsing stream message:', e);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name !== 'AbortError') {
            setError(err.message);
          }
        } else {
          setError('Unknown error occurred');
        }
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    processUrls,
    cancel,
    isProcessing,
    results,
    progress,
    error,
  };
}
