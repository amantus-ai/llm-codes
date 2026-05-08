<!-- Generated: 2025-01-15 14:33:00 UTC -->

# Files Catalog

## Overview

The llm-codes project is a Next.js application that converts JavaScript-heavy documentation sites into clean Markdown for AI consumption. The codebase is organized into core application components, API routes for scraping, utility functions for content processing, comprehensive test suites, and configuration files for the build system and deployment.

File organization follows Next.js App Router conventions with `src/app` for routes, `src/utils` for processing logic, and `src/lib` for shared libraries. Test files colocate with their source files using `__tests__` directories.

## Core Application

**Main Entry Points**

- `src/app/page.tsx` - Homepage UI with URL input, scraping controls, and real-time progress tracking
- `src/app/layout.tsx` - Root layout with metadata, theme support, and global styles
- `src/app/icon.tsx` - Dynamic favicon generation component
- `src/app/theme-script.tsx` - Client-side theme initialization script
- `src/app/globals.css` - Tailwind CSS v4 imports and custom styles

## API Routes

**Scraping Endpoints**

- `src/app/api/scrape/route.ts` - Main scraping endpoint with caching, retries, and Firecrawl integration
- `src/app/api/crawl/start/route.ts` - Starts Firecrawl crawl jobs
- `src/app/api/crawl/[jobId]/status/route.ts` - Streams Firecrawl crawl status and page results
- `src/app/api/cache/stats/route.ts` - Cache statistics endpoint for monitoring

## Utilities

**Content Processing**

- `src/utils/content-processing.ts` - Multi-stage filtering pipeline for cleaning scraped content
- `src/utils/documentation-filter.ts` - Comprehensive content filters (navigation, ads, code blocks)
- `src/utils/url-utils.ts` - URL validation, normalization, and domain whitelisting
- `src/utils/file-utils.ts` - File download handling with proper naming
- `src/utils/code-extraction.ts` - Fenced code block extraction and formatting
- `src/utils/result-processing.ts` - Final output shaping for filtered and code-only downloads

**Libraries**

- `src/lib/firecrawl.ts` - Shared Firecrawl client, error mapping, and content validation helpers
- `src/lib/http2-client.ts` - HTTP/2 client wrapper used by the Firecrawl client
- `src/lib/cache/redis-cache.ts` - Redis cache implementation with TTL support

**Constants**

- `src/constants.ts` - Documentation URL patterns, explicit exceptions, processing limits, and cache TTL

## Tests

**Test Configuration**

- `src/test/setup.ts` - Vitest setup with happy-dom environment
- `vitest.config.ts` - Test runner configuration with coverage settings

**Test Suites**

- `src/utils/__tests__/*.test.ts` - Utility function tests for URL, filtering, content, code extraction, and output shaping
- `src/app/api/scrape/__tests__/route.test.ts` - API endpoint integration tests
- `src/app/api/scrape/batch/__tests__/route.test.ts` - Batch processing tests
- `src/lib/cache/__tests__/redis-cache.test.ts` - Cache implementation tests

## Configuration

**Build System**

- `next.config.js` - Next.js configuration with API timeout settings
- `postcss.config.js` - PostCSS configuration for Tailwind CSS v4
- `tsconfig.json` - TypeScript strict mode configuration
- `package.json` - Dependencies and scripts for dev/build/test
- `components.json` - shadcn/ui component library configuration

**Deployment**

- `vercel.json` - Vercel deployment configuration with function limits
- `public/manifest.json` - PWA manifest for browser integration

**Documentation**

- `README.md` - Project overview and quick start guide
- `CLAUDE.md` - AI assistant guidance for codebase navigation
- `CONTRIBUTING.md` - Contribution guidelines and development setup
- `spec.md` - Technical specification and architecture details

**Assets**

- `public/logo.png` - Application logo (48x48)
- `public/og-image.png` - Open Graph preview image (1200x630)

## Dependencies

**Core Framework**: Next.js 16 with App Router, React 19, TypeScript 6
**Styling**: Tailwind CSS v4 and custom CSS utilities
**Testing**: Vitest with happy-dom, coverage reporting, and optional live Firecrawl smoke scripts
**External APIs**: Firecrawl for JavaScript rendering
**Caching**: In-memory with optional Redis support
