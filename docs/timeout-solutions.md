# Vercel Timeout Solutions for llm.codes

## Current Situation
- Current timeout: 60 seconds (Pro plan maximum)
- Issue: Some documentation scraping operations take longer than 60 seconds

## Solutions

### 1. **Optimize Current Implementation** (Recommended)
- Reduce concurrent scraping from 15 to 5-10
- Implement better caching to avoid re-scraping
- Add request queuing with smaller batches

### 2. **Implement Background Jobs**
Instead of synchronous processing:
```javascript
// Start job
POST /api/scrape/start
Response: { jobId: "abc123" }

// Poll for status
GET /api/scrape/status/:jobId
Response: { status: "processing", progress: 45 }

// Get results when ready
GET /api/scrape/results/:jobId
```

### 3. **Use Edge Functions**
Edge Functions have different timeout limits:
- Hobby: 30 seconds
- Pro/Enterprise: 30 seconds (but can stream responses)

### 4. **External Processing Service**
- Use AWS Lambda (15 min timeout)
- Use Google Cloud Functions (9 min timeout)
- Use dedicated worker service (Render, Railway)

### 5. **Streaming Response**
Stream partial results as they're processed:
```javascript
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Process URLs and stream results
  processUrls().then(async (results) => {
    for (const result of results) {
      await writer.write(encoder.encode(JSON.stringify(result) + '\n'));
    }
    await writer.close();
  });

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
```

## Quick Fix for Now

Update `/src/constants.ts` to reduce concurrency:

```typescript
export const PROCESSING_CONFIG = {
  CONCURRENT_LIMIT: 5, // Reduce from 15
  // ... other config
};
```

This should help most requests complete within 60 seconds.