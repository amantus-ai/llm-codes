<!-- Generated: 2025-06-15 21:17:00 UTC -->

# Build System

llm.codes uses Next.js 16 with Turbopack for development and TypeScript for type safety. The build system is optimized for fast development iterations and production deployment on Vercel.

## Build Configuration

**Next.js Configuration** - Main config in `next.config.js` (lines 1-6)

```javascript
const nextConfig = {
  reactStrictMode: true,
};
```

**TypeScript Configuration** - Type checking config in `tsconfig.json` (lines 1-28)

- Target: ES2022
- Strict mode enabled for type safety
- Path aliases: `@/*` maps to `./src/*`
- Next.js plugin for enhanced type checking

**Vercel Deployment** - Function configuration in `vercel.json` (lines 1-7)

```json
{
  "functions": {
    "src/app/api/scrape/route.ts": {
      "maxDuration": 60
    }
  }
}
```

## Build Workflows

### Development Commands

**Start Development Server**

```bash
pnpm run dev
```

- Uses Turbopack for fast Hot Module Replacement (HMR)
- Configured in `package.json` (line 6): `next dev --turbo`
- Runs on http://localhost:3000

**Build for Production**

```bash
pnpm run build
```

- Creates optimized production bundle
- Outputs to `.next/` directory
- Runs TypeScript compilation and Next.js optimization

**Start Production Server**

```bash
pnpm start
```

- Serves the production build
- Requires `pnpm run build` to be run first

### Quality Assurance Commands

**TypeScript Type Checking**

```bash
pnpm run type-check
```

- Runs `tsc --noEmit` to check types without emitting files
- Configuration from `tsconfig.json`

**Linting**

```bash
pnpm run lint
```

- Uses oxlint and oxfmt
- Rules are passed through the `lint` script in `package.json`
- Enforces code style and catches common issues

**Testing**

```bash
pnpm run test:run          # Run all tests once
pnpm run test:ui           # Interactive test UI
pnpm run test:coverage     # Generate coverage report
pnpm run verify:modes:live # Live Firecrawl mode smoke
```

- Uses Vitest with React Testing Library
- Configuration in `vitest.config.ts` (lines 1-17)
- Test environment: happy-dom

## Platform Setup

### Prerequisites

**Node.js Requirements**

- Minimum version: 24.0.0 (defined in `package.json`)
- Recommended: Use latest LTS version

**Environment Variables**
Required for production deployment:

```env
FIRECRAWL_API_KEY=your_api_key_here
```

**Optional Redis Configuration**
For production caching (uses Upstash Redis):

```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Development Dependencies

**Core Build Tools**

- Next.js 16 - React framework with app router
- TypeScript 7 - Type safety
- Tailwind CSS 4 - Styling with PostCSS
- Vitest 4 - Test runner

**Code Quality Tools**

- oxlint - JavaScript/TypeScript linting
- oxfmt - Formatting

### Installation

**Initial Setup**

```bash
# Clone repository
git clone https://github.com/amantus-ai/llm-codes.git
cd llm-codes

# Install dependencies
pnpm install

# Create .env.local file
echo "FIRECRAWL_API_KEY=your_key_here" > .env.local

# Start development
pnpm run dev
```

## Build Targets

### Development Build

- Fast refresh with Turbopack
- Source maps enabled
- No optimization or minification
- Environment: development

### Production Build

- Optimized bundle size
- Minified JavaScript and CSS
- Image optimization
- Static page generation where possible
- Environment: production

### Test Build

- Configured via `vitest.config.ts`
- Uses happy-dom for fast DOM testing
- Path aliases matching TypeScript config

## Reference

### Build Output Structure

```
.next/
├── cache/          # Build cache for faster rebuilds
├── server/         # Server-side build output
├── static/         # Static assets (CSS, JS, media)
└── BUILD_ID        # Unique build identifier
```

### Configuration Files

- `next.config.js` - Next.js framework configuration
- `tsconfig.json` - TypeScript compiler options
- `postcss.config.js` - PostCSS with Tailwind CSS v4
- `vitest.config.ts` - Test runner configuration
- `package.json` - Lint and format command configuration
- `vercel.json` - Deployment configuration

### Common Build Issues

**TypeScript Errors**

- Run `pnpm run type-check` to identify type issues
- Check `tsconfig.json` strict mode settings
- Ensure all imports use correct paths

**Module Resolution**

- Path aliases defined in `tsconfig.json` (line 22-24)
- Use `@/` prefix for src directory imports
- Example: `import { utils } from '@/utils/helpers'`

**Vercel Deployment Timeout**

- API route timeout set to 60 seconds in `vercel.json`
- For longer operations, consider background jobs

**Environment Variables**

- Development: `.env.local` (git-ignored)
- Production: Set in Vercel dashboard
- Required: `FIRECRAWL_API_KEY` for scraping functionality

### Performance Optimization

**Build Speed**

- Turbopack enabled for development (`--turbo` flag)
- Incremental compilation in TypeScript config
- Parallel test execution with Vitest

**Bundle Size**

- Tree shaking enabled by default
- Dynamic imports for code splitting
- Tailwind CSS v4 with automatic purging

**Caching Strategy**

- Next.js automatic caching for static assets
- API route implements 30-day in-memory cache
- Optional Redis for persistent caching
