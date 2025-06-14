import { describe, it, expect } from 'vitest';
import {
  filterUrlsFromMarkdown,
  removeCommonPhrases,
  filterAvailabilityStrings,
  deduplicateMarkdown,
  extractLinks,
} from '../content-processing';

describe('content-processing', () => {
  describe('filterUrlsFromMarkdown', () => {
    it('should remove markdown links when filtering is enabled', () => {
      const input = 'Check out [this link](https://example.com) for more info.';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('Check out this link for more info.');
    });

    it('should remove bare URLs when filtering is enabled', () => {
      const input = 'Visit https://example.com for details.';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('Visit for details.');
    });

    it('should remove angle bracket URLs when filtering is enabled', () => {
      const input = 'See <https://example.com> for reference.';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('See for reference.');
    });

    it('should not filter URLs when filtering is disabled', () => {
      const input = 'Check [this](https://example.com) and https://example.com';
      const result = filterUrlsFromMarkdown(input, false);
      expect(result).toBe(input);
    });

    it('should clean up extra spaces', () => {
      const input = 'Text    with     multiple    spaces';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('Text with multiple spaces');
    });

    it('should handle URLs with parentheses correctly', () => {
      const input =
        'Check out [this method](https://developer.apple.com/documentation/foundationmodels/tool/call(arguments:)) for details.';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('Check out this method for details.');
    });

    it('should handle multiple URLs with parentheses', () => {
      const input =
        'See [method1](https://example.com/api/function(param1:param2:)) and [method2](https://example.com/api/init()).';
      const result = filterUrlsFromMarkdown(input, true);
      expect(result).toBe('See method1 and method2.');
    });
  });

  describe('removeCommonPhrases', () => {
    it('should remove Skip Navigation links', () => {
      const input = '[Skip Navigation](https://example.com/skip)\nMain content here';
      const result = removeCommonPhrases(input);
      expect(result).toBe('Main content here');
    });

    it('should remove API Reference patterns', () => {
      const input = 'API Reference\\\\\nEnumerations\n\nOther content';
      const result = removeCommonPhrases(input);
      expect(result).toBe('Other content');
    });

    it('should remove Current page is pattern', () => {
      const input = 'Current page is SwiftUI Documentation\n\nActual content';
      const result = removeCommonPhrases(input);
      expect(result).toBe('Actual content');
    });

    it('should clean up multiple empty lines', () => {
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = removeCommonPhrases(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });
  });

  describe('filterAvailabilityStrings', () => {
    it('should remove availability strings when enabled', () => {
      const input = 'iOS 14.0+iPadOS 14.0+Mac Catalyst 14.0+tvOS 14.0+visionOS 1.0+watchOS 7.0+';
      const result = filterAvailabilityStrings(input, true);
      expect(result).toBe('');
    });

    it('should remove beta availability strings', () => {
      const input = 'iOS 17.0+Beta iPadOS 17.0+Beta macOS 14.0+Beta';
      const result = filterAvailabilityStrings(input, true);
      expect(result).toBe('');
    });

    it('should not filter when disabled', () => {
      const input = 'iOS 14.0+ This is available on iOS 14';
      const result = filterAvailabilityStrings(input, false);
      expect(result).toBe(input);
    });

    it('should preserve content after availability strings', () => {
      const input = 'iOS 14.0+ This feature requires iOS 14 or later';
      const result = filterAvailabilityStrings(input, true);
      expect(result.trim()).toBe('This feature requires iOS 14 or later');
    });
  });

  describe('deduplicateMarkdown', () => {
    it('should remove duplicate paragraphs when enabled', () => {
      const input = 'This is a paragraph.\n\nThis is another paragraph.\n\nThis is a paragraph.';
      const result = deduplicateMarkdown(input, true);
      // The result might have trailing newlines due to cleanup
      expect(result.trim()).toBe('This is a paragraph.\n\nThis is another paragraph.');
    });

    it('should preserve headers even if duplicate', () => {
      const input = '# Header\n\nContent 1\n\n# Header\n\nContent 2';
      const result = deduplicateMarkdown(input, true);
      expect(result).toContain('Content 1');
      expect(result).toContain('Content 2');
    });

    it('should not deduplicate when disabled', () => {
      const input = 'Duplicate\n\nDuplicate';
      const result = deduplicateMarkdown(input, false);
      expect(result).toBe(input);
    });

    it('should handle empty lines correctly', () => {
      const input = 'Paragraph 1\n\n\nParagraph 2\n\n\n\nParagraph 3';
      const result = deduplicateMarkdown(input, true);
      expect(result).toBe('Paragraph 1\n\nParagraph 2\n\nParagraph 3');
    });
  });

  describe('extractLinks', () => {
    const baseUrl = 'https://developer.apple.com/documentation/swiftui';

    it('should extract markdown links', () => {
      const input = 'See [SwiftUI Views](https://developer.apple.com/documentation/swiftui/views)';
      const links = extractLinks(input, baseUrl);
      expect(links).toContain('https://developer.apple.com/documentation/swiftui/views');
    });

    it('should extract HTML links', () => {
      const input = '<a href="https://developer.apple.com/documentation/swiftui/text">Text</a>';
      const links = extractLinks(input, baseUrl);
      expect(links).toContain('https://developer.apple.com/documentation/swiftui/text');
    });

    it('should extract plain URLs', () => {
      const input = 'Visit https://developer.apple.com/documentation/swiftui/button for more';
      const links = extractLinks(input, baseUrl);
      expect(links).toContain('https://developer.apple.com/documentation/swiftui/button');
    });

    it('should filter out non-documentation URLs for Apple', () => {
      const input = `
        [Docs](https://developer.apple.com/documentation/swiftui/view)
        [Download](https://developer.apple.com/download)
        [Search](https://developer.apple.com/search?q=swiftui)
      `;
      const links = extractLinks(input, baseUrl);
      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://developer.apple.com/documentation/swiftui/view');
    });

    it('should filter out different domain URLs', () => {
      const input = `
        [Apple](https://developer.apple.com/documentation/uikit)
        [Google](https://google.com)
        [GitHub](https://github.com/apple/swift)
      `;
      const links = extractLinks(input, baseUrl);
      expect(links).toHaveLength(1);
      expect(links[0]).toBe('https://developer.apple.com/documentation/uikit');
    });

    it('should be less restrictive for non-Apple sites', () => {
      const baseUrlGitHub = 'https://pointfreeco.github.io/swift-composable-architecture';
      const input = `
        [Home](https://pointfreeco.github.io/swift-composable-architecture)
        [Docs](https://pointfreeco.github.io/swift-composable-architecture/docs)
        [Examples](https://pointfreeco.github.io/swift-composable-architecture/examples)
      `;
      const links = extractLinks(input, baseUrlGitHub);
      expect(links).toHaveLength(3);
    });

    it('should clean up URLs with trailing punctuation', () => {
      const input = 'See https://developer.apple.com/documentation/swiftui/view.';
      const links = extractLinks(input, baseUrl);
      expect(links).toContain('https://developer.apple.com/documentation/swiftui/view');
      expect(links).not.toContain('https://developer.apple.com/documentation/swiftui/view.');
    });
  });
});
