<!-- Generated: 2025-01-15 16:45:00 UTC -->

# Testing

The llm-codes project uses Vitest for comprehensive unit and integration testing, ensuring high code quality and reliability through 95%+ test coverage. Tests are organized by feature and follow consistent patterns for easy maintenance.

## Overview

Testing approach: Unit tests for utilities and components, integration tests for API routes, using Vitest with happy-dom for React testing and custom mocking for external dependencies. Configuration in **vitest.config.ts** (lines 5-17) sets up React plugin, happy-dom environment, and test globals.

## Test Types

**Unit Tests** - Utility functions and pure logic in **src/utils/__tests__/** directory
- URL validation and manipulation: **url-utils.test.ts** (145 lines)
- Content filtering: **documentation-filter.test.ts** (300+ lines)
- 404 detection: **404-detection.test.ts**
- URL normalization: **url-normalization.test.ts**

**Integration Tests** - API routes with mocked external dependencies
- Main scrape endpoint: **src/app/api/scrape/__tests__/route.test.ts** (303 lines)
- Batch processing: **src/app/api/scrape/batch/__tests__/route.test.ts**
- Redis cache: **src/lib/cache/__tests__/redis-cache.test.ts**

**Component Tests** - React components using Testing Library (when present)
- Setup with happy-dom environment for fast DOM testing
- Global test setup in **src/test/setup.ts** (lines 1-36)

## Running Tests

**Basic Commands**:
```bash
npm test              # Run all tests in watch mode
npm run test:ui       # Interactive UI mode for debugging
npm run test:coverage # Generate coverage report
```

**Test Environment Setup** - Global configuration in **src/test/setup.ts**:
```typescript
// From src/test/setup.ts:1-10
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    return props;
  },
}));
```

**Example Test Structure** from **src/utils/__tests__/url-utils.test.ts**:
```typescript
// From src/utils/__tests__/url-utils.test.ts:10-20
describe('url-utils', () => {
  describe('isValidDocumentationUrl', () => {
    it('should validate Apple Developer URLs', () => {
      expect(isValidDocumentationUrl('https://developer.apple.com/documentation/swiftui')).toBe(
        true
      );
      expect(
        isValidDocumentationUrl('https://developer.apple.com/documentation/uikit/uiview')
      ).toBe(true);
      expect(isValidDocumentationUrl('https://developer.apple.com')).toBe(true);
    });
```

## Reference

**Test File Organization**:
- **src/utils/__tests__/** - Utility function tests
- **src/app/api/scrape/__tests__/** - API route tests
- **src/lib/cache/__tests__/** - Cache implementation tests
- **src/test/setup.ts** - Global test configuration

**Testing Patterns**:

1. **Mocking External APIs** - Example from **route.test.ts** (lines 25-35):
```typescript
const mockFirecrawlResponse = {
  ok: true,
  json: vi.fn().mockResolvedValue({
    success: true,
    data: {
      markdown: '# Test Content\n\nThis is test content.',
    },
  }),
};
vi.mocked(global.fetch).mockResolvedValue(mockFirecrawlResponse as unknown as Response);
```

2. **Testing Retry Logic** with fake timers from **route.test.ts** (lines 153-214):
```typescript
// Use fake timers to speed up the test
vi.useFakeTimers();
// ... setup mocks ...
// Fast-forward through retry delays
for (let i = 0; i < 5; i++) {
  await vi.advanceTimersByTimeAsync(Math.min(1000 * Math.pow(2, i), 30000));
}
```

3. **Comprehensive Edge Case Testing** - **documentation-filter.test.ts** tests:
- Navigation removal patterns
- Legal boilerplate filtering
- Empty content detection
- Platform-specific content handling

**Coverage Configuration**:
- Target: 95%+ coverage maintained
- Coverage reports: Generated with `npm run test:coverage`
- Output location: **coverage/** directory

**Common Test Utilities**:
- `vi.fn()` - Mock functions
- `vi.mocked()` - Type-safe mocking
- `vi.useFakeTimers()` - Control time-based operations
- `describe/it/expect` - Test structure from Vitest globals

**Debugging Tests**:
- Use `npm run test:ui` for interactive debugging
- Add `.only` to focus on specific tests: `it.only('test name', ...)`
- Console logs appear in test output for debugging