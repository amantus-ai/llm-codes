# Contributing to Apple Docs to Markdown

Thank you for your interest in contributing to Apple Docs to Markdown! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate in all interactions.

## How to Contribute

### Reporting Issues

- Check if the issue already exists
- Use the issue template when creating new issues
- Provide clear descriptions and steps to reproduce
- Include system information when relevant

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass
6. Commit with clear messages (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Setup

1. Clone your fork:

```bash
git clone https://github.com/yourusername/apple-docs-to-markdown.git
cd apple-docs-to-markdown
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local`:

```bash
cp .env.local.example .env.local
# Add your Firecrawl API key
```

4. Run development server:

```bash
npm run dev
```

### Coding Standards

- Use TypeScript strict mode
- Follow existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing

Run tests before submitting:

```bash
npm test
```

### Commit Messages

Follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

Example: `feat: add export to PDF functionality`

## Questions?

Feel free to open an issue for any questions or join our discussions.
