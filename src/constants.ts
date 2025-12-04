// Domain configuration with pattern-based matching
export const DOCUMENTATION_PATTERNS = [
  {
    pattern:
      /^https:\/\/(docs?|developers?|dev|learn|help|api|guide|wiki|devcenter)\.[^\/]+\.[^\/]+\//,
    name: 'Documentation Subdomains',
    description: 'Matches documentation subdomains like docs.*, developer.*, learn.*, etc.',
    examples: ['docs.python.org', 'developer.apple.com', 'learn.microsoft.com', 'docs.cypress.io'],
  },
  {
    pattern:
      /^https:\/\/([^\/]+\.)?[^\/]+\/(docs?|documentation|api[-_]?docs?|guides?|learn|help|stable|latest)(\/|$)/,
    name: 'Documentation Paths',
    description: 'Matches URLs with documentation paths like /docs, /guide, /learn, etc.',
    examples: ['angular.io/docs', 'redis.io/docs', 'www.elastic.co/guide', 'react.dev/learn'],
  },
  {
    pattern: /^https:\/\/[^\/]+(js|lang|py|-doc)\.(org|com)(\/|$)/,
    name: 'Programming Language Sites',
    description: 'Matches programming language documentation sites',
    examples: ['vuejs.org', 'kotlinlang.org', 'ruby-doc.org', 'expressjs.com'],
  },
  {
    pattern: /^https:\/\/[^\/]+\.github\.io\//,
    name: 'GitHub Pages',
    description: 'Matches any GitHub Pages site (*.github.io)',
    examples: ['username.github.io', 'project.github.io'],
  },
];

// Explicit exceptions that don't match our patterns
export const ALLOWED_EXCEPTIONS = {
  SWIFT_PACKAGE_INDEX: {
    pattern: 'https://swiftpackageindex.com/',
    name: 'Swift Package Index',
    example: 'https://swiftpackageindex.com',
    category: 'Programming Languages',
  },
  FLASK: {
    pattern: 'https://flask.palletsprojects.com',
    name: 'Flask',
    example: 'https://flask.palletsprojects.com',
    category: 'Web Frameworks',
  },
  MUI: {
    pattern: 'https://mui.com/material-ui',
    name: 'Material-UI',
    example: 'https://mui.com/material-ui',
    category: 'CSS Frameworks',
  },
  PIP: {
    pattern: 'https://pip.pypa.io/en/stable',
    name: 'pip',
    example: 'https://pip.pypa.io/en/stable',
    category: 'Build Tools & Package Managers',
  },
  PHP: {
    pattern: 'https://www.php.net/docs.php',
    name: 'PHP',
    example: 'https://www.php.net/docs.php',
    category: 'Programming Languages',
  },
  TAURI: {
    pattern: 'https://tauri.app/',
    name: 'Tauri',
    example: 'https://tauri.app/',
    category: 'Desktop Frameworks',
  },
} as const;

// Legacy support for specific domains that need special handling
export const SPECIAL_DOMAINS = {
  APPLE: {
    pattern: 'https://developer.apple.com',
    name: 'Apple Developer',
  },
  SWIFT_PACKAGE_INDEX: {
    pattern: 'https://swiftpackageindex.com/',
    name: 'Swift Package Index',
  },
} as const;

// Processing configuration
export const PROCESSING_CONFIG = {
  // Cache configuration
  CACHE_DURATION: (30 * 24 * 60 * 60 * 1000) as number, // 1 month in ms
  LOCAL_CACHE_TTL: (5 * 60 * 1000) as number, // 5 minutes for L1 cache
  COMPRESSION_THRESHOLD: 5000 as number, // Compress content larger than 5KB

  // Firecrawl API configuration
  FIRECRAWL_WAIT_TIME: 30000 as number, // Wait time for Firecrawl API in ms (30 seconds)
  FIRECRAWL_TIMEOUT: 60000 as number, // Timeout for Firecrawl API calls (60s)
  FETCH_TIMEOUT: 90000 as number, // Timeout for fetch requests (90s)

  // Crawling configuration
  DEFAULT_CRAWL_DEPTH: 2 as number,
  DEFAULT_MAX_URLS: 200 as number,
  MAX_CRAWL_DEPTH: 5 as number, // Hard limit for crawl depth
  MAX_ALLOWED_URLS: 2000 as number, // Hard limit for max pages
  CONCURRENT_LIMIT: 10 as number, // Increased to 10 for better performance

  // Retry configuration
  MAX_RETRIES: 5 as number, // Maximum number of retry attempts
  INITIAL_RETRY_DELAY: 1000 as number, // Initial delay in ms (1 second)
  MAX_RETRY_DELAY: 30000 as number, // Maximum delay in ms (30 seconds)
  RETRY_STATUS_CODES: [429, 500, 502, 503, 504] as number[], // HTTP status codes that trigger retries

  // Content validation
  MIN_CONTENT_LENGTH: 200 as number, // Minimum valid content length
};

// UI configuration
export const UI_CONFIG = {
  LOG_SCROLL_THRESHOLD: 10, // Pixels from bottom to consider "at bottom"
  PROGRESS_UPDATE_INTERVAL: 100, // Update progress every N processed URLs
} as const;

// File configuration
export const FILE_CONFIG = {
  DEFAULT_FILENAME: 'documentation.md',
  APPLE_DEFAULT_FILENAME: 'apple-docs.md',
  SWIFT_PACKAGE_DEFAULT_FILENAME: 'swift-package-docs.md',
} as const;
