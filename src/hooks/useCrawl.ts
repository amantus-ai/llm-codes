import { useState, useCallback, useRef } from 'react';
import { filterDocumentation } from '@/utils/documentation-filter';
import { extractOnlyCodeBlocks } from '@/utils/code-extraction';

interface CrawlStatusMessage {
  type: 'status' | 'progress' | 'url_complete' | 'error' | 'complete';
  status?: string;
  progress?: number;
  total?: number;
  url?: string;
  content?: string;
  error?: string;
  creditsUsed?: number;
  cached?: boolean;
}

interface ProcessingResult {
  url: string;
  content: string;
}

interface UseCrawlOptions {
  onStatusChange?: (status: string) => void;
  onUrlComplete?: (url: string, content: string, cached: boolean) => void;
  onProgress?: (progress: number, total: number, creditsUsed?: number) => void;
  onComplete?: (results: ProcessingResult[], creditsUsed: number) => void;
  onError?: (error: string) => void;
  filterOptions?: {
    filterUrls: boolean;
    filterAvailability: boolean;
    deduplicateContent: boolean;
    useComprehensiveFilter: boolean;
    codeBlocksOnly: boolean;
  };
}

export function useCrawl(options: UseCrawlOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const startCrawl = useCallback(
    async (url: string, limit: number = 10, maxDepth: number = 2) => {
      setIsProcessing(true);
      setError(null);
      setProgress(0);
      setResults([]);
      setStatus('starting');
      setCreditsUsed(0);

      try {
        // Start the crawl job
        const startResponse = await fetch('/api/crawl/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, limit, maxDepth }),
        });

        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new Error(errorData.error || `HTTP ${startResponse.status}`);
        }

        const { jobId: newJobId } = await startResponse.json();
        setJobId(newJobId);

        // Start monitoring the crawl status
        await monitorCrawlStatus(newJobId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        if (options.onError) {
          options.onError(errorMessage);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options]
  );

  const monitorCrawlStatus = useCallback(
    async (crawlJobId: string) => {
      const collectedResults: ProcessingResult[] = [];
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`/api/crawl/${crawlJobId}/status`, {
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
                  const message: CrawlStatusMessage = JSON.parse(jsonStr);

                  switch (message.type) {
                    case 'status':
                      if (message.status) {
                        setStatus(message.status);
                        if (options.onStatusChange) {
                          options.onStatusChange(message.status);
                        }
                      }
                      break;

                    case 'progress':
                      if (message.progress !== undefined && message.total !== undefined) {
                        const progressPercent =
                          message.total > 0
                            ? Math.round((message.progress / message.total) * 100)
                            : 0;
                        setProgress(progressPercent);

                        if (message.creditsUsed !== undefined) {
                          setCreditsUsed(message.creditsUsed);
                        }

                        if (options.onProgress) {
                          options.onProgress(message.progress, message.total, message.creditsUsed);
                        }
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

                        // Extract only code blocks if requested
                        if (options.filterOptions?.codeBlocksOnly) {
                          filteredContent = extractOnlyCodeBlocks(filteredContent);
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

                    case 'error':
                      if (message.error) {
                        setError(message.error);
                        if (options.onError) {
                          options.onError(message.error);
                        }
                      }
                      break;

                    case 'complete':
                      setProgress(100);
                      setStatus('completed');
                      if (options.onComplete) {
                        options.onComplete(collectedResults, message.creditsUsed || 0);
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
            if (options.onError) {
              options.onError(err.message);
            }
          }
        } else {
          const errorMessage = 'Unknown error occurred';
          setError(errorMessage);
          if (options.onError) {
            options.onError(errorMessage);
          }
        }
      } finally {
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

  const getResults = useCallback(async () => {
    if (!jobId) {
      throw new Error('No job ID available');
    }

    try {
      const response = await fetch(`/api/crawl/${jobId}/results`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, [jobId]);

  return {
    startCrawl,
    cancel,
    getResults,
    isProcessing,
    results,
    progress,
    error,
    status,
    jobId,
    creditsUsed,
  };
}
