<!-- Generated: 2025-06-15 11:20:00 UTC -->

# Development

## Overview

This guide covers the development environment setup, coding conventions, implementation patterns, and workflows for the llm.codes project. The codebase follows strict TypeScript practices with comprehensive testing and emphasizes performance through parallel processing and multi-tier caching. Development uses Next.js 15 with Turbopack for fast iteration, Vitest for testing, and follows a consistent pattern-based architecture.

## Development Environment

**Prerequisites**:
- Node.js 20.0+ (enforced in `package.json` lines 15-17)
- npm or pnpm package manager
- Firecrawl API key (required for scraping functionality)
- Upstash Redis credentials (optional, for production caching)

**Initial Setup**:
```bash
# Clone repository
git clone https://github.com/amantusai/llm-tech.git
cd llm-tech

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your FIRECRAWL_API_KEY to .env.local
```

**Development Scripts** (`package.json` lines 5-13):
- `npm run dev` - Start dev server with Turbopack (fast HMR)
- `npm run build` - Build production bundle
- `npm start` - Run production server
- `npm run lint` - Run ESLint checks
- `npm test` - Run all tests
- `npm run test:ui` - Interactive test UI
- `npm run test:coverage` - Generate coverage report
- `npm run type-check` - TypeScript validation

## Code Style

**TypeScript Configuration** (`tsconfig.json` lines 3-24):
```json
{
  "compilerOptions": {
    "target": "es5",
    "strict": true,              // Strict type checking enabled
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]       // Path aliasing for imports
    }
  }
}
```

**ESLint Rules** (`.eslintrc.json` lines 5-12):
```json
{
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

**Prettier Configuration** (`.prettierrc` lines 2-8):
```javascript
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Import Organization Pattern** (from `src/app/api/scrape/route.ts` lines 1-7):
```typescript
// 1. Next.js imports
import { NextRequest, NextResponse } from 'next/server';
// 2. Internal utilities with @ alias
import { isValidDocumentationUrl } from '@/utils/url-utils';
import { PROCESSING_CONFIG } from '@/constants';
// 3. Library/service imports
import { cacheService } from '@/lib/cache/redis-cache';
import { http2Fetch } from '@/lib/http2-client';
```

## Common Patterns

### Error Handling

**API Route Error Pattern** (`src/app/api/scrape/route.ts` lines 9-29):
```typescript
export async function POST(request: NextRequest) {
  try {
    // Validate environment
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Validate input
    const body = await request.json();
    const { url, action } = body;
    if (!isValidDocumentationUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be from developer.apple.com, swiftpackageindex.com, or *.github.io' },
        { status: 400 }
      );
    }
  } catch (error) {
    // Handle unexpected errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Frontend Error Handling** (`src/app/page.tsx` lines 291-299):
```typescript
if (!response.ok) {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    // If JSON parsing fails, use the default error message
  }
  log(`❌ Failed to fetch ${urlToScrape}: ${errorMessage}`);
}
```

### Caching Pattern

**Two-Tier Cache Implementation** (`src/lib/cache/redis-cache.ts` lines 98-134):
```typescript
export class RedisCache {
  private redis: Redis | null = null;
  private localCache: Map<string, CacheEntry> = new Map();
  private readonly localCacheTTL: number = 5 * 60 * 1000; // 5 minutes for L1 cache

  async get(url: string): Promise<string | null> {
    const key = this.getCacheKey(url);
    
    // Check L1 cache first
    const localEntry = this.localCache.get(key);
    if (localEntry && !this.isLocalCacheExpired(localEntry)) {
      this.stats.hits++;
      return this.decompressContent(localEntry.value, localEntry.compressed || false);
    }
    
    // Check L2 cache (Redis)
    if (this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          // Store in L1 cache
          this.localCache.set(key, { value: data, timestamp: Date.now() });
          return data;
        }
      } catch (error) {
        this.stats.errors++;
      }
    }
    
    this.stats.misses++;
    return null;
  }
}
```

### Component State Management

**Progress Tracking Pattern** (`src/app/page.tsx`):
```typescript
const [isLoading, setIsLoading] = useState(false);
const [progress, setProgress] = useState(0);
const [result, setResult] = useState<string | null>(null);
const [logs, setLogs] = useState<string[]>([]);

const log = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  setLogs((prev) => [...prev, logEntry]);
  
  // Auto-scroll to bottom
  if (logContainerRef.current && !userScrolling.current) {
    setTimeout(() => {
      logContainerRef.current?.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  }
};
```

### URL Processing Pattern

**Flexible URL Filtering** (`src/app/page.tsx` lines 209-272):
```typescript
// Domain-specific filtering logic
if (baseDomain === 'https://developer.apple.com') {
  // Strict section filtering for Apple docs
  if (fullUrl.includes('/documentation/')) {
    const linkPath = normalizedUrl.pathname.toLowerCase();
    const basePathLower = basePath.toLowerCase();
    const basePathParts = basePathLower.split('/').filter((p) => p);
    const linkPathParts = linkPath.split('/').filter((p) => p);

    if (basePathParts.length >= 2 && linkPathParts.length >= 2) {
      if (linkPathParts[0] === basePathParts[0] && linkPathParts[1] === basePathParts[1]) {
        links.add(normalizeUrl(fullUrl));
      }
    }
  }
} else {
  // More permissive for non-Apple sites
  if (normalizedUrl.origin === baseDomain) {
    // Custom logic per domain...
  }
}
```

### Retry Pattern with Exponential Backoff

**API Retry Implementation** (`src/app/api/scrape/route.ts` lines 56-63):
```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  if (attempt > 0) {
    // Calculate delay with exponential backoff
    const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
    console.warn(`Retry attempt ${attempt}/${MAX_RETRIES} for ${url}, waiting ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  try {
    const response = await http2Fetch(/* ... */);
    // Process response...
  } catch (error) {
    lastError = error.message;
    // Continue to next retry
  }
}
```

### Content Processing Pipeline

**Multi-Stage Filtering** (`src/utils/content-processing.ts` lines 18-30):
```typescript
export function removeCommonPhrases(markdown: string): string {
  // Use the comprehensive filter with specific options
  return filterDocumentation(markdown, {
    filterUrls: false,
    filterAvailability: false,
    filterNavigation: true,
    filterLegalBoilerplate: false,
    filterEmptyContent: false,
    filterRedundantTypeAliases: false,
    filterExcessivePlatformNotices: false,
    filterFormattingArtifacts: false,
    deduplicateContent: false,
  });
}
```

## Common Workflows

### Adding a New Documentation Domain

1. **Update Constants** (`src/constants.ts`):
```typescript
export const ALLOWED_DOMAINS = [
  'developer.apple.com',
  'swiftpackageindex.com',
  // Add new domain here
  'newdocs.example.com',
  // ...
];
```

2. **Add Domain-Specific Logic** (if needed in `src/app/page.tsx`):
```typescript
} else if (baseDomain.includes('newdocs.example.com')) {
  // Custom filtering logic for this domain
  if (normalizedUrl.pathname.startsWith('/docs')) {
    links.add(normalizeUrl(fullUrl));
  }
}
```

3. **Add Tests** (`src/utils/__tests__/url-utils.test.ts`):
```typescript
it('should validate newdocs.example.com URLs', () => {
  expect(isValidDocumentationUrl('https://newdocs.example.com/docs')).toBe(true);
});
```

### Creating New Utility Functions

1. **Create Function** (`src/utils/new-utility.ts`):
```typescript
// Follow existing patterns for exports
export function processContent(content: string, options: ProcessOptions): string {
  // Implementation
}
```

2. **Add Tests** (`src/utils/__tests__/new-utility.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { processContent } from '../new-utility';

describe('processContent', () => {
  it('should handle basic case', () => {
    const result = processContent('input', { option: true });
    expect(result).toBe('expected');
  });
});
```

3. **Export from Index** (if applicable):
```typescript
export { processContent } from './new-utility';
```

### Debugging Cache Issues

1. **Check Cache Stats** (`src/lib/cache/redis-cache.ts`):
```typescript
getStats(): CacheStats {
  return { ...this.stats };
}
```

2. **Enable Debug Logging**:
```typescript
console.info(`Cache hit for ${url} (L1: ${fromL1})`);
console.warn(`Cache miss for ${url}`);
```

3. **Clear Cache**:
```typescript
async clear(): Promise<void> {
  this.localCache.clear();
  if (this.redis) {
    await this.redis.flushall();
  }
}
```

### Running Tests

**Full Test Suite**:
```bash
npm test
```

**Watch Mode**:
```bash
npm test -- --watch
```

**Coverage Report**:
```bash
npm run test:coverage
```

**Specific Test File**:
```bash
npm test content-processing
```

**Debug Tests**:
```bash
npm run test:ui  # Opens Vitest UI for debugging
```

## Reference

### File Organization

**Source Structure**:
```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── page.tsx           # Main UI component
│   └── layout.tsx         # Root layout
├── components/            # Reusable React components
├── lib/                   # External service integrations
│   ├── cache/            # Redis cache implementation
│   └── http2-client.ts   # HTTP/2 fetch wrapper
├── utils/                # Business logic utilities
│   ├── content-processing.ts
│   ├── documentation-filter.ts
│   └── __tests__/        # Unit tests
├── constants.ts          # Configuration constants
└── test/                 # Test setup and utilities
```

### Testing Conventions

**Test File Naming**: `[filename].test.ts` in `__tests__` directories
**Test Structure** (`src/utils/__tests__/content-processing.test.ts` lines 10-88):
```typescript
describe('module-name', () => {
  describe('function-name', () => {
    it('should handle specific case', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Performance Considerations

**Parallel Processing** (`src/constants.ts` line 442):
- Batch size: 20 concurrent URLs
- Prevents API rate limiting
- Optimizes processing time

**Caching Strategy**:
- L1: 5-minute in-memory cache
- L2: 30-day Redis cache with LZ compression
- Compression threshold: 5KB

**UI Optimizations**:
- Virtual scrolling for logs
- Progressive updates during processing
- Debounced progress updates