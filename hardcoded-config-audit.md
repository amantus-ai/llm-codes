# Hardcoded Configuration Values Audit

## Currently in PROCESSING_CONFIG ✅
- `CACHE_DURATION`: 30 days
- `FIRECRAWL_WAIT_TIME`: 3000ms
- `DEFAULT_CRAWL_DEPTH`: 2
- `DEFAULT_MAX_URLS`: 200
- `CONCURRENT_LIMIT`: 5
- `MAX_RETRIES`: 5
- `INITIAL_RETRY_DELAY`: 1000ms
- `MAX_RETRY_DELAY`: 10000ms (currently says 30000 in comment but is 10000)
- `RETRY_STATUS_CODES`: [429, 500, 502, 503, 504]
- `MIN_CONTENT_LENGTH`: 200

## Still Hardcoded ❌

### In `/src/app/api/scrape/route.ts`:
1. **Firecrawl timeout**: 60000ms (line 76)
2. **Fetch timeout**: 90000ms (line 82)

### In `/src/lib/cache/redis-cache.ts`:
1. **Local cache TTL**: 5 * 60 * 1000 (5 minutes, line 25)
2. **Default TTL**: 30 * 24 * 60 * 60 (30 days, line 27)
3. **Compression threshold**: 5000 bytes (line 27)

### In `/src/app/page.tsx`:
1. **Default depth**: 2 (hardcoded in state)
2. **Default max URLs**: 200 (hardcoded in state)
3. **Animation delays**: Various timeouts for UI (50ms, 350ms, etc.)

### In UI_CONFIG ✅
- `LOG_SCROLL_THRESHOLD`: 10
- `PROGRESS_UPDATE_INTERVAL`: 100

### In FILE_CONFIG ✅
- `DEFAULT_FILENAME`: 'documentation.md'
- `APPLE_DEFAULT_FILENAME`: 'apple-docs.md'
- `SWIFT_PACKAGE_DEFAULT_FILENAME`: 'swift-package-docs.md'

## Missing Configurations That Should Be Added:
1. `FIRECRAWL_TIMEOUT`: 60000
2. `FETCH_TIMEOUT`: 90000
3. `LOCAL_CACHE_TTL`: 5 * 60 * 1000
4. `COMPRESSION_THRESHOLD`: 5000
5. Various UI animation delays