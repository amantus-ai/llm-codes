<!-- Generated: 2025-01-15 20:33:00 UTC -->
# Deployment

llm-codes is a Next.js 15 application optimized for serverless deployment with built-in support for Vercel, Netlify, and standalone Node.js environments.

## Overview

The application uses Next.js App Router with server-side rendering and API routes. Key deployment considerations include environment variables for Firecrawl API access, optional Redis caching, and function timeout configurations for long-running scraping operations.

**Build Output** - Production bundle in .next/ directory, static assets in public/
**Key Dependencies** - Node.js 20+, Firecrawl API key, optional Upstash Redis
**Function Limits** - 60-second timeout for scraping API, configurable in vercel.json

## Package Types

**Vercel Deployment** - Zero-config deployment with vercel.json (lines 3-5) function timeout settings
**Netlify Deploy** - Standard Next.js adapter, requires manual function timeout configuration
**Node.js Server** - Standalone server via `npm start` after build
**Docker Container** - Buildable with standard Node.js 20 Alpine image

### Build Commands

```bash
# Development build with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking before deploy
npm run type-check
```

## Platform Deployment

### Vercel (Recommended)

**Configuration** - vercel.json sets 60-second timeout for API route
**Environment** - Set FIRECRAWL_API_KEY in Vercel dashboard
**Auto-deploy** - Push to GitHub main branch triggers deployment

```bash
# Deploy with Vercel CLI
npx vercel

# Production deployment
npx vercel --prod
```

### Netlify

**Build Settings** - Build command: `npm run build`, publish: `.next`
**Functions** - Requires netlify.toml for API timeout configuration
**Environment** - Add FIRECRAWL_API_KEY in site settings

```toml
# netlify.toml (create if needed)
[functions]
  directory = ".netlify/functions"
  timeout = 60

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### Node.js Server

**Requirements** - Node.js 20+ from package.json (line 16)
**Port Config** - Uses PORT env variable or 3000 default
**Process Manager** - Recommend PM2 for production

```bash
# Build and start
npm run build
PORT=3000 npm start

# With PM2
pm2 start npm --name "llm-codes" -- start
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Configuration

**Required Variables** - Set in .env.local for development, platform dashboard for production

```bash
# Firecrawl API (required)
FIRECRAWL_API_KEY=your_api_key_here

# Redis Cache (optional)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Vercel Analytics (auto-configured)
VERCEL_URL=https://your-deployment.vercel.app
```

**Configuration Files**:
- .env.local.example (lines 1-7) - Template for environment variables
- src/lib/cache/redis-cache.ts (lines 33-47) - Redis initialization with fallback
- src/constants.ts (lines 447-463) - Processing and cache configurations

## Production Optimizations

### Performance Settings

**Caching Strategy** - 30-day Redis cache with LZ-string compression (redis-cache.ts lines 76-88)
**Batch Processing** - 20 concurrent URLs per batch (constants.ts line 448)
**Function Timeouts** - 60 seconds for Firecrawl API calls (vercel.json line 4)
**Compression** - Automatic for content >5KB (redis-cache.ts line 26)

### Next.js Optimizations

**Configuration** - next.config.js enables React strict mode (line 3)
**Bundle Size** - Tailwind CSS v4 with PostCSS optimization
**Image Handling** - Static assets served from public/ with cache headers
**Analytics** - Vercel Analytics auto-injected in production (layout.tsx line 81)

### API Rate Limiting

**Retry Logic** - Exponential backoff for 429/5xx errors (constants.ts lines 455-458)
**Batch Delays** - 100ms between large batch operations (constants.ts line 449)
**Cache First** - All requests check 30-day cache before API calls

### Monitoring

**Vercel Analytics** - Automatic Web Vitals tracking via @vercel/analytics
**Cache Stats** - Built-in hit/miss tracking (redis-cache.ts lines 298-305)
**Error Logging** - Console errors for Redis failures with graceful fallback

## Reference

### Deployment Scripts

```bash
# Vercel deployment with environment
vercel --env FIRECRAWL_API_KEY=xxx --prod

# Build for specific platform
NEXT_PUBLIC_DEPLOYMENT_TARGET=vercel npm run build

# Health check endpoint
curl https://your-app.vercel.app/api/scrape \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"url":"https://react.dev/learn","action":"validate"}'
```

### Output Locations

**Build Artifacts** - .next/ directory contains server and static files
**Static Assets** - public/ files served from CDN on Vercel/Netlify
**Logs** - Platform-specific: Vercel Functions logs, Netlify Functions tab
**Cache Data** - Upstash Redis or in-memory fallback

### Platform Limits

- **Vercel Hobby** - 10s default timeout (extended to 60s in vercel.json)
- **Vercel Pro** - 300s max function duration available
- **Netlify Free** - 10s function timeout (configure in netlify.toml)
- **Self-hosted** - No limits, configure via Node.js server settings

### Troubleshooting

**Function Timeouts** - Increase limits in vercel.json or netlify.toml
**Redis Connection** - Check UPSTASH_REDIS_REST_URL format and token
**Memory Issues** - Reduce BATCH_SIZE in constants.ts for large crawls
**CORS Errors** - API routes handle CORS automatically via Next.js