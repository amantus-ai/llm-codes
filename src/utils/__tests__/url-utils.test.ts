import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidDocumentationUrl,
  getSupportedDomainsText,
  extractUrlFromQueryString,
  updateUrlWithDocumentation,
  generateFilename,
} from '../url-utils';

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

    it('should validate Swift Package Index URLs', () => {
      expect(
        isValidDocumentationUrl(
          'https://swiftpackageindex.com/pointfreeco/swift-composable-architecture'
        )
      ).toBe(true);
      expect(isValidDocumentationUrl('https://swiftpackageindex.com/vapor/vapor')).toBe(true);
    });

    it('should validate GitHub Pages URLs', () => {
      expect(
        isValidDocumentationUrl('https://pointfreeco.github.io/swift-composable-architecture/')
      ).toBe(true);
      expect(isValidDocumentationUrl('https://vapor-community.github.io/vapor-websocket/')).toBe(
        true
      );
    });

    it('should reject invalid URLs', () => {
      expect(isValidDocumentationUrl('')).toBe(false);
      expect(isValidDocumentationUrl('https://github.com/user/repo')).toBe(false);
      expect(isValidDocumentationUrl('https://google.com')).toBe(false);
      expect(isValidDocumentationUrl('not-a-url')).toBe(false);
    });
  });

  describe('getSupportedDomainsText', () => {
    it('should return formatted domain count', () => {
      expect(getSupportedDomainsText()).toBe('70 supported documentation sites');
    });
  });

  describe('extractUrlFromQueryString', () => {
    it('should extract URL from query string', () => {
      expect(extractUrlFromQueryString('https://developer.apple.com/documentation/swiftui')).toBe(
        'https://developer.apple.com/documentation/swiftui'
      );
      // Test URL-encoded input - should decode and return the URL
      const encoded = encodeURIComponent('https://developer.apple.com/documentation/swiftui');
      expect(extractUrlFromQueryString(encoded)).toBe(
        'https://developer.apple.com/documentation/swiftui'
      );
    });

    it('should return null for non-URL query strings', () => {
      expect(extractUrlFromQueryString('')).toBe(null);
      expect(extractUrlFromQueryString('random-string')).toBe(null);
      expect(extractUrlFromQueryString('key=value')).toBe(null);
    });
  });

  describe('updateUrlWithDocumentation', () => {
    beforeEach(() => {
      window.history.replaceState = vi.fn();
      window.location.pathname = '/';
    });

    it('should update browser URL with documentation URL', () => {
      const url = 'https://developer.apple.com/documentation/swiftui';
      updateUrlWithDocumentation(url);

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        `/?${encodeURIComponent(url)}`
      );
    });

    it('should not update URL if empty', () => {
      updateUrlWithDocumentation('');
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('generateFilename', () => {
    it('should generate Apple Developer filenames', () => {
      expect(generateFilename('https://developer.apple.com/documentation/swiftui')).toBe(
        'apple-developer-documentation-swiftui-docs.md'
      );
      expect(generateFilename('https://developer.apple.com/documentation/uikit/uiview')).toBe(
        'apple-developer-documentation-uikit-docs.md'
      );
      expect(generateFilename('https://developer.apple.com/documentation/')).toBe(
        'apple-developer-documentation-docs.md'
      );
    });

    it('should generate Swift Package Index filenames', () => {
      expect(
        generateFilename('https://swiftpackageindex.com/pointfreeco/swift-composable-architecture')
      ).toBe('swift-package-index-pointfreeco-swift-composable-architecture-docs.md');
      expect(generateFilename('https://swiftpackageindex.com/vapor/vapor')).toBe(
        'swift-package-index-vapor-vapor-docs.md'
      );
      expect(generateFilename('https://swiftpackageindex.com/')).toBe(
        'swift-package-index-docs.md'
      );
    });

    it('should generate GitHub Pages filenames', () => {
      expect(generateFilename('https://pointfreeco.github.io/swift-composable-architecture/')).toBe(
        'github-pages----github-io--swift-composable-architecture-docs.md'
      );
      expect(
        generateFilename(
          'https://pointfreeco.github.io/swift-composable-architecture/documentation/composablearchitecture'
        )
      ).toBe('github-pages----github-io--swift-composable-architecture-documentation-docs.md');
      expect(generateFilename('https://example.github.io/')).toBe(
        'github-pages----github-io--docs.md'
      );
    });

    it('should handle invalid URLs gracefully', () => {
      expect(generateFilename('not-a-url')).toBe('documentation.md');
      expect(generateFilename('')).toBe('documentation.md');
    });

    it('should handle other domains', () => {
      expect(generateFilename('https://example.com/docs/api')).toBe('example-com-docs-docs.md');
      expect(generateFilename('https://example.com/')).toBe('example-com-docs.md');
    });
  });
});
