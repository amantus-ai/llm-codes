<!-- Generated: 2025-06-15 21:17:00 UTC -->

# Build System

llm.codes uses Next.js 15 with Turbopack for development and TypeScript for type safety. The build system is optimized for fast development iterations and production deployment on Vercel.

## Build Configuration

**Next.js Configuration** - Main config in `next.config.js` (lines 1-6)
```javascript
const nextConfig = {
  reactStrictMode: true,
};
```

**TypeScript Configuration** - Type checking config in `tsconfig.json` (lines 1-28)
- Target: ES5 for broad browser compatibility
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
npm run dev
```
- Uses Turbopack for fast Hot Module Replacement (HMR)
- Configured in `package.json` (line 6): `next dev --turbo`
- Runs on http://localhost:3000

**Build for Production**
```bash
npm run build
```
- Creates optimized production bundle
- Outputs to `.next/` directory
- Runs TypeScript compilation and Next.js optimization

**Start Production Server**
```bash
npm start
```
- Serves the production build
- Requires `npm run build` to be run first

### Quality Assurance Commands

**TypeScript Type Checking**
```bash
npm run type-check
```
- Runs `tsc --noEmit` to check types without emitting files
- Configuration from `tsconfig.json`

**Linting**
```bash
npm run lint
```
- Uses ESLint with Next.js, TypeScript, and Prettier rules
- Configuration in `.eslintrc.json` (lines 1-13)
- Enforces code style and catches common issues

**Testing**
```bash
npm test          # Run all tests
npm run test:ui   # Interactive test UI
npm run test:coverage  # Generate coverage report
```
- Uses Vitest with React Testing Library
- Configuration in `vitest.config.ts` (lines 1-17)
- Test environment: happy-dom

## Platform Setup

### Prerequisites

**Node.js Requirements**
- Minimum version: 20.0.0 (defined in `package.json` line 15-17)
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
- Next.js 15.3.3 - React framework with app router
- TypeScript 5.8.3 - Type safety
- Tailwind CSS 4.0.0 - Styling with PostCSS
- Vitest 3.2.3 - Test runner

**Code Quality Tools**
- ESLint 9.29.0 - JavaScript linting
- Prettier 3.5.3 - Code formatting
- @typescript-eslint - TypeScript-specific linting

### Installation

**Initial Setup**
```bash
# Clone repository
git clone https://github.com/amantusai/llm-tech.git
cd llm-tech

# Install dependencies
npm install

# Create .env.local file
echo "FIRECRAWL_API_KEY=your_key_here" > .env.local

# Start development
npm run dev
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
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting rules
- `vercel.json` - Deployment configuration

### Common Build Issues

**TypeScript Errors**
- Run `npm run type-check` to identify type issues
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