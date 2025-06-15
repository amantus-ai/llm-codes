<!-- Generated: 2025-06-15 11:12:00 UTC -->

# Project Overview

## Overview

llm.codes is a high-performance web service that converts JavaScript-heavy documentation sites into clean, LLM-optimized Markdown format. It solves the critical problem of AI agents being unable to parse modern documentation sites that rely heavily on client-side rendering, particularly Apple's developer documentation. The service transforms dynamic web content into semantic Markdown that AI agents can actually use, supporting 69 major documentation sites across programming languages, frameworks, cloud platforms, databases, and more.

## Key Files

**Main Entry Points**:
- `src/app/page.tsx` - Main UI component with form, processing logic, and real-time progress tracking
- `src/app/api/scrape/route.ts` - Core API endpoint that handles documentation conversion
- `src/app/layout.tsx` - Root layout with metadata and analytics integration

**Core Configuration**:
- `src/constants.ts` - Domain whitelist (69 sites), processing config, and retry settings
- `next.config.js` - Next.js configuration with React strict mode
- `tsconfig.json` - TypeScript configuration with strict mode and path aliases
- `package.json` - Project metadata, scripts, and dependencies

## Technology Stack

**Framework & Language**:
- Next.js 15 with App Router - `next.config.js`, `src/app/` directory structure
- TypeScript 5.8 with strict mode - `tsconfig.json` (lines 7: `"strict": true`)
- React 19 - `package.json` (line 54: `"react": "^19.1.0"`)

**UI & Styling**:
- Tailwind CSS v4 with custom theme - `src/app/globals.css` (lines 1-115)
- Radix UI components - `package.json` (line 40: `"@radix-ui/react-popover"`)
- Custom animations - `src/app/globals.css` (lines 117-327)

**API & Processing**:
- Firecrawl API for JavaScript rendering - `src/app/api/scrape/route.ts` (lines 65-83)
- HTTP/2 client for performance - `src/lib/http2-client.ts`
- Content filtering pipeline - `src/utils/content-processing.ts`, `src/utils/documentation-filter.ts`

**Caching & Performance**:
- Upstash Redis with LZ compression - `src/lib/cache/redis-cache.ts` (lines 1-323)
- Two-tier caching (L1 memory + L2 Redis) - `src/lib/cache/redis-cache.ts` (lines 104-134)
- Batch processing (20 URLs concurrent) - `src/constants.ts` (line 442)

**Testing & Quality**:
- Vitest with 95%+ coverage - `vitest.config.ts`, `src/utils/__tests__/`
- ESLint + Prettier - `package.json` (lines 66-75)
- TypeScript strict mode - `tsconfig.json` (line 7)

## Platform Support

**Requirements**:
- Node.js 20.0+ - `package.json` (lines 15-17: `"engines": { "node": ">=20.0.0" }`)
- Modern browsers with Notification API support
- Firecrawl API key (required) - Environment variable `FIRECRAWL_API_KEY`
- Upstash Redis (optional) - Environment variables `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Deployment Platforms**:
- Vercel (optimized) - `vercel.json` configuration
- Any Node.js 20+ hosting platform
- Docker-compatible environments

**Browser Support**:
- Chrome, Firefox, Safari 10.14+, Edge
- Progressive Web App capabilities - `public/manifest.json`
- iOS limitations for notifications - `src/app/page.tsx` (lines 51-61)