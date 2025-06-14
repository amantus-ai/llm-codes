# LLM Codes

A powerful web application that converts technical documentation from 69+ major documentation sites into clean, AI-optimized Markdown format. Transform documentation from programming languages, frameworks, cloud platforms, databases, and more into LLM-friendly content. Built with Next.js 15, Tailwind CSS v4, and TypeScript.

![LLM Codes](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- 🌐 **69+ Supported Sites**: Documentation from major programming languages, frameworks, cloud platforms, and more
- 🚀 **Fast Parallel Processing**: Process up to 20 URLs concurrently for 2x faster results
- 📊 **Configurable Crawling**: Set depth (0-5) and maximum URLs (1-1000) to process
- 💾 **Smart Caching**: 30-day cache to reduce API calls and improve performance
- 🔔 **Browser Notifications**: Get notified when your documentation is ready
- 📱 **Responsive Design**: Works beautifully on desktop and mobile with interactive popover UI
- ⚡ **Turbopack**: Lightning-fast development with Next.js Turbopack
- 🎨 **Modern UI**: Sleek interface with categorized site browser and smooth animations
- 🧪 **Comprehensive Testing**: Full test suite with Vitest for reliability
- 🔒 **Secure**: API keys stored safely on server-side

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
FIRECRAWL_API_KEY=your_api_key_here
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
   - `FIRECRAWL_API_KEY`: Your Firecrawl API key
4. Deploy

## Usage

1. **Enter URL**: Paste any documentation URL from one of the 69 supported sites
   - Click on "This document parser supports a list of selected websites" to see all supported sites
   - Sites are organized by category for easy browsing

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

## Configuration Options

| Option | Description | Default | Range |
|--------|-------------|---------|-------|
| Crawl Depth | How many levels deep to follow links | 2 | 0-5 |
| Max URLs | Maximum number of URLs to process | 200 | 1-1000 |
| Batch Size | URLs processed concurrently | 20 | N/A |
| Cache Duration | How long results are cached | 30 days | N/A |

## API Reference

The app exposes a single API endpoint:

### POST `/api/scrape`

Scrapes and converts documentation from any of the 69 supported sites to Markdown.

**Request Body:**
```json
{
  "url": "https://react.dev/learn",
  "action": "scrape"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Swift Documentation\n\n..."
  },
  "cached": false
}
```

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **API**: [Firecrawl](https://firecrawl.dev/) for web scraping
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

## Development

### Running Tests

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

### Building for Production

```bash
npm run build
```

### Code Style

This project uses TypeScript strict mode and follows React best practices. 

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

The app includes a 1-month cache to minimize API calls. If you're hitting rate limits:
- Reduce crawl depth
- Lower maximum URLs
- Wait for cached results

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
- AWS, Google Cloud, Azure, DigitalOcean, Heroku, Vercel, Netlify

### Databases
- PostgreSQL, MongoDB, MySQL, Redis, Elasticsearch, Couchbase, Cassandra

### DevOps & Infrastructure
- Docker, Kubernetes, Terraform, Ansible, GitHub, GitLab

### AI/ML Libraries
- PyTorch, TensorFlow, Hugging Face, scikit-learn, LangChain, pandas, NumPy

### CSS Frameworks
- Tailwind CSS, Bootstrap, Material-UI, Chakra UI, Bulma

### Build Tools & Package Managers
- npm, webpack, Vite, pip, Cargo, Maven

### Testing Frameworks
- Jest, Cypress, Playwright, pytest, Mocha

### Mobile Development
- React Native, Flutter, Android, Apple Developer

## Missing a Site?

If you need support for a documentation site that's not listed, please [open an issue on GitHub](https://github.com/amantus-ai/llm-codes/issues)!

## Acknowledgments

- Built with [Firecrawl](https://firecrawl.dev/) for powerful web scraping
- Inspired by the need for clean, readable documentation across the entire development ecosystem
- Thanks to the Next.js and Tailwind CSS teams for amazing tools

## Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 💡 Suggesting new features
- 🤝 Contributing to the codebase

---

Made with ❤️ by developers, for developers.