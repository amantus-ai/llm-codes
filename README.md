# llm.codes - Transform Developer Documentation for AI Agents

A high-performance web service that converts JavaScript-heavy documentation sites into clean, LLM-optimized Markdown. Built specifically to solve the problem of AI agents being unable to parse modern documentation sites that rely heavily on client-side rendering.

**Why llm.codes exists**: Modern AI agents like Claude Code struggle with JavaScript-heavy documentation sites, particularly Apple's developer docs. This tool bridges that gap by converting dynamic content into clean, parseable Markdown that AI agents can actually use.

📖 **Read the full story**: [How llm.codes Transforms Developer Documentation for AI Agents](https://steipete.me/posts/llm-codes-transform-developer-docs)

![Web Documentation to Markdown Converter](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Technical Architecture

### Core Problem Solved
Modern documentation sites (especially Apple's) use heavy JavaScript rendering that makes content invisible to AI agents. llm.codes solves this by:
- Using Firecrawl's headless browser to execute JavaScript and capture fully-rendered content
- Converting dynamic HTML to clean, semantic Markdown
- Removing noise (navigation, footers, duplicate content) that wastes AI context tokens
- Providing parallel URL processing for efficient multi-page documentation crawling

### Key Features

- **Parallel Processing**: Fetches up to 20 URLs concurrently using batched promises
- **Smart Caching**: Redis-backed 30-day cache reduces API calls and improves response times
- **Content Filtering**: Multiple filtering strategies to remove:
  - Navigation elements and boilerplate
  - Platform availability strings (iOS 14.0+, etc.)
  - Duplicate content across pages
  - Empty sections and formatting artifacts
- **Recursive Crawling**: Configurable depth-first crawling with intelligent link extraction
- **Browser Notifications**: Web Notifications API integration for background processing alerts
- **URL State Management**: Query parameter-based URL sharing for easy documentation links

## Live Demo

🚀 **Try it now at [llm.codes](https://llm.codes/)**

Experience the tool instantly without any setup required.

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- [Firecrawl API key](https://firecrawl.dev)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/amantus-ai/llm-codes.git
cd llm-codes
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

4. Add your Firecrawl API key to `.env.local`:

```env
# Required
FIRECRAWL_API_KEY=your_api_key_here

# Optional - Redis Cache (Recommended for production)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# Optional - Cache Admin
CACHE_ADMIN_KEY=your_secure_admin_key_here
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy to Vercel

The easiest way to deploy is using Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famantus-ai%2Fllm-codes&env=FIRECRAWL_API_KEY&envDescription=Your%20Firecrawl%20API%20key&envLink=https%3A%2F%2Ffirecrawl.dev)

1. Click the button above
2. Create a new repository
3. Add your `FIRECRAWL_API_KEY` environment variable
4. Deploy!

### Manual Deployment

1. Push to your GitHub repository
2. Import project on [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `FIRECRAWL_API_KEY`: Your Firecrawl API key (required)
   - `UPSTASH_REDIS_REST_URL`: Your Upstash Redis URL (optional)
   - `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis token (optional)
   - `CACHE_ADMIN_KEY`: Admin key for cache endpoints (optional)
4. Deploy

## Usage

1. **Enter URL**: Paste any documentation URL

   - Most documentation sites are automatically supported through pattern matching
   - Click "Learn more" to see the supported URL patterns

2. **Configure Options** (click "Show Options"):

   - **Crawl Depth**: How deep to follow links (0 = main page only, max 5)
   - **Max URLs**: Maximum number of pages to process (1-1000, default 200)
   - **Filter URLs**: Remove hyperlinks from content (recommended for LLMs)
   - **Deduplicate Content**: Remove duplicate paragraphs to save tokens
   - **Filter Availability**: Remove platform availability strings (iOS 14.0+, etc.)

3. **Process**: Click "Process Documentation" and grant notification permissions if prompted

4. **Monitor Progress**:

   - Real-time progress bar shows completion percentage
   - Activity log displays detailed processing information
   - Browser notifications alert you when complete

5. **Download**: View statistics and download your clean Markdown file

## Supported Documentation Sites

llm.codes uses intelligent pattern matching to support most documentation sites automatically. Rather than maintaining a list of thousands of individual sites, we use regex patterns to match common documentation URL structures.

### Pattern-Based Matching

We support documentation sites that match these patterns:

1. **Documentation Subdomains** (`docs.*, developer.*, learn.*, etc.`)
   - Examples: `docs.python.org`, `developer.apple.com`, `learn.microsoft.com`
   - Pattern: Any subdomain like docs, developer, dev, learn, help, api, guide, wiki, or devcenter

2. **Documentation Paths** (`/docs, /guide, /learn, etc.`)
   - Examples: `angular.io/docs`, `redis.io/docs`, `react.dev/learn`
   - Pattern: URLs ending with paths like /docs, /documentation, /api-docs, /guides, /learn, /help, /stable, or /latest

3. **Programming Language Sites** (`*js.org, *lang.org, etc.`)
   - Examples: `vuejs.org`, `kotlinlang.org`, `ruby-doc.org`
   - Pattern: Domains ending with js, lang, py, or -doc followed by .org or .com

4. **GitHub Pages** (`*.github.io`)
   - Examples: Any GitHub Pages documentation site
   - Pattern: All subdomains of github.io

### Explicit Exceptions

A small number of popular documentation sites don't follow standard patterns and are explicitly supported:

- Swift Package Index (`swiftpackageindex.com`)
- Flask (`flask.palletsprojects.com`)
- Material-UI (`mui.com/material-ui`)
- pip (`pip.pypa.io/en/stable`)
- PHP (`www.php.net/docs.php`)

### Adding New Sites

Most documentation sites are automatically supported! If your site follows standard documentation URL patterns (like having `/docs` in the path or `docs.` as a subdomain), it should work without any changes.

If you find a documentation site that isn't supported, please [open an issue](https://github.com/steipete/llm-codes/issues) and we'll either adjust our patterns or add it as an exception.

## Configuration Options

| Option         | Description                          | Default | Range  |
| -------------- | ------------------------------------ | ------- | ------ |
| Crawl Depth    | How many levels deep to follow links | 2       | 0-5    |
| Max URLs       | Maximum number of URLs to process    | 200     | 1-1000 |
| Batch Size     | URLs processed concurrently          | 20      | N/A    |
| Cache Duration | How long results are cached          | 30 days | N/A    |

## API Architecture

### POST `/api/scrape`

The core API endpoint that handles documentation conversion.

**Request Flow:**
1. URL validation against allowed domains whitelist
2. Cache check (Redis/in-memory with 30-day TTL)
3. Firecrawl API call with optimized scraping parameters
4. Content post-processing and filtering
5. Response with markdown and cache status

**Request Body:**
```json
{
  "url": "https://developer.apple.com/documentation/swiftui",
  "action": "scrape"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# SwiftUI Documentation\n\n..."
  },
  "cached": false
}
```

**Error Handling:**
- Domain validation errors (400)
- Firecrawl API errors (500)
- Network timeouts (504)
- Rate limiting (429)

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **API**: [Firecrawl](https://firecrawl.dev/) for web scraping
- **Cache**: [Upstash Redis](https://upstash.com/) for distributed caching
- **Deployment**: [Vercel](https://vercel.com/)
- **Development**: Turbopack for fast refreshes

## Project Structure

```
llm-codes/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── scrape/
│   │   │       ├── route.ts           # API endpoint
│   │   │       └── __tests__/         # API tests
│   │   ├── globals.css                # Global styles & Tailwind
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Main page component
│   │   └── icon.tsx                   # Dynamic favicon
│   ├── constants.ts                   # Configuration constants
│   ├── utils/                         # Utility functions
│   │   ├── content-processing.ts      # Content cleaning logic
│   │   ├── file-utils.ts              # File handling
│   │   ├── notifications.ts           # Browser notifications
│   │   ├── scraping.ts                # Scraping utilities
│   │   ├── url-utils.ts               # URL validation & handling
│   │   └── __tests__/                 # Utility tests
│   └── test/
│       └── setup.ts                   # Test configuration
├── public/
│   └── favicon.svg                    # Static favicon
├── next.config.js                     # Next.js configuration
├── postcss.config.js                  # PostCSS with Tailwind v4
├── tsconfig.json                      # TypeScript configuration
├── vitest.config.ts                   # Vitest test configuration
├── spec.md                            # Detailed specification
└── package.json                       # Dependencies
```

## Technical Implementation Details

### Content Processing Pipeline

1. **URL Extraction**: Custom regex patterns extract links from markdown and HTML
2. **Domain-Specific Filtering**: Each documentation site has custom rules for link following
3. **Parallel Batch Processing**: URLs processed in batches of 10 for optimal performance
4. **Content Deduplication**: Hash-based paragraph and section deduplication
5. **Multi-Stage Filtering**: Sequential filters for URLs, navigation, boilerplate, and platform strings

### Performance Optimizations

- **Batched API Calls**: Reduces Firecrawl API latency by processing multiple URLs per request
- **Progressive Loading**: UI updates with real-time progress during long crawls
- **Smart Link Extraction**: Only follows relevant documentation links based on URL patterns
- **Client-Side Caching**: Browser-based result caching for repeat operations

### Testing Strategy

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check
```

Tests cover:
- URL validation and domain filtering
- Content processing and deduplication
- API error handling
- Cache behavior
- UI component interactions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

### Notifications not working?

- Check browser permissions for notifications
- Ensure you're using a supported browser (Chrome, Firefox, Safari 10.14+, Edge)
- Try resetting notification permissions in browser settings

### API Rate Limits?

The app includes a 30-day cache to minimize API calls. If you're hitting rate limits:

- Reduce crawl depth
- Lower maximum URLs
- Wait for cached results
- Consider setting up Redis cache for better performance

### Redis Cache Setup

For production use, we recommend setting up Redis cache:

1. Sign up for [Upstash](https://upstash.com) (free tier available)
2. Create a Redis database
3. Add the credentials to your environment variables
4. The app will automatically use Redis for caching

Benefits:
- Cache persists across deployments
- Shared cache across all instances
- Automatic compression for large documents
- ~70% reduction in Firecrawl API calls

### Deployment Issues?

- Ensure `FIRECRAWL_API_KEY` is set in environment variables
- Check Vercel function logs for errors
- Verify your API key is valid

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Supported Documentation Sites

LLM Codes supports 69 documentation sites across multiple categories:

### Programming Languages

- Python, MDN Web Docs, TypeScript, Rust, Go, Java, Ruby, PHP, Swift, Kotlin

### Web Frameworks

- React, Vue.js, Angular, Next.js, Nuxt, Svelte, Django, Flask, Express.js, Laravel

### Cloud Platforms

- AWS, Google Cloud, Azure, DigitalOcean, Heroku, Vercel, Netlify, Salesforce

### Databases

- PostgreSQL, MongoDB, MySQL, Redis, Elasticsearch, Couchbase, Cassandra

### DevOps & Infrastructure

- Docker, Kubernetes, Terraform, Ansible, GitHub, GitLab

### AI/ML Libraries

- PyTorch, TensorFlow, Hugging Face, scikit-learn, LangChain, pandas, NumPy

### CSS Frameworks

- Tailwind CSS, Bootstrap, Material-UI, Chakra UI

### Build Tools & Package Managers

- npm, webpack, Vite, pip, Cargo, Maven

### Testing Frameworks

- Jest, Cypress, Playwright, pytest, Mocha

### Mobile Development

- React Native, Flutter, Android, Apple Developer

## Missing a Site?

If you need support for a documentation site that's not listed, please [open an issue on GitHub](https://github.com/amantus-ai/llm-codes/issues)!

## Architecture Decisions

### Why Firecrawl?
- Handles JavaScript-heavy sites that traditional scrapers can't parse
- Built-in markdown conversion with semantic structure preservation
- Reliable headless browser automation at scale

### Why Next.js 15 + App Router?
- Server-side API key security
- Built-in caching with fetch()
- Streaming responses for large documentation sets
- Edge-ready deployment on Vercel

### Why Client-Side Processing?
- Reduces server load for filtering operations
- Enables real-time UI updates during processing
- Allows users to customize output without re-fetching

## Future Enhancements

- WebSocket support for real-time crawl progress
- Custom domain rule configuration
- Batch URL upload via CSV/JSON
- Export to multiple formats (PDF, EPUB, Docusaurus)
- LLM-specific formatting profiles

## Acknowledgments

- Powered by [Firecrawl](https://firecrawl.dev/referral?rid=9CG538BE) for JavaScript rendering
- Inspired by the challenges of making documentation accessible to AI agents
- Built with Next.js 15, Tailwind CSS v4, and TypeScript

---

Built by [Peter Steinberger](https://steipete.me) | [Blog Post](https://steipete.me/posts/llm-codes-transform-developer-docs) | [Twitter](https://twitter.com/steipete)
