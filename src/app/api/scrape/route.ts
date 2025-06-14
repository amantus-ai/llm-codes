import { NextRequest, NextResponse } from 'next/server';
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

// Cache implementation using Edge Runtime KV storage would go here
// For now, we'll use in-memory cache (resets on deployment)
const cache = new Map<string, { content: string; timestamp: number }>();

export async function POST(request: NextRequest) {
  try {
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { url, action } = body;

    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        {
          error:
            'Invalid URL. Must be from developer.apple.com, swiftpackageindex.com, or *.github.io',
        },
        { status: 400 }
      );
    }

    if (action === 'scrape') {
      // Check cache
      const cacheKey = `scrape_${url}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROCESSING_CONFIG.CACHE_DURATION) {
        return NextResponse.json({
          success: true,
          data: { markdown: cached.content },
          cached: true,
        });
      }

      // Scrape the URL
      const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: PROCESSING_CONFIG.FIRECRAWL_WAIT_TIME,
          maxAge: PROCESSING_CONFIG.CACHE_DURATION,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Firecrawl API error (${response.status})`;

        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorData.message || errorText;
            } catch {
              // If not JSON, use the raw text
              errorMessage = `Firecrawl API error: ${errorText}`;
            }
          }
        } catch {
          // If reading response fails, stick with default message
        }

        // Add helpful context based on status code
        if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden. The API key might be invalid.';
        } else if (response.status === 500) {
          errorMessage = 'Firecrawl server error. Please try again later.';
        } else if (response.status === 404) {
          errorMessage = 'Page not found. Please check the URL.';
        }

        return NextResponse.json({ error: errorMessage }, { status: response.status });
      }

      const data = await response.json();

      // Log the response structure for debugging (using console.error for production builds)
      if (!data.data?.markdown) {
        console.error(`Firecrawl response for ${url}:`, {
          success: data.success,
          hasData: !!data.data,
          hasMarkdown: !!data.data?.markdown,
          markdownLength: data.data?.markdown?.length || 0,
          dataKeys: data.data ? Object.keys(data.data) : [],
        });
      }

      if (data.success && data.data && typeof data.data.markdown === 'string') {
        // Cache the result (even if empty)
        cache.set(cacheKey, {
          content: data.data.markdown,
          timestamp: Date.now(),
        });

        return NextResponse.json({
          success: true,
          data: { markdown: data.data.markdown },
          cached: false,
        });
      }

      // Provide more detailed error message
      const errorMsg =
        data.error ||
        (!data.success
          ? 'Firecrawl returned success: false'
          : !data.data
            ? 'No data object in response'
            : 'No markdown content in response');

      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
