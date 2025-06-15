import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scrapeWithProgressiveTimeout,
  createCustomConfig,
  DEFAULT_PROGRESSIVE_CONFIG,
} from '../progressive-timeout';

describe('progressive timeout', () => {
  let mockScrapeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockScrapeFn = vi.fn();
  });

  describe('scrapeWithProgressiveTimeout', () => {
    it('should succeed on first attempt with good content', async () => {
      const goodContent =
        `# Documentation\n\nThis is a comprehensive guide with lots of content...`.padEnd(
          1000,
          '.'
        );

      mockScrapeFn.mockResolvedValueOnce({
        success: true,
        markdown: goodContent,
        data: { content: goodContent },
      });

      const result = await scrapeWithProgressiveTimeout(
        mockScrapeFn,
        'https://example.com/docs',
        DEFAULT_PROGRESSIVE_CONFIG
      );

      expect(result.attemptCount).toBe(1);
      expect(result.data.markdown).toBe(goodContent);
      expect(mockScrapeFn).toHaveBeenCalledTimes(1);
      expect(mockScrapeFn).toHaveBeenCalledWith('https://example.com/docs', {
        formats: ['markdown'],
        waitFor: 5000,
        timeout: 10,
        removeBase64Images: true,
        skipTlsVerification: false,
      });
    });

    it('should retry with increased timeout on loading content', async () => {
      const loadingContent = 'Loading...';
      const goodContent =
        `# Documentation\n\nThis is a comprehensive guide with lots of content...`.padEnd(
          1000,
          '.'
        );

      mockScrapeFn
        .mockResolvedValueOnce({
          success: true,
          markdown: loadingContent,
          data: { content: loadingContent },
        })
        .mockResolvedValueOnce({
          success: true,
          markdown: goodContent,
          data: { content: goodContent },
        });

      const result = await scrapeWithProgressiveTimeout(
        mockScrapeFn,
        'https://example.com/docs',
        DEFAULT_PROGRESSIVE_CONFIG
      );

      expect(result.attemptCount).toBe(2);
      expect(result.data.markdown).toBe(goodContent);
      expect(mockScrapeFn).toHaveBeenCalledTimes(2);

      // First call with initial timeout
      expect(mockScrapeFn).toHaveBeenNthCalledWith(1, 'https://example.com/docs', {
        formats: ['markdown'],
        waitFor: 5000,
        timeout: 10,
        removeBase64Images: true,
        skipTlsVerification: false,
      });

      // Second call with increased timeout
      expect(mockScrapeFn).toHaveBeenNthCalledWith(2, 'https://example.com/docs', {
        formats: ['markdown'],
        waitFor: 5000,
        timeout: 20,
        removeBase64Images: true,
        skipTlsVerification: false,
      });
    });

    it('should detect content readiness based on structure', async () => {
      const contents = [
        { content: 'Too short', ready: false },
        { content: 'Loading... please wait'.padEnd(600, '.'), ready: false },
        { content: '<div class="skeleton-loader">...</div>'.padEnd(600, '.'), ready: false },
        { content: '# Title\n\nParagraph content here...'.padEnd(600, '.'), ready: true },
        { content: '```javascript\ncode here\n```'.padEnd(600, '.'), ready: true },
      ];

      for (const { content, ready } of contents) {
        mockScrapeFn.mockClear();

        if (ready) {
          mockScrapeFn.mockResolvedValueOnce({
            success: true,
            markdown: content,
            data: { content },
          });
        } else {
          // Should retry on non-ready content
          const goodContent = '# Good content'.padEnd(1000, '.');
          mockScrapeFn
            .mockResolvedValueOnce({
              success: true,
              markdown: content,
              data: { content },
            })
            .mockResolvedValueOnce({
              success: true,
              markdown: goodContent,
              data: { content: goodContent },
            });
        }

        const result = await scrapeWithProgressiveTimeout(
          mockScrapeFn,
          'https://example.com/docs',
          DEFAULT_PROGRESSIVE_CONFIG
        );

        if (ready) {
          expect(result.attemptCount).toBe(1);
        } else {
          expect(result.attemptCount).toBeGreaterThan(1);
        }
      }
    });

    it('should throw after max retries', async () => {
      mockScrapeFn.mockRejectedValue(new Error('Progressive timeout after 10000ms'));

      const config = {
        ...DEFAULT_PROGRESSIVE_CONFIG,
        maxRetries: 2,
      };

      await expect(
        scrapeWithProgressiveTimeout(mockScrapeFn, 'https://example.com/docs', config)
      ).rejects.toThrow();

      expect(mockScrapeFn).toHaveBeenCalledTimes(2); // maxRetries = 2
    });
  });

  describe('createCustomConfig', () => {
    it('should create fast config for simple documentation', () => {
      const config = createCustomConfig('https://example.com/api/reference');

      expect(config.initialTimeout).toBe(5000);
      expect(config.maxTimeout).toBe(20000);
      expect(config.waitTime).toBe(2000);
      expect(config.maxRetries).toBe(2);
    });

    it('should create slower config for complex SPAs', () => {
      const config = createCustomConfig('https://react.dev/learn');

      expect(config.initialTimeout).toBe(15000);
      expect(config.maxTimeout).toBe(90000);
      expect(config.waitTime).toBe(10000);
      expect(config.maxRetries).toBe(4);
    });

    it('should use default config for general URLs', () => {
      const config = createCustomConfig('https://example.com/docs');

      expect(config).toEqual(DEFAULT_PROGRESSIVE_CONFIG);
    });

    it('should create fast config for markdown files', () => {
      const config = createCustomConfig('https://example.com/README.md');

      expect(config.initialTimeout).toBe(5000);
      expect(config.maxTimeout).toBe(20000);
    });
  });

  describe('timeout progression', () => {
    it('should increase timeout progressively', async () => {
      const timeouts: number[] = [];

      mockScrapeFn.mockImplementation(async (_url, options) => {
        timeouts.push(options.timeout);
        throw new Error('Progressive timeout after ' + options.timeout * 1000 + 'ms');
      });

      const config = {
        initialTimeout: 5000,
        maxTimeout: 20000,
        timeoutIncrement: 5000,
        waitTime: 1000,
        maxRetries: 4, // Need 4 retries to get [5, 10, 15, 20]
      };

      await expect(
        scrapeWithProgressiveTimeout(mockScrapeFn, 'https://example.com/docs', config)
      ).rejects.toThrow('Progressive timeout');

      expect(timeouts).toEqual([5, 10, 15, 20]);
    });
  });
});
