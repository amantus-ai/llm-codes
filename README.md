# Apple Docs to Markdown

A modern web application that converts Apple Developer documentation to clean, readable Markdown format. Built with Next.js 15, Tailwind CSS v4, and TypeScript.

![Apple Docs to Markdown](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- 🚀 **Fast Processing**: Server-side API handling with intelligent caching
- 📊 **Configurable Crawling**: Set depth and maximum URLs to process
- 💾 **Smart Caching**: 1-month cache to reduce API calls and improve performance
- 🔔 **Browser Notifications**: Get notified when your documentation is ready
- 📱 **Responsive Design**: Works beautifully on desktop and mobile
- ⚡ **Turbopack**: Lightning-fast development with Next.js Turbopack
- 🎨 **Modern UI**: Sleek, professional interface with smooth animations
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
git clone https://github.com/yourusername/apple-docs-to-markdown.git
cd apple-docs-to-markdown
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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famantusai%2Fllm-tech&env=FIRECRAWL_API_KEY&envDescription=Your%20Firecrawl%20API%20key&envLink=https%3A%2F%2Ffirecrawl.dev)

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

1. **Enter URL**: Paste any Apple Developer documentation URL (must start with `https://developer.apple.com`)

2. **Configure Options**:
   - **Crawl Depth**: How deep to follow links (0 = main page only)
   - **Max URLs**: Maximum number of pages to process

3. **Process**: Click "Process Documentation" and grant notification permissions if prompted

4. **Download**: Once complete, download your clean Markdown file

## Configuration Options

| Option | Description | Default | Range |
|--------|-------------|---------|-------|
| Crawl Depth | How many levels deep to follow links | 1 | 0-5 |
| Max URLs | Maximum number of URLs to process | 50 | 1-1000 |

## API Reference

The app exposes a single API endpoint:

### POST `/api/scrape`

Scrapes and converts Apple Developer documentation to Markdown.

**Request Body:**
```json
{
  "url": "https://developer.apple.com/documentation/swift",
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
apple-docs-to-markdown/
├── src/
│   └── app/
│       ├── api/
│       │   └── scrape/
│       │       └── route.ts      # API endpoint
│       ├── globals.css           # Global styles & Tailwind
│       ├── layout.tsx            # Root layout
│       ├── page.tsx              # Main page component
│       └── icon.tsx              # Dynamic favicon
├── public/
│   └── favicon.svg               # Static favicon
├── next.config.js                # Next.js configuration
├── postcss.config.js             # PostCSS with Tailwind v4
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies
```

## Development

### Running Tests

```bash
npm test
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

## Acknowledgments

- Built with [Firecrawl](https://firecrawl.dev/) for powerful web scraping
- Inspired by the need for clean, readable Apple documentation
- Thanks to the Next.js and Tailwind CSS teams for amazing tools

## Support

If you find this project helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 💡 Suggesting new features
- 🤝 Contributing to the codebase

---

Made with ❤️ by developers, for developers.