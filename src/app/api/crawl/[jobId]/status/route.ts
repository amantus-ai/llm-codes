import { NextRequest } from 'next/server';
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';
import { PROCESSING_CONFIG } from '@/constants';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const encoder = new TextEncoder();
  const { jobId } = await params;

  // Helper to send SSE messages
  const sendMessage = (message: CrawlStatusMessage) => {
    return encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
  };

  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'error', error: 'Server configuration error' })}\n\n`
        ),
        { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    // Get initial job metadata from cache
    const jobMetadata = await cacheService.getCrawlJob(jobId);
    if (!jobMetadata) {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Job not found' })}\n\n`),
        { status: 404, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        let isComplete = false;
        let lastPageNumber = 0;
        const pollInterval = 2000; // Poll every 2 seconds
        const maxPollingTime = 600000; // 10 minutes max
        const startTime = Date.now();

        // Keep track of URLs we've already sent to avoid duplicates
        const sentUrls = new Set<string>();

        while (!isComplete && Date.now() - startTime < maxPollingTime) {
          try {
            // Check crawl status with Firecrawl
            const statusUrl = jobMetadata.next || `${FIRECRAWL_API_URL}/crawl/${jobId}`;

            const response = await http2Fetch(statusUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              },
              signal: AbortSignal.timeout(30000), // 30s timeout for status check
            });

            if (response.ok) {
              const data = await response.json();

              // Update job metadata
              const updatedMetadata = {
                status: data.status,
                totalPages: data.total || 0,
                completedPages: data.completed || 0,
                creditsUsed: data.creditsUsed || 0,
                expiresAt: data.expiresAt,
                next: data.next,
                lastPageNumber: data.data ? lastPageNumber + 1 : lastPageNumber,
              };

              await cacheService.updateCrawlJobStatus(jobId, updatedMetadata);

              // Send status update
              controller.enqueue(
                sendMessage({
                  type: 'status',
                  status: data.status,
                })
              );

              // Send progress update
              controller.enqueue(
                sendMessage({
                  type: 'progress',
                  progress: data.completed || 0,
                  total: data.total || 0,
                  creditsUsed: data.creditsUsed,
                })
              );

              // Process any new data
              if (data.data && Array.isArray(data.data)) {
                // Store results in cache
                await cacheService.setCrawlResults(jobId, lastPageNumber, data.data);

                // Process each page result
                for (const page of data.data) {
                  if (page.metadata?.sourceURL && !sentUrls.has(page.metadata.sourceURL)) {
                    sentUrls.add(page.metadata.sourceURL);

                    const url = page.metadata.sourceURL;
                    const content = page.markdown || '';

                    // Check if we already have this URL cached
                    const cachedContent = await cacheService.get(url);

                    if (cachedContent) {
                      controller.enqueue(
                        sendMessage({
                          type: 'url_complete',
                          url,
                          content: cachedContent,
                          cached: true,
                        })
                      );
                    } else {
                      // Cache the new content
                      if (content.length >= PROCESSING_CONFIG.MIN_CONTENT_LENGTH) {
                        await cacheService.set(url, content);
                      }

                      controller.enqueue(
                        sendMessage({
                          type: 'url_complete',
                          url,
                          content,
                          cached: false,
                        })
                      );
                    }
                  }
                }

                lastPageNumber++;
              }

              // Check if crawl is complete
              if (
                data.status === 'completed' ||
                (data.status === 'scraping' && !data.next && data.completed === data.total)
              ) {
                isComplete = true;

                await cacheService.updateCrawlJobStatus(jobId, {
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                });

                controller.enqueue(
                  sendMessage({
                    type: 'complete',
                    total: data.total || 0,
                    creditsUsed: data.creditsUsed || 0,
                  })
                );
              } else if (data.status === 'failed') {
                isComplete = true;

                await cacheService.updateCrawlJobStatus(jobId, {
                  status: 'failed',
                  failedAt: new Date().toISOString(),
                });

                controller.enqueue(
                  sendMessage({
                    type: 'error',
                    error: 'Crawl job failed',
                  })
                );
              }

              // Update jobMetadata for next iteration
              if (data.next) {
                jobMetadata.next = data.next;
              }
            } else {
              // Handle error response
              console.error(`Failed to get crawl status for job ${jobId}: ${response.status}`);

              controller.enqueue(
                sendMessage({
                  type: 'error',
                  error: `Failed to get crawl status: ${response.status}`,
                })
              );

              // Don't immediately fail, retry on next iteration
            }
          } catch (error) {
            console.error(`Error polling crawl status for job ${jobId}:`, error);

            controller.enqueue(
              sendMessage({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            );

            // Don't immediately fail, retry on next iteration
          }

          // Wait before next poll
          if (!isComplete) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }
        }

        // If we hit the max polling time, send a timeout error
        if (!isComplete) {
          controller.enqueue(
            sendMessage({
              type: 'error',
              error: 'Crawl job timed out after 10 minutes',
            })
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Crawl Status API Error:', error);
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`
      ),
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }
}
