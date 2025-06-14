# LLM Codes - Comprehensive Project Specification

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Supported Documentation Sources](#supported-documentation-sources)
5. [Technical Architecture](#technical-architecture)
6. [Core Features](#core-features)
7. [Implementation Details](#implementation-details)
8. [User Interface & Experience](#user-interface--experience)
9. [Performance & Optimization](#performance--optimization)
10. [Security Considerations](#security-considerations)
11. [Known Limitations](#known-limitations)
12. [Future Enhancements](#future-enhancements)

## Executive Summary

LLM Codes is a powerful web application that transforms technical documentation from 69+ major documentation sites into clean, AI-optimized markdown files. Supporting everything from programming languages and web frameworks to cloud platforms and AI/ML libraries, the tool addresses the critical gap between rapidly evolving technologies and AI coding assistants' knowledge cutoffs, enabling developers to provide current documentation context across the entire development ecosystem for better code generation.

## Problem Statement

AI coding assistants face several challenges with documentation:
- Knowledge cutoffs prevent awareness of new APIs and frameworks
- Raw HTML documentation contains noise that confuses AI models
- Platform-specific availability strings clutter the context
- Duplicate content wastes valuable token limits
- Navigation elements and boilerplate reduce signal-to-noise ratio

## Solution Overview

The application provides:
- **Intelligent Web Scraping**: Extracts documentation while preserving structure
- **Multi-level Crawling**: Discovers related documentation automatically
- **Advanced Content Cleaning**: Removes noise while preserving signal
- **Optimized Output**: Generates AI-friendly markdown with proper formatting
- **User-Friendly Interface**: Simple workflow with real-time progress tracking

## Supported Documentation Sources

LLM Codes supports 69 documentation sites across 10 major categories:

### Programming Languages (10 sites)
- **Python** (`https://docs.python.org`)
- **MDN Web Docs** (`https://developer.mozilla.org`) - JavaScript/Web APIs
- **TypeScript** (`https://www.typescriptlang.org/docs`)
- **Rust** (`https://doc.rust-lang.org`)
- **Go** (`https://golang.org/doc`)
- **Java** (`https://docs.oracle.com/javase`)
- **Ruby** (`https://ruby-doc.org`)
- **PHP** (`https://www.php.net/docs.php`)
- **Swift** (`https://docs.swift.org`)
- **Kotlin** (`https://kotlinlang.org/docs`)

### Web Frameworks (10 sites)
- **React** (`https://react.dev`)
- **Vue.js** (`https://vuejs.org`)
- **Angular** (`https://angular.io/docs`)
- **Next.js** (`https://nextjs.org/docs`)
- **Nuxt** (`https://nuxt.com/docs`)
- **Svelte** (`https://svelte.dev/docs`)
- **Django** (`https://docs.djangoproject.com`)
- **Flask** (`https://flask.palletsprojects.com`)
- **Express.js** (`https://expressjs.com`)
- **Laravel** (`https://laravel.com/docs`)

### Cloud Platforms (7 sites)
- **AWS** (`https://docs.aws.amazon.com`)
- **Google Cloud** (`https://cloud.google.com/docs`)
- **Azure** (`https://docs.microsoft.com/azure`)
- **DigitalOcean** (`https://docs.digitalocean.com`)
- **Heroku** (`https://devcenter.heroku.com`)
- **Vercel** (`https://vercel.com/docs`)
- **Netlify** (`https://docs.netlify.com`)

### Databases (7 sites)
- **PostgreSQL** (`https://www.postgresql.org/docs`)
- **MongoDB** (`https://docs.mongodb.com`)
- **MySQL** (`https://dev.mysql.com/doc`)
- **Redis** (`https://redis.io/docs`)
- **Elasticsearch** (`https://www.elastic.co/guide`)
- **Couchbase** (`https://docs.couchbase.com`)
- **Cassandra** (`https://cassandra.apache.org/doc`)

### DevOps & Infrastructure (6 sites)
- **Docker** (`https://docs.docker.com`)
- **Kubernetes** (`https://kubernetes.io/docs`)
- **Terraform** (`https://www.terraform.io/docs`)
- **Ansible** (`https://docs.ansible.com`)
- **GitHub** (`https://docs.github.com`)
- **GitLab** (`https://docs.gitlab.com`)

### AI/ML Libraries (7 sites)
- **PyTorch** (`https://pytorch.org/docs`)
- **TensorFlow** (`https://www.tensorflow.org/api_docs`)
- **Hugging Face** (`https://huggingface.co/docs`)
- **scikit-learn** (`https://scikit-learn.org/stable`)
- **LangChain** (`https://docs.langchain.com`)
- **pandas** (`https://pandas.pydata.org/docs`)
- **NumPy** (`https://numpy.org/doc`)

### CSS Frameworks (5 sites)
- **Tailwind CSS** (`https://tailwindcss.com/docs`)
- **Bootstrap** (`https://getbootstrap.com/docs`)
- **Material-UI** (`https://mui.com/material-ui`)
- **Chakra UI** (`https://chakra-ui.com/docs`)
- **Bulma** (`https://bulma.io/documentation`)

### Build Tools & Package Managers (6 sites)
- **npm** (`https://docs.npmjs.com`)
- **webpack** (`https://webpack.js.org/docs`)
- **Vite** (`https://vitejs.dev/guide`)
- **pip** (`https://pip.pypa.io/en/stable`)
- **Cargo** (`https://doc.rust-lang.org/cargo`)
- **Maven** (`https://maven.apache.org/guides`)

### Testing Frameworks (5 sites)
- **Jest** (`https://jestjs.io/docs`)
- **Cypress** (`https://docs.cypress.io`)
- **Playwright** (`https://playwright.dev/docs`)
- **pytest** (`https://docs.pytest.org`)
- **Mocha** (`https://mochajs.org`)

### Mobile Development (4 sites)
- **React Native** (`https://reactnative.dev/docs`)
- **Flutter** (`https://flutter.dev/docs`)
- **Android** (`https://developer.android.com/docs`)
- **Apple Developer** (`https://developer.apple.com`)

### Special Support
- **Swift Package Index** (`https://swiftpackageindex.com/`)
- **GitHub Pages** (`https://*.github.io/*` - any subdomain)

## Technical Architecture

### Frontend Stack
```
- Framework: Next.js 15.3.3 (App Router)
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS v4.0 (new @theme syntax)
- UI Library: React 19.1.0
- Build Tool: Turbopack
- State Management: React Hooks (useState, useEffect, useRef)
```

### Backend Architecture
```
- API: Next.js API Routes (Edge Runtime)
- External Service: Firecrawl API
- Caching: In-memory Map with 30-day TTL
- Environment: Requires FIRECRAWL_API_KEY
- Testing: Vitest with full coverage support
- Batch Processing: 20 concurrent URL fetches
```

### Project Structure
```
/src/
├── app/
│   ├── page.tsx              # Main application UI with popover
│   ├── api/
│   │   └── scrape/
│   │       ├── route.ts      # API endpoint for scraping
│   │       └── __tests__/    # API tests
│   ├── manifest.json         # PWA manifest
│   └── globals.css           # Global styles
├── constants.ts              # Configuration constants & domains
├── utils/                    # Utility functions
│   ├── content-processing.ts # Content cleaning algorithms
│   ├── file-utils.ts         # File download handling
│   ├── notifications.ts      # Browser notification system
│   ├── scraping.ts           # Scraping utilities
│   ├── url-utils.ts          # URL validation & handling
│   └── __tests__/            # Comprehensive test suite
└── test/
    └── setup.ts              # Test configuration
```

## Core Features

### 1. URL Processing System

#### Validation Logic
```typescript
export function isValidDocumentationUrl(url: string): boolean {
  if (!url) return false;

  // Check each allowed domain (69 total)
  return Object.values(ALLOWED_DOMAINS).some((domain) => {
    if (typeof domain.pattern === 'string') {
      return url.startsWith(domain.pattern);
    } else if (typeof domain.pattern === 'object' && domain.pattern instanceof RegExp) {
      return domain.pattern.test(url);
    }
    return false;
  });
}
```

#### Processing Pipeline
1. Validate URL against 69 whitelisted domains
2. Check in-memory cache (30-day retention)
3. Fetch via Firecrawl API with options:
   - `formats: ['markdown']`
   - `onlyMainContent: true`
   - `waitFor: 5000ms`
   - `maxAge: 2592000000ms` (30 days)
4. Apply content transformations
5. Update cache and return result

### 2. Multi-Level Crawling Engine

#### Depth Configuration
- **Range**: 0-5 levels (0 = single page only)
- **Default**: 2 levels
- **Behavior**: Depth-first traversal with URL deduplication
- **Batch Size**: 20 URLs processed concurrently
- **Batch Delay**: 500ms between batches

#### URL Discovery Algorithm
```javascript
// Extract links from markdown content
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

// Domain-specific link filtering
if (baseDomain === 'https://developer.apple.com') {
  // Only follow same documentation section
  if (linkPathParts[0] === basePathParts[0] && 
      linkPathParts[1] === basePathParts[1]) {
    links.add(fullUrl);
  }
} else {
  // For other domains, stay within path hierarchy
  if (fullUrl.startsWith(baseUrl) || baseUrl.startsWith(fullUrl)) {
    links.add(fullUrl);
  }
}
```

#### Crawl Limitations
- **Max URLs**: Configurable 1-1000 (default: 200)
- **Timeout**: None (processes until complete or limit reached)
- **Deduplication**: Uses Set to prevent revisiting URLs

### 3. Content Cleaning Algorithms

#### a) Common Phrase Removal
Removes navigation and boilerplate elements:
- "Skip Navigation"
- "On This Page"
- "API Reference" sections
- "Downloads" sections
- "Documentation Archive"
- Breadcrumb indicators ("Current page is")

#### b) Hyperlink Removal (`filterUrlsFromMarkdown`)
Three-pass approach:
1. Convert `[text](url)` → `text`
2. Remove standalone URLs with whitespace prefix
3. Remove `<http://...>` formatted URLs
4. Clean up resulting double spaces

#### c) Content Deduplication (`deduplicateMarkdown`)
Intelligent deduplication that:
- Tracks seen paragraphs, headers, and list items
- Preserves first occurrence
- Maintains document structure
- Handles different markdown elements separately

#### d) Availability String Filtering (`filterAvailabilityStrings`)
Removes platform availability information:
- Pattern: `iOS 14.0+iPadOS 14.0+Mac Catalyst 14.0+...`
- Removes entire lines containing only availability info
- Cleans up empty lines after removal

### 4. Output Generation

#### File Naming Convention
```javascript
// Extract meaningful path components
const pathParts = urlPath.split('/').filter(p => p);
const filename = pathParts.length > 0 
  ? `${pathParts.join('-')}-docs.md`
  : 'apple-developer-docs.md';
```

#### Markdown Structure
```markdown
<!--
Downloaded via https://llm.codes by @steipete on [Date] at [Time]
Source URL: [original URL]
Total pages processed: [count]
URLs filtered: [Yes/No]
Content de-duplicated: [Yes/No]
Availability strings filtered: [Yes/No]
-->

# [Page URL 1]

[Processed content with preserved formatting]

---

# [Page URL 2]

[Processed content continues...]
```

### 5. Progress Tracking System

#### Progress Calculation
```javascript
const progressPercentage = Math.min(
  Math.round((processedUrls.size / maxUrlsToProcess) * 90),
  90
);
// Jumps to 100% on completion
```

#### Real-time Updates
- Updates every processed URL
- Shows current processing URL
- Displays queue size
- Activity log with timestamps

## User Interface & Experience

### 1. Layout Structure
- **Header**: Title, attribution, API credit
- **Main Content**:
  - URL input with validation
  - Configuration options (collapsible)
  - Process button with loading state
  - Help text (hides during processing)
  - Progress indicator
  - Activity log (collapsible, auto-scroll)
  - Results section with stats

### 2. Visual Design

#### Color Palette
- Primary: Blue gradient (#1d4ed8 → #2563eb)
- Success: Green (#22c55e)
- Error: Red with proper contrast
- Background: Slate gradient (#f8fafc → #f1f5f9)
- Dark mode support with appropriate color variants

#### Interactive Elements
- **Popover UI**: Click "This document parser supports a list of selected websites" to view all 69 sites
  - Organized by category with scrollable content
  - Each site is clickable with example URLs
  - "Open an Issue on GitHub!" link at bottom
- Button pulse on hover
- Loading spinner during processing
- Smooth transitions for collapsible sections
- Progress bar animation
- "rays" animation effect on header

### 3. Responsive Behavior
- Max width: 768px (3xl:max-w-3xl)
- Mobile-optimized with proper padding
- Touch-friendly interaction targets

### 4. Notification System

#### Implementation
```javascript
// iOS Detection and handling
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
              !window.MSStream;

if (!isIOS && 'Notification' in window) {
  // Request permission on first use
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  
  // Show notification with custom icon
  new Notification(title, {
    body: message,
    icon: '/icon-192.png',
    requireInteraction: false
  });
}
```

#### Features
- Auto-closes after 5 seconds
- Click to focus window
- Falls back to console on iOS
- Custom icon support

### 5. Activity Log

#### Smart Scrolling
```javascript
// Auto-scroll only if user hasn't scrolled up
const isNearBottom = container.scrollHeight - container.scrollTop 
                     <= container.clientHeight + 100;
if (isNearBottom) {
  container.scrollTop = container.scrollHeight;
}
```

#### Log Entry Format
```
[HH:MM:SS] Action description
```

## Implementation Details

### 1. State Management

```typescript
// Core state variables
const [url, setUrl] = useState('');
const [isProcessing, setIsProcessing] = useState(false);
const [progress, setProgress] = useState(0);
const [results, setResults] = useState<ProcessingResult[]>([]);
const [logs, setLogs] = useState<string[]>([]);
const [error, setError] = useState('');
const [depth, setDepth] = useState(PROCESSING_CONFIG.DEFAULT_CRAWL_DEPTH);
const [maxUrls, setMaxUrls] = useState(PROCESSING_CONFIG.DEFAULT_MAX_URLS);
const [filterUrls, setFilterUrls] = useState(true);
const [deduplicateContent, setDeduplicateContent] = useState(true);
const [filterAvailability, setFilterAvailability] = useState(true);
const [showWebsitesList, setShowWebsitesList] = useState(false);
const [showLogs, setShowLogs] = useState(false);
const [showOptions, setShowOptions] = useState(false);
```

### 2. Error Handling

- **Invalid URLs**: Immediate validation feedback
- **API Failures**: Graceful degradation with error messages
- **Network Issues**: Clear user communication
- **Empty Results**: Informative messaging
- **Cache Misses**: Transparent fallback to API

### 3. Performance Optimizations

- **Caching**: 30-day in-memory cache reduces API calls
- **Batch Processing**: Efficient URL queue management
- **Progress Debouncing**: Prevents UI thrashing
- **Set-based Deduplication**: O(1) lookup for processed URLs
- **Turbopack**: Fast development builds

## Security Considerations

1. **API Key Protection**: Server-side only, never exposed to client
2. **URL Validation**: Strict whitelist prevents arbitrary scraping
3. **Content Sanitization**: Handled by Firecrawl API
4. **No User Data Storage**: Stateless operation
5. **HTTPS Only**: All documentation sources require HTTPS

## Known Limitations

1. **Cache Persistence**: In-memory cache resets on deployment
2. **iOS Notifications**: Disabled due to Safari limitations
3. **Rate Limiting**: Subject to Firecrawl API limits
4. **Max URLs**: Hard limit of 1000 URLs per session
5. **Edge Runtime**: Some Node.js APIs unavailable
6. **Single-threaded**: Sequential URL processing

## Performance Metrics

- **Initial Load**: < 2 seconds
- **Per-URL Processing**: ~2-5 seconds (includes wait time)
- **Concurrent Processing**: 20 URLs in parallel (2x faster than v1)
- **Memory Usage**: Linear with processed URLs
- **Cache Hit Rate**: High for repeated documentation sections
- **Batch Delay**: 500ms between batches to prevent API overload

## Browser Support

- **Required**: ES6+, Async/Await, Fetch API
- **Tested**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Android
- **Features**: Responsive, PWA-capable

## API Specification

### POST /api/scrape

#### Request
```json
{
  "url": "https://developer.apple.com/documentation/appkit",
  "action": "scrape"
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "markdown": "# Content here..."
  },
  "cached": false
}
```

#### Response (Error)
```json
{
  "error": "Invalid URL. Must be from one of the 69 supported documentation sites"
}
```

## Future Enhancements

### Phase 1: Core Improvements
- Persistent cache using Redis/KV storage
- Concurrent URL processing
- Incremental content updates
- Resume interrupted sessions

### Phase 2: Advanced Features
- Custom cleaning rules per domain
- API endpoint for programmatic access
- CLI tool for batch processing
- Export to multiple formats (JSON, YAML)
- Content diffing between versions

### Phase 3: Integration & Scale
- Direct AI assistant integrations
- Team collaboration features
- Usage analytics and insights
- Self-hosted deployment option
- Plugin system for custom processors

## Usage Guidelines

### For Best Results

1. **Start with overview pages** rather than deep API references
2. **Use appropriate crawl depth** (2-3 for most cases)
3. **Enable all cleaning options** for AI consumption
4. **Store files with descriptive names** in your project
5. **Reference by filename** in AI assistant prompts
6. **Check the popover** to ensure your documentation site is supported

### Common Use Cases

1. **Framework Updates**: Get latest React, Vue, Angular, or SwiftUI changes
2. **Language References**: Document Python, TypeScript, Rust, or Go APIs
3. **Cloud Documentation**: Capture AWS, GCP, or Azure service docs
4. **Database Guides**: Convert PostgreSQL, MongoDB, or Redis documentation
5. **AI/ML Libraries**: Document PyTorch, TensorFlow, or Hugging Face APIs
6. **DevOps Tools**: Capture Docker, Kubernetes, or Terraform guides
7. **Third-party Packages**: Document any package from supported platforms
8. **Project Documentation**: Convert GitHub Pages docs for AI training

## Development Notes

### Local Development
```bash
npm install
npm run dev
# Visit http://localhost:3000

# Run tests
npm test
npm run test:ui
npm run test:coverage
```

### Environment Setup
```bash
# Required
FIRECRAWL_API_KEY=your_api_key_here
```

### Deployment
- Vercel recommended for Edge Runtime support
- Set environment variables in deployment platform
- No additional configuration required

## Attribution

Created by [@steipete](https://twitter.com/steipete) | Powered by [Firecrawl](https://firecrawl.dev)

## Testing Suite

### Test Coverage
The project includes comprehensive test coverage using Vitest:
- **API Route Tests**: Full coverage of scraping endpoint
- **Utility Tests**: All content processing functions tested
- **URL Validation**: Tests for all 69 supported domains
- **File Generation**: Download and filename generation tests
- **Error Handling**: Edge cases and failure scenarios

### Running Tests
```bash
# Run all tests
npm test

# Interactive test UI
npm run test:ui  

# Coverage report
npm run test:coverage

# Type checking
npm run type-check
```

---

*This specification reflects the complete implementation as of the latest commit, supporting 69 documentation sites across 10 categories.*