// Domain configuration with pattern-based matching
export const DOCUMENTATION_PATTERNS = [
  {
    pattern:
      /^https:\/\/(docs?|developer|dev|learn|help|api|guide|wiki|devcenter)\.[^\/]+\.[^\/]+\//,
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
  EXPRESS: {
    pattern: 'https://expressjs.com',
    name: 'Express.js',
    example: 'https://expressjs.com',
    category: 'Web Frameworks',
  },
  LARAVEL: {
    pattern: 'https://laravel.com/docs',
    name: 'Laravel',
    example: 'https://laravel.com/docs',
    category: 'Web Frameworks',
  },
  VAPOR: {
    pattern: /^https:\/\/docs\.vapor\.codes\//,
    name: 'Vapor',
    example: 'https://docs.vapor.codes',
    category: 'Web Frameworks',
  },

  // Cloud Platforms
  AWS: {
    pattern: 'https://docs.aws.amazon.com',
    name: 'AWS',
    example: 'https://docs.aws.amazon.com',
    category: 'Cloud Platforms',
  },
  GCP: {
    pattern: 'https://cloud.google.com/docs',
    name: 'Google Cloud',
    example: 'https://cloud.google.com/docs',
    category: 'Cloud Platforms',
  },
  AZURE: {
    pattern: 'https://docs.microsoft.com/azure',
    name: 'Azure',
    example: 'https://docs.microsoft.com/azure',
    category: 'Cloud Platforms',
  },
  MICROSOFT_LEARN: {
    pattern: 'https://learn.microsoft.com',
    name: 'Microsoft Learn',
    example: 'https://learn.microsoft.com/en-us/docs',
    category: 'Cloud Platforms',
  },
  DIGITALOCEAN: {
    pattern: 'https://docs.digitalocean.com',
    name: 'DigitalOcean',
    example: 'https://docs.digitalocean.com',
    category: 'Cloud Platforms',
  },
  HEROKU: {
    pattern: 'https://devcenter.heroku.com',
    name: 'Heroku',
    example: 'https://devcenter.heroku.com',
    category: 'Cloud Platforms',
  },
  VERCEL: {
    pattern: 'https://vercel.com/docs',
    name: 'Vercel',
    example: 'https://vercel.com/docs',
    category: 'Cloud Platforms',
  },
  NETLIFY: {
    pattern: 'https://docs.netlify.com',
    name: 'Netlify',
    example: 'https://docs.netlify.com',
    category: 'Cloud Platforms',
  },
  SALESFORCE: {
    pattern: 'https://help.salesforce.com',
    name: 'Salesforce',
    example: 'https://help.salesforce.com',
    category: 'Cloud Platforms',
  },

  // Databases
  POSTGRESQL: {
    pattern: 'https://www.postgresql.org/docs',
    name: 'PostgreSQL',
    example: 'https://www.postgresql.org/docs',
    category: 'Databases',
  },
  MONGODB: {
    pattern: 'https://docs.mongodb.com',
    name: 'MongoDB',
    example: 'https://docs.mongodb.com',
    category: 'Databases',
  },
  MYSQL: {
    pattern: 'https://dev.mysql.com/doc',
    name: 'MySQL',
    example: 'https://dev.mysql.com/doc',
    category: 'Databases',
  },
  REDIS: {
    pattern: 'https://redis.io/docs',
    name: 'Redis',
    example: 'https://redis.io/docs',
    category: 'Databases',
  },
  ELASTICSEARCH: {
    pattern: 'https://www.elastic.co/guide',
    name: 'Elasticsearch',
    example: 'https://www.elastic.co/guide',
    category: 'Databases',
  },
  COUCHBASE: {
    pattern: 'https://docs.couchbase.com',
    name: 'Couchbase',
    example: 'https://docs.couchbase.com',
    category: 'Databases',
  },
  CASSANDRA: {
    pattern: 'https://cassandra.apache.org/doc',
    name: 'Cassandra',
    example: 'https://cassandra.apache.org/doc',
    category: 'Databases',
  },

  // DevOps & Infrastructure
  DOCKER: {
    pattern: 'https://docs.docker.com',
    name: 'Docker',
    example: 'https://docs.docker.com',
    category: 'DevOps & Infrastructure',
  },
  KUBERNETES: {
    pattern: 'https://kubernetes.io/docs',
    name: 'Kubernetes',
    example: 'https://kubernetes.io/docs',
    category: 'DevOps & Infrastructure',
  },
  TERRAFORM: {
    pattern: 'https://www.terraform.io/docs',
    name: 'Terraform',
    example: 'https://www.terraform.io/docs',
    category: 'DevOps & Infrastructure',
  },
  ANSIBLE: {
    pattern: 'https://docs.ansible.com',
    name: 'Ansible',
    example: 'https://docs.ansible.com',
    category: 'DevOps & Infrastructure',
  },
  GITHUB: {
    pattern: 'https://docs.github.com',
    name: 'GitHub',
    example: 'https://docs.github.com',
    category: 'DevOps & Infrastructure',
  },
  GITLAB: {
    pattern: 'https://docs.gitlab.com',
    name: 'GitLab',
    example: 'https://docs.gitlab.com',
    category: 'DevOps & Infrastructure',
  },

  // AI/ML Libraries
  PYTORCH: {
    pattern: 'https://pytorch.org/docs',
    name: 'PyTorch',
    example: 'https://pytorch.org/docs',
    category: 'AI/ML Libraries',
  },
  TENSORFLOW: {
    pattern: 'https://www.tensorflow.org/api_docs',
    name: 'TensorFlow',
    example: 'https://www.tensorflow.org/api_docs',
    category: 'AI/ML Libraries',
  },
  HUGGINGFACE: {
    pattern: 'https://huggingface.co/docs',
    name: 'Hugging Face',
    example: 'https://huggingface.co/docs',
    category: 'AI/ML Libraries',
  },
  SCIKIT_LEARN: {
    pattern: 'https://scikit-learn.org/stable',
    name: 'scikit-learn',
    example: 'https://scikit-learn.org/stable',
    category: 'AI/ML Libraries',
  },
  LANGCHAIN: {
    pattern: 'https://docs.langchain.com',
    name: 'LangChain',
    example: 'https://docs.langchain.com',
    category: 'AI/ML Libraries',
  },
  PANDAS: {
    pattern: 'https://pandas.pydata.org/docs',
    name: 'pandas',
    example: 'https://pandas.pydata.org/docs',
    category: 'AI/ML Libraries',
  },
  NUMPY: {
    pattern: 'https://numpy.org/doc',
    name: 'NumPy',
    example: 'https://numpy.org/doc',
    category: 'AI/ML Libraries',
  },
  MODULAR: {
    pattern: 'https://docs.modular.com',
    name: 'Modular',
    example: 'https://docs.modular.com',
    category: 'AI/ML Libraries',
  },

  // CSS Frameworks
  TAILWIND: {
    pattern: 'https://tailwindcss.com/docs',
    name: 'Tailwind CSS',
    example: 'https://tailwindcss.com/docs',
    category: 'CSS Frameworks',
  },
  BOOTSTRAP: {
    pattern: 'https://getbootstrap.com/docs',
    name: 'Bootstrap',
    example: 'https://getbootstrap.com/docs',
    category: 'CSS Frameworks',
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
  APPIUM: {
    pattern: 'https://appium.io/docs/en/latest',
    name: 'Appium',
    example: 'https://appium.io/docs/en/latest/#explore-the-documentation',
    category: 'Testing Frameworks',
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
