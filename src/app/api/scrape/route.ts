import { NextRequest, NextResponse } from 'next/server';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

// Cache implementation using Edge Runtime KV storage would go here
// For now, we'll use in-memory cache (resets on deployment)
const cache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 1 month

export async function POST(request: NextRequest) {
  try {
    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { url, action } = body;

    const isValidUrl =
      url &&
      (url.startsWith('https://developer.apple.com') ||
        url.startsWith('https://swiftpackageindex.com/') ||
        /^https:\/\/[^\/]+\.github\.io\//.test(url));

    if (!isValidUrl) {
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
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
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
          waitFor: 5000, // Increased from 2000ms to 5000ms for complex pages
          maxAge: 2592000000, // 30 days in milliseconds (30 * 24 * 60 * 60 * 1000)
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Firecrawl API error: ${error}` },
          { status: response.status }
        );
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
