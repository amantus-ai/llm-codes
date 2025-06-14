# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running
- `npm run dev` - Start development server with Turbopack (fast HMR)
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run type-check` - Run TypeScript type checking

### Testing and Quality
- `npm test` - Run all tests with Vitest
- `npm run test:ui` - Run tests with interactive UI
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Run ESLint for code quality

## Architecture Overview

### Core Concept
llm.codes converts JavaScript-heavy documentation sites into clean Markdown for AI consumption. It solves the problem of AI agents being unable to parse modern documentation that relies on client-side rendering.

### Key Components

1. **API Endpoint** (`/api/scrape/route.ts`):
   - Validates URLs against 69 whitelisted documentation domains
   - Implements 30-day in-memory caching
   - Uses Firecrawl API for JavaScript rendering
   - Handles retries with exponential backoff

2. **Content Processing Pipeline** (`/utils/`):
   - `content-processing.ts`: Multi-stage filtering (navigation, URLs, deduplication)
   - `documentation-filter.ts`: Comprehensive content cleaning
   - `scraping.ts`: Parallel URL processing (20 concurrent)
   - `url-utils.ts`: Domain validation and URL extraction

3. **Frontend** (`/app/page.tsx`):
   - React 19 with TypeScript strict mode
   - Tailwind CSS v4 with semantic color system
   - Real-time progress tracking
   - Browser notifications support

### Processing Flow
1. User enters documentation URL
2. Frontend validates against allowed domains
3. API checks cache, then fetches via Firecrawl
4. Content undergoes multi-stage filtering
5. Parallel processing for multi-page crawls (depth 0-5)
6. Returns clean Markdown optimized for AI context

### Performance Optimizations
- Parallel batch processing (20 URLs concurrently)
- Set-based URL deduplication
- Progressive UI updates
- 30-day cache reduces API calls by 70%+

## Environment Setup

Required environment variable:
```
FIRECRAWL_API_KEY=your_api_key_here
```

## Testing Strategy

The project maintains 95%+ test coverage. Key test files:
- API route tests: `__tests__/route.test.ts`
- Utility tests: `utils/__tests__/*.test.ts`
- Uses Vitest with happy-dom environment