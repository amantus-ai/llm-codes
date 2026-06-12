<!-- Generated: 2025-01-15 19:23:00 UTC -->

# Architecture

## Overview

llm.codes is a Next.js application that converts JavaScript-heavy documentation sites into clean Markdown for AI consumption. The system employs a multi-layered architecture with client-side React components, server-side API routes, and a sophisticated content processing pipeline. The architecture prioritizes performance through parallel processing, caching strategies, HTTP/2 connections, and a small scrape-provider boundary.

## Component Map

**Frontend Layer** - React 19 application in src/app/page.tsx (lines 1-570), layout in src/app/layout.tsx

- Main UI: Interactive form with real-time progress tracking
- Theme Support: Light/dark mode via src/app/theme-script.tsx
- Icons: Custom SVG icon generation in src/app/icon.tsx

**API Layer** - Next.js API routes in src/app/api/

- Single URL Scraping: src/app/api/scrape/route.ts
- Firecrawl Crawl Mode: src/app/api/crawl/start/route.ts and src/app/api/crawl/[jobId]/status/route.ts
- Cache Statistics: src/app/api/cache/stats/route.ts

**Caching Layer** - Dual-layer caching in src/lib/cache/redis-cache.ts

- L1 Cache: In-memory Map with 5-minute TTL (line 24)
- L2 Cache: Redis/Upstash with 30-day TTL via environment config
- Compression: LZ-string for content > 5KB (lines 77-84)

**Processing Pipeline** - Content transformation in src/utils/

- Content Processing: src/utils/content-processing.ts orchestrates filtering stages
- Documentation Filter: src/utils/documentation-filter.ts (lines 33-80) applies 9 filter types
- URL Utilities: src/utils/url-utils.ts validates pattern-based documentation URLs plus explicit exceptions

**Infrastructure** - Performance optimizations in src/lib/

- Firecrawl Client: src/lib/firecrawl.ts owns Firecrawl request shapes, error mapping, and scrape payload validation
- Playwright Client: src/lib/playwright-scraper.ts owns opt-in self-hosted browser extraction for `SCRAPE_PROVIDER=playwright`
- Provider Selection: src/lib/scrape-provider.ts resolves `SCRAPE_PROVIDER` and keeps Playwright cache keys separate from Firecrawl cache keys
- HTTP/2 Client: src/lib/http2-client.ts uses Undici agent with connection pooling
- Constants: src/constants.ts defines all configuration (lines 1-477)

## Key Files

**Core Entry Points**

- src/app/page.tsx - Main React component handling user interaction, progress tracking, file downloads
- src/app/api/scrape/route.ts - Primary API endpoint with retry logic (lines 56-123), cache checking (lines 31-46)
- src/app/api/crawl/start/route.ts - Starts Firecrawl crawl jobs
- src/app/api/crawl/[jobId]/status/route.ts - Polls Firecrawl crawl jobs and streams page results

**Processing Core**

- src/utils/content-processing.ts - Orchestrates multi-stage filtering, extracts links (lines 43-98)
- src/utils/documentation-filter.ts - Comprehensive filter removing navigation, boilerplate, redundant content
- src/hooks/useCrawl.ts - Client hook for Firecrawl crawl-mode start/status/result handling

**Infrastructure Components**

- src/lib/cache/redis-cache.ts - RedisCache class with stats tracking, compression, dual-layer caching
- src/lib/firecrawl.ts - Shared Firecrawl adapter for scrape/crawl/status calls
- src/lib/http2-client.ts - HTTP/2 connection with 10 pipelined requests, 2 connections per origin
- src/constants.ts - Central configuration for domains, processing limits, retry strategies

**Configuration Files**

- src/app/globals.css - Tailwind CSS v4 styling
- src/app/layout.tsx - Root layout with metadata, theme support
- src/test/setup.ts - Vitest test configuration

## Data Flow

**1. URL Submission** (src/app/page.tsx lines 264-346)

```typescript
User enters URL → validateUrl() → isValidDocumentationUrl() checks against ALLOWED_DOMAINS
→ Depth/options selection → handleScrape() initiates processing
```

**2. Single URL Processing** (src/app/api/scrape/route.ts)

```typescript
POST /api/scrape → Check L1/L2 cache (lines 31-46)
→ If miss: selected provider call with retries. Firecrawl is default; Playwright launches local Chromium with the requested documentation hostname pinned to a public DNS result.
→ Response validation → Cache storage → Return markdown
```

**3. Multi-URL Processing Flow** (src/app/page.tsx)

```typescript
Root URL scrape → Shared link extraction → Bounded queue/concurrency
→ Individual /api/scrape calls
→ Cache each page → Aggregate results
```

**4. Content Processing Pipeline** (src/utils/content-processing.ts + documentation-filter.ts)

```typescript
Raw markdown → filterNavigationAndUIChrome() → filterLegalBoilerplate()
→ filterEmptyContent() → filterRedundantTypeAliases() → filterUrlsFromMarkdown()
→ filterAvailabilityStrings() → deduplicateMarkdown() → Clean markdown
```

**5. Caching Strategy** (src/lib/cache/redis-cache.ts)

```typescript
Request → Check L1 memory cache (5 min TTL)
→ If miss: Check L2 Redis cache (30 day TTL)
→ If miss: Fetch from selected provider → Compress if >5KB
→ Store in both L1 and L2 → Return content
```

**6. HTTP/2 Optimization** (src/lib/http2-client.ts)

```typescript
All external API calls → http2Fetch() with Undici agent
→ Connection pooling (2 connections) → Pipelining (10 requests)
→ Keep-alive (60s timeout) → Response with improved latency
```

**7. Progress Tracking** (src/app/page.tsx lines 134-163)

```typescript
Processing starts → Real-time logs via setLogs()
→ Progress calculation from completed/total URLs
→ UI updates with stats (lines, size, URLs)
→ Optional browser notifications on completion
```

**Error Handling Flow**

```typescript
API errors → Exponential backoff retry (max 5 attempts)
→ Status codes 429/5xx trigger retries
→ Failed URLs logged but don't stop batch
→ User sees detailed error messages
```

**Performance Optimizations**

- Parallel batch processing (10 concurrent requests)
- Set-based URL deduplication preventing redundant fetches
- Progressive UI updates every 100 processed URLs
- 30-day cache reduces API calls by 70%+
- HTTP/2 multiplexing for improved latency
