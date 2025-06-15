import { describe, it, expect, vi } from 'vitest';
import {
  BaseError,
  NetworkError,
  FirecrawlError,
  CacheError,
  ValidationError,
  CircuitBreakerError,
  ContentError,
  isNetworkError,
  isFirecrawlError,
  isCacheError,
  isValidationError,
  isCircuitBreakerError,
  isContentError,
  logError,
} from '../errors';

describe('Custom Error Classes', () => {
  describe('BaseError', () => {
    it('should create a base error with message and context', () => {
      const error = new BaseError('Test error', { userId: '123' });

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BaseError');
      expect(error.context).toEqual({ userId: '123' });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.stack).toBeDefined();
    });

    it('should serialize to JSON correctly', () => {
      const error = new BaseError('Test error', { key: 'value' });
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'BaseError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('context', { key: 'value' });
      expect(json).toHaveProperty('stack');
    });
  });

  describe('NetworkError', () => {
    it('should create a network error with status code and URL', () => {
      const error = new NetworkError('Network failed', 500, 'https://api.example.com');

      expect(error.message).toBe('Network failed');
      expect(error.name).toBe('NetworkError');
      expect(error.statusCode).toBe(500);
      expect(error.url).toBe('https://api.example.com');
    });

    it('should include network details in context', () => {
      const error = new NetworkError('Network failed', 404, 'https://api.example.com', {
        method: 'POST',
      });

      expect(error.context).toEqual({
        statusCode: 404,
        url: 'https://api.example.com',
        method: 'POST',
      });
    });
  });

  describe('FirecrawlError', () => {
    it('should create a Firecrawl error with API details', () => {
      const error = new FirecrawlError(
        'API request failed',
        429,
        'https://api.firecrawl.dev/scrape',
        'Rate limit exceeded',
        true
      );

      expect(error.message).toBe('API request failed');
      expect(error.name).toBe('FirecrawlError');
      expect(error.statusCode).toBe(429);
      expect(error.url).toBe('https://api.firecrawl.dev/scrape');
      expect(error.apiError).toBe('Rate limit exceeded');
      expect(error.retryable).toBe(true);
    });

    it('should default retryable to false', () => {
      const error = new FirecrawlError('API error', 400);
      expect(error.retryable).toBe(false);
    });
  });

  describe('CacheError', () => {
    it('should create a cache error with operation type', () => {
      const error = new CacheError('Cache operation failed', 'set', { key: 'test-key' });

      expect(error.message).toBe('Cache operation failed');
      expect(error.name).toBe('CacheError');
      expect(error.operation).toBe('set');
      expect(error.context).toEqual({ operation: 'set', key: 'test-key' });
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with field and value', () => {
      const error = new ValidationError('Invalid URL format', 'url', 'not-a-url');

      expect(error.message).toBe('Invalid URL format');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('url');
      expect(error.value).toBe('not-a-url');
    });

    it('should handle complex values', () => {
      const complexValue = { urls: ['url1', 'url2'], depth: -1 };
      const error = new ValidationError('Invalid configuration', 'config', complexValue);

      expect(error.value).toEqual(complexValue);
    });
  });

  describe('CircuitBreakerError', () => {
    it('should create a circuit breaker error', () => {
      const error = new CircuitBreakerError('Circuit breaker is open', 'open', 30000);

      expect(error.message).toBe('Circuit breaker is open');
      expect(error.name).toBe('CircuitBreakerError');
      expect(error.state).toBe('open');
      expect(error.cooldownRemaining).toBe(30000);
    });

    it('should handle half-open state', () => {
      const error = new CircuitBreakerError('Circuit breaker is half-open', 'half-open');

      expect(error.state).toBe('half-open');
      expect(error.cooldownRemaining).toBeUndefined();
    });
  });

  describe('ContentError', () => {
    it('should create a content error', () => {
      const error = new ContentError('Content too short', 82, true);

      expect(error.message).toBe('Content too short');
      expect(error.name).toBe('ContentError');
      expect(error.contentLength).toBe(82);
      expect(error.truncated).toBe(true);
    });

    it('should default truncated to false', () => {
      const error = new ContentError('Invalid content', 0);
      expect(error.truncated).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify error types', () => {
      const baseError = new BaseError('base');
      const networkError = new NetworkError('network', 500);
      const firecrawlError = new FirecrawlError('firecrawl', 429);
      const cacheError = new CacheError('cache', 'get');
      const validationError = new ValidationError('validation', 'field');
      const circuitBreakerError = new CircuitBreakerError('circuit', 'open');
      const contentError = new ContentError('content', 100);
      const regularError = new Error('regular');

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(firecrawlError)).toBe(true); // FirecrawlError extends NetworkError
      expect(isNetworkError(baseError)).toBe(false);

      expect(isFirecrawlError(firecrawlError)).toBe(true);
      expect(isFirecrawlError(networkError)).toBe(false);

      expect(isCacheError(cacheError)).toBe(true);
      expect(isCacheError(baseError)).toBe(false);

      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(regularError)).toBe(false);

      expect(isCircuitBreakerError(circuitBreakerError)).toBe(true);
      expect(isCircuitBreakerError(null)).toBe(false);

      expect(isContentError(contentError)).toBe(true);
      expect(isContentError(undefined)).toBe(false);
    });
  });

  describe('logError', () => {
    it('should log regular errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Regular error');

      logError(error, { requestId: '123' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          name: 'Error',
          message: 'Regular error',
          requestId: '123',
          timestamp: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log custom errors with full context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new FirecrawlError(
        'API failed',
        500,
        'https://api.example.com',
        'Server error',
        true
      );

      logError(error, { userId: 'user123' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          name: 'FirecrawlError',
          message: 'API failed',
          context: expect.objectContaining({
            statusCode: 500,
            url: 'https://api.example.com',
            apiError: 'Server error',
            retryable: true,
          }),
          userId: 'user123',
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
