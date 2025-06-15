// Domain configuration
export const ALLOWED_DOMAINS = {
  // Original domains
  APPLE: {
    pattern: 'https://developer.apple.com',
    name: 'Apple Developer',
    example: 'https://developer.apple.com/documentation',
    category: 'Mobile Development',
  },
  SWIFT_PACKAGE_INDEX: {
    pattern: 'https://swiftpackageindex.com/',
    name: 'Swift Package Index',
    example: 'https://swiftpackageindex.com',
    category: 'Programming Languages',
  },
  GITHUB_PAGES: {
    pattern: /^https:\/\/[^\/]+\.github\.io\//,
    name: 'GitHub Pages (*.github.io)',
    example: 'https://pointfreeco.github.io/swift-composable-architecture/',
    category: 'General',
  },

  // Programming Languages
  PYTHON: {
    pattern: 'https://docs.python.org',
    name: 'Python',
    example: 'https://docs.python.org',
    category: 'Programming Languages',
  },
  MDN: {
    pattern: 'https://developer.mozilla.org',
    name: 'MDN Web Docs',
    example: 'https://developer.mozilla.org',
    category: 'Programming Languages',
  },
  TYPESCRIPT: {
    pattern: 'https://www.typescriptlang.org/docs',
    name: 'TypeScript',
    example: 'https://www.typescriptlang.org/docs',
    category: 'Programming Languages',
  },
  RUST: {
    pattern: 'https://doc.rust-lang.org',
    name: 'Rust',
    example: 'https://doc.rust-lang.org',
    category: 'Programming Languages',
  },
  GOLANG: {
    pattern: 'https://golang.org/doc',
    name: 'Go',
    example: 'https://golang.org/doc',
    category: 'Programming Languages',
  },
  JAVA: {
    pattern: 'https://docs.oracle.com/javase',
    name: 'Java',
    example: 'https://docs.oracle.com/javase',
    category: 'Programming Languages',
  },
  RUBY: {
    pattern: 'https://ruby-doc.org',
    name: 'Ruby',
    example: 'https://ruby-doc.org',
    category: 'Programming Languages',
  },
  PHP: {
    pattern: 'https://www.php.net/docs.php',
    name: 'PHP',
    example: 'https://www.php.net/docs.php',
    category: 'Programming Languages',
  },
  SWIFT: {
    pattern: 'https://docs.swift.org',
    name: 'Swift',
    example: 'https://docs.swift.org',
    category: 'Programming Languages',
  },
  KOTLIN: {
    pattern: 'https://kotlinlang.org/docs',
    name: 'Kotlin',
    example: 'https://kotlinlang.org/docs',
    category: 'Programming Languages',
  },

  // Web Frameworks
  REACT: {
    pattern: 'https://react.dev',
    name: 'React',
    example: 'https://react.dev/learn',
    category: 'Web Frameworks',
  },
  VUE: {
    pattern: 'https://vuejs.org',
    name: 'Vue.js',
    example: 'https://vuejs.org/guide',
    category: 'Web Frameworks',
  },
  ANGULAR: {
    pattern: 'https://angular.io/docs',
    name: 'Angular',
    example: 'https://angular.io/docs',
    category: 'Web Frameworks',
  },
  NEXTJS: {
    pattern: 'https://nextjs.org/docs',
    name: 'Next.js',
    example: 'https://nextjs.org/docs',
    category: 'Web Frameworks',
  },
  NUXT: {
    pattern: 'https://nuxt.com/docs',
    name: 'Nuxt',
    example: 'https://nuxt.com/docs',
    category: 'Web Frameworks',
  },
  SVELTE: {
    pattern: 'https://svelte.dev/docs',
    name: 'Svelte',
    example: 'https://svelte.dev/docs',
    category: 'Web Frameworks',
  },
  DJANGO: {
    pattern: 'https://docs.djangoproject.com',
    name: 'Django',
    example: 'https://docs.djangoproject.com',
    category: 'Web Frameworks',
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
  CHAKRA: {
    pattern: 'https://chakra-ui.com/docs',
    name: 'Chakra UI',
    example: 'https://chakra-ui.com/docs',
    category: 'CSS Frameworks',
  },

  // Build Tools & Package Managers
  NPM: {
    pattern: 'https://docs.npmjs.com',
    name: 'npm',
    example: 'https://docs.npmjs.com',
    category: 'Build Tools & Package Managers',
  },
  WEBPACK: {
    pattern: 'https://webpack.js.org/docs',
    name: 'webpack',
    example: 'https://webpack.js.org/docs',
    category: 'Build Tools & Package Managers',
  },
  VITE: {
    pattern: 'https://vitejs.dev/guide',
    name: 'Vite',
    example: 'https://vitejs.dev/guide',
    category: 'Build Tools & Package Managers',
  },
  PIP: {
    pattern: 'https://pip.pypa.io/en/stable',
    name: 'pip',
    example: 'https://pip.pypa.io/en/stable',
    category: 'Build Tools & Package Managers',
  },
  CARGO: {
    pattern: 'https://doc.rust-lang.org/cargo',
    name: 'Cargo',
    example: 'https://doc.rust-lang.org/cargo',
    category: 'Build Tools & Package Managers',
  },
  MAVEN: {
    pattern: 'https://maven.apache.org/guides',
    name: 'Maven',
    example: 'https://maven.apache.org/guides',
    category: 'Build Tools & Package Managers',
  },

  // Testing Frameworks
  JEST: {
    pattern: 'https://jestjs.io/docs',
    name: 'Jest',
    example: 'https://jestjs.io/docs',
    category: 'Testing Frameworks',
  },
  CYPRESS: {
    pattern: 'https://docs.cypress.io',
    name: 'Cypress',
    example: 'https://docs.cypress.io',
    category: 'Testing Frameworks',
  },
  PLAYWRIGHT: {
    pattern: 'https://playwright.dev/docs',
    name: 'Playwright',
    example: 'https://playwright.dev/docs',
    category: 'Testing Frameworks',
  },
  PYTEST: {
    pattern: 'https://docs.pytest.org',
    name: 'pytest',
    example: 'https://docs.pytest.org',
    category: 'Testing Frameworks',
  },
  MOCHA: {
    pattern: 'https://mochajs.org',
    name: 'Mocha',
    example: 'https://mochajs.org',
    category: 'Testing Frameworks',
  },

  // Mobile Development
  REACT_NATIVE: {
    pattern: 'https://reactnative.dev/docs',
    name: 'React Native',
    example: 'https://reactnative.dev/docs',
    category: 'Mobile Development',
  },
  FLUTTER: {
    pattern: 'https://flutter.dev/docs',
    name: 'Flutter',
    example: 'https://flutter.dev/docs',
    category: 'Mobile Development',
  },
  ANDROID: {
    pattern: 'https://developer.android.com/docs',
    name: 'Android',
    example: 'https://developer.android.com/docs',
    category: 'Mobile Development',
  },
} as const;

// Processing configuration
export const PROCESSING_CONFIG = {
  CACHE_DURATION: (30 * 24 * 60 * 60 * 1000) as number, // 1 month in ms
  FIRECRAWL_WAIT_TIME: 5000 as number, // Wait time for Firecrawl API in ms
  DEFAULT_CRAWL_DEPTH: 2 as number,
  DEFAULT_MAX_URLS: 200 as number,
  // Retry configuration
  MAX_RETRIES: 5 as number, // Maximum number of retry attempts
  INITIAL_RETRY_DELAY: 1000 as number, // Initial delay in ms (1 second)
  MAX_RETRY_DELAY: 30000 as number, // Maximum delay in ms (30 seconds)
  RETRY_STATUS_CODES: [429, 500, 502, 503, 504] as number[], // HTTP status codes that trigger retries
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
