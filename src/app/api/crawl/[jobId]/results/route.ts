import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/cache/redis-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Get job metadata
    const jobMetadata = await cacheService.getCrawlJob(jobId);
    if (!jobMetadata) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if job is complete
    if (jobMetadata.status !== 'completed' && jobMetadata.status !== 'failed') {
      return NextResponse.json(
        {
          error: 'Job is still in progress',
          status: jobMetadata.status,
          progress: {
            completed: jobMetadata.completedPages || 0,
            total: jobMetadata.totalPages || 0,
          },
        },
        { status: 202 } // Accepted but not complete
      );
    }

    // Get all results
    const allResults = await cacheService.getAllCrawlResults(jobId);

    // Combine all markdown content
    const combinedMarkdown = allResults
      .map((page) => {
        const url = page.metadata?.sourceURL || 'Unknown URL';
        const title = page.metadata?.title || 'Untitled';
        const markdown = page.markdown || '';

        return `# ${title}\n\nSource: ${url}\n\n${markdown}\n\n---\n\n`;
      })
      .join('');

    return NextResponse.json({
      success: true,
      jobId,
      status: jobMetadata.status,
      totalPages: allResults.length,
      creditsUsed: jobMetadata.creditsUsed || 0,
      startedAt: jobMetadata.startedAt,
      completedAt: jobMetadata.completedAt,
      markdown: combinedMarkdown,
    });
  } catch (error) {
    console.error('Crawl Results API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
