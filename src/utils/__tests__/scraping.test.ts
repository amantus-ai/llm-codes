import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeUrl } from '../scraping';

// Mock fetch globally
global.fetch = vi.fn();

describe('scraping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scrapeUrl', () => {
    it('should successfully scrape a URL', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            markdown: '# Test Content\n\nThis is test content.',
          },
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await scrapeUrl('https://example.com');

      expect(global.fetch).toHaveBeenCalledWith('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', action: 'scrape' }),
      });

      expect(result).toBe('# Test Content\n\nThis is test content.');
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'Invalid URL',
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(scrapeUrl('https://invalid.com')).rejects.toThrow('Invalid URL');
    });

    it('should handle empty content', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            markdown: '',
          },
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await scrapeUrl('https://example.com');
      expect(result).toBe('');
    });

    it('should handle missing markdown field', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {},
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await scrapeUrl('https://example.com');
      expect(result).toBe('');
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(scrapeUrl('https://example.com')).rejects.toThrow('Network error');
    });

    it('should handle default error message', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          success: false,
        }),
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(scrapeUrl('https://example.com')).rejects.toThrow(
        'Scraping failed - unknown error'
      );
    });
  });
});
