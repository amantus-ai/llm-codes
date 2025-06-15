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

**Components**
- `src/components/ui/popover.tsx` - Radix UI popover wrapper for domain tooltip

## API Routes

**Scraping Endpoints**
- `src/app/api/scrape/route.ts` - Main scraping endpoint with caching, retries, and Firecrawl integration
- `src/app/api/scrape/batch/route.ts` - Batch URL processing for multi-page documentation
- `src/app/api/cache/stats/route.ts` - Cache statistics endpoint for monitoring

**API Mocks**
- `src/app/api/scrape/__mocks__/cache.ts` - Mock cache implementation for testing

## Utilities

**Content Processing**
- `src/utils/content-processing.ts` - Multi-stage filtering pipeline for cleaning scraped content
- `src/utils/documentation-filter.ts` - Comprehensive content filters (navigation, ads, code blocks)
- `src/utils/scraping.ts` - Parallel URL processing with concurrency control
- `src/utils/url-utils.ts` - URL validation, normalization, and domain whitelisting
- `src/utils/file-utils.ts` - File download handling with proper naming
- `src/utils/notifications.ts` - Browser notification API wrapper

**Libraries**
- `src/lib/utils.ts` - Utility functions for className merging
- `src/lib/http2-client.ts` - HTTP/2 client wrapper (currently unused)
- `src/lib/cache/redis-cache.ts` - Redis cache implementation with TTL support

**Constants**
- `src/constants.ts` - Application-wide constants (whitelisted domains, cache TTL)

## Tests

**Test Configuration**
- `src/test/setup.ts` - Vitest setup with happy-dom environment
- `vitest.config.ts` - Test runner configuration with coverage settings

**Test Suites**
- `src/utils/__tests__/*.test.ts` - Utility function tests with 95%+ coverage
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

**Core Framework**: Next.js 15 with App Router, React 19, TypeScript 5
**Styling**: Tailwind CSS v4, Radix UI components
**Testing**: Vitest with happy-dom, 95%+ coverage target
**External APIs**: Firecrawl for JavaScript rendering
**Caching**: In-memory with optional Redis support