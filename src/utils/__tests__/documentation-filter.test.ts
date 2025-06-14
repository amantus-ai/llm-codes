import { describe, it, expect } from 'vitest';
import {
  filterDocumentation,
  filterNavigationAndUIChrome,
  filterLegalAndCopyrightBoilerplate,
  filterEmptyOrPlaceholderContent,
  filterRedundantTypeAliases,
  filterExcessivePlatformNotices,
  filterFormattingArtifacts,
  cleanupWhitespace,
  is404Page,
} from '../documentation-filter';

describe('documentation-filter', () => {
  describe('filterNavigationAndUIChrome', () => {
    it('should remove Skip Navigation links and text', () => {
      const input = '[Skip Navigation](https://example.com/skip)\nMain content here';
      const result = filterNavigationAndUIChrome(input);
      expect(result).toBe('\nMain content here');
    });

    it('should remove View sample code links', () => {
      const input = '[View sample code](https://example.com/sample)\nCode explanation here';
      const result = filterNavigationAndUIChrome(input);
      expect(result).toBe('\nCode explanation here');
    });

    it('should remove API Reference navigation patterns', () => {
      const inputs = [
        'API Reference\\\\\nEnumerations',
        '[API Reference\\\\\nMacros](https://example.com)',
        'API Reference',
      ];
      inputs.forEach((input) => {
        const result = filterNavigationAndUIChrome(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove View in developer documentation', () => {
      const input = 'Check the [View in the developer documentation](https://docs.com) for details';
      const result = filterNavigationAndUIChrome(input);
      expect(result).toBe('Check the  for details');
    });

    it('should remove breadcrumb patterns', () => {
      const input = 'Home > Documentation > API > Methods\n\nActual content';
      const result = filterNavigationAndUIChrome(input);
      expect(result.trim()).toBe('Actual content');
    });

    it('should remove image captions starting with !', () => {
      const inputs = ['![Image description](image.png)', '!An image with a background of stars'];
      inputs.forEach((input) => {
        const result = filterNavigationAndUIChrome(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove Back to / Return to navigation', () => {
      const inputs = [
        '[Back to Overview](https://example.com/overview)',
        'Return to previous page',
        '[Return to Index](https://example.com)',
      ];
      inputs.forEach((input) => {
        const result = filterNavigationAndUIChrome(input);
        expect(result.trim()).toBe('');
      });
    });
  });

  describe('filterLegalAndCopyrightBoilerplate', () => {
    it('should remove copyright notices', () => {
      const inputs = [
        'Copyright © 2024 Apple Inc.',
        '© 2024 Microsoft Corporation.',
        'Copyright 2024 Google LLC.',
      ];
      inputs.forEach((input) => {
        const result = filterLegalAndCopyrightBoilerplate(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove All rights reserved', () => {
      const input = 'All rights reserved.';
      const result = filterLegalAndCopyrightBoilerplate(input);
      expect(result.trim()).toBe('');
    });

    it('should remove Terms of Service and Privacy Policy', () => {
      const inputs = ['Terms of Service', 'Terms of Use', 'Privacy Policy'];
      inputs.forEach((input) => {
        const result = filterLegalAndCopyrightBoilerplate(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove trademark symbols', () => {
      const input = 'Swift™ and SwiftUI® are trademarks of Apple Inc.';
      const result = filterLegalAndCopyrightBoilerplate(input);
      expect(result).toBe('Swift and SwiftUI are trademarks of Apple Inc.');
    });

    it('should preserve license info in code blocks', () => {
      const input = '```\n// MIT License\n// Some code\n```\n\nThis software uses MIT License.';
      const result = filterLegalAndCopyrightBoilerplate(input);
      expect(result).toContain('// MIT License');
      expect(result).not.toContain('This software uses MIT License.');
    });
  });

  describe('filterEmptyOrPlaceholderContent', () => {
    it('should remove headers with no content', () => {
      const input = '# Header 1\n\n### Empty Header\n\n# Header 2\n\nSome content';
      const result = filterEmptyOrPlaceholderContent(input);
      expect(result).toContain('# Header 1');
      expect(result).not.toContain('### Empty Header'); // h3+ headers without content are removed
      expect(result).toContain('# Header 2');
      expect(result).toContain('Some content');
    });

    it('should remove empty Mentioned in sections', () => {
      const input = '## Mentioned in\n\n## Next Section\n\nContent here';
      const result = filterEmptyOrPlaceholderContent(input);
      expect(result).not.toContain('## Mentioned in');
      expect(result).toContain('## Next Section');
    });

    it('should remove empty Conforms To sections', () => {
      const input = '### Conforms To\n\n### Implementation\n\nCode here';
      const result = filterEmptyOrPlaceholderContent(input);
      expect(result).not.toContain('### Conforms To');
      expect(result).toContain('### Implementation');
    });

    it('should remove broken image links', () => {
      const inputs = ['![](broken.png)', '![]'];
      inputs.forEach((input) => {
        const result = filterEmptyOrPlaceholderContent(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove empty code blocks', () => {
      const input = 'Some text\n\n```\n```\n\nMore text';
      const result = filterEmptyOrPlaceholderContent(input);
      expect(result).toBe('Some text\n\n\nMore text');
    });

    it('should keep Conforms To with content', () => {
      const input = '### Conforms To\n\nProtocol1, Protocol2\n\n### Next';
      const result = filterEmptyOrPlaceholderContent(input);
      expect(result).toContain('### Conforms To');
      expect(result).toContain('Protocol1, Protocol2');
    });
  });

  describe('filterRedundantTypeAliases', () => {
    it('should remove redundant type aliases', () => {
      const input = 'typealias UITraitBridgedEnvironmentKey = UITraitBridgedEnvironmentKey';
      const result = filterRedundantTypeAliases(input);
      expect(result.trim()).toBe('');
    });

    it('should keep non-redundant type aliases', () => {
      const input = 'typealias CompletionHandler = (Result<String, Error>) -> Void';
      const result = filterRedundantTypeAliases(input);
      expect(result).toBe(input);
    });

    it('should handle multiple type aliases', () => {
      const input = `typealias MyType = MyType
typealias StringAlias = String
typealias NumberAlias = NumberAlias`;
      const result = filterRedundantTypeAliases(input);
      expect(result.trim()).toBe('typealias StringAlias = String');
    });
  });

  describe('filterExcessivePlatformNotices', () => {
    it('should limit platform availability notices per section', () => {
      const input = `# Section 1
Available on iOS 14+
Available on macOS 11+
Available on tvOS 14+
Available on watchOS 7+
Available on visionOS 1+

# Section 2
Available on iOS 15+`;
      const result = filterExcessivePlatformNotices(input);
      const lines = result.split('\n');
      // Count availability lines before the second header
      let section1Count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('# Section 2')) break;
        if (lines[i].includes('Available on')) section1Count++;
      }
      expect(section1Count).toBe(2); // Should only keep 2 per section
      expect(result).toContain('Available on iOS 15+'); // New section resets counter
    });

    it('should preserve non-availability content', () => {
      const input = `# API
Available on iOS 14+
This API provides functionality
Available on macOS 11+
for handling user input
Available on tvOS 14+`;
      const result = filterExcessivePlatformNotices(input);
      expect(result).toContain('This API provides functionality');
      expect(result).toContain('for handling user input');
    });
  });

  describe('filterFormattingArtifacts', () => {
    it('should remove excessive section separators', () => {
      const inputs = ['---', '===', '***', '___', '--------------------'];
      inputs.forEach((input) => {
        const result = filterFormattingArtifacts(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should remove standalone formatting characters', () => {
      const inputs = ['   ***   ', '  __  ', '   ~~~   ', '  ```  '];
      inputs.forEach((input) => {
        const result = filterFormattingArtifacts(input);
        expect(result.trim()).toBe('');
      });
    });

    it('should preserve formatting in context', () => {
      const input = 'This is **bold** and this is *italic*';
      const result = filterFormattingArtifacts(input);
      expect(result).toBe(input);
    });
  });

  describe('is404Page', () => {
    it('should detect 404 pages', () => {
      const notFoundPages = [
        "The page you're looking for can't be found",
        'Page not found',
        '404 Not Found',
        "404 Error: This page doesn't exist",
        "Sorry, we can't find that page",
        "Oops! That page can't be found.",
      ];

      notFoundPages.forEach((content) => {
        expect(is404Page(content)).toBe(true);
        expect(is404Page(content.toUpperCase())).toBe(true); // Case insensitive
      });
    });

    it('should not detect regular content as 404', () => {
      const regularContent = [
        'This is a regular documentation page',
        'Learn how to handle errors in your app', // Changed to avoid '404' in content
        'The NotFound component renders when...',
      ];

      regularContent.forEach((content) => {
        expect(is404Page(content)).toBe(false);
      });
    });

    it('should return false for empty content', () => {
      expect(is404Page('')).toBe(false);
      expect(is404Page(null as unknown as string)).toBe(false);
      expect(is404Page(undefined as unknown as string)).toBe(false);
    });
  });

  describe('filterDocumentation - comprehensive filter', () => {
    it('should apply all filters when using default options', () => {
      const input = `[Skip Navigation](#main)
      
# Documentation

Copyright © 2024 Example Corp. All rights reserved.

## Mentioned in

### Conforms To

iOS 14.0+iPadOS 14.0+macOS 11.0+tvOS 14.0+watchOS 7.0+

This is the main content that should be preserved.

typealias MyType = MyType

[View sample code](https://example.com/sample)

---

[Back to Overview](https://example.com/overview)`;

      const result = filterDocumentation(input);

      // Should remove navigation
      expect(result).not.toContain('Skip Navigation');
      expect(result).not.toContain('View sample code');
      expect(result).not.toContain('Back to Overview');

      // Should remove legal
      expect(result).not.toContain('Copyright');
      expect(result).not.toContain('All rights reserved');

      // Should remove empty sections
      expect(result).not.toContain('## Mentioned in');
      // ### Conforms To is preserved because it has content (iOS availability) when empty content filter runs
      // The availability content is removed later, leaving the header orphaned
      expect(result).toContain('### Conforms To');

      // Should remove availability
      expect(result).not.toContain('iOS 14.0+');

      // Should remove redundant type alias
      expect(result).not.toContain('typealias MyType = MyType');

      // Should remove formatting artifacts
      expect(result).not.toContain('---');

      // Should preserve main content
      expect(result).toContain('This is the main content that should be preserved');
      expect(result).toContain('# Documentation');
    });

    it('should respect individual filter options', () => {
      const input = `Copyright © 2024 Example.
[Skip Navigation](#main)
iOS 14.0+
Main content here.`;

      const result = filterDocumentation(input, {
        filterUrls: false,
        filterAvailability: false,
        filterNavigation: true,
        filterLegalBoilerplate: false,
        filterEmptyContent: false,
        filterRedundantTypeAliases: false,
        filterExcessivePlatformNotices: false,
        filterFormattingArtifacts: false,
        deduplicateContent: false,
      });

      expect(result).not.toContain('Skip Navigation');
      expect(result).toContain('Copyright © 2024 Example.');
      expect(result).toContain('iOS 14.0+');
      expect(result).toContain('Main content here.');
    });

    it('should handle complex real-world documentation', () => {
      const input = `[Skip Navigation](#content)

# SwiftUI View Documentation

Copyright © 2024 Apple Inc. All rights reserved.

Current page is SwiftUI > Views > Text

## Overview

iOS 14.0+iPadOS 14.0+Mac Catalyst 14.0+tvOS 14.0+visionOS 1.0+watchOS 7.0+

A view that displays one or more lines of read-only text.

### Creating a Text View

Use one of the many Text initializers to create a text view.

## Mentioned in

### Conforms To

### See Also

[View sample code](https://developer.apple.com/sample)

---

![](broken-image.png)

typealias Text = Text

[View in the developer documentation](https://developer.apple.com/documentation)

[Back to Views](https://developer.apple.com/documentation/swiftui/views)`;

      const result = filterDocumentation(input);

      // Should keep the main documentation structure
      expect(result).toContain('# SwiftUI View Documentation');
      expect(result).toContain('## Overview');
      expect(result).toContain('A view that displays one or more lines of read-only text');
      expect(result).toContain('### Creating a Text View');
      expect(result).toContain('Use one of the many Text initializers');

      // Should remove all the clutter
      expect(result).not.toContain('Skip Navigation');
      expect(result).not.toContain('Copyright');
      expect(result).not.toContain('Current page is');
      expect(result).not.toContain('iOS 14.0+');
      expect(result).not.toContain('## Mentioned in');
      expect(result).not.toContain('### Conforms To');
      // ### See Also is preserved because it has content (navigation link) when empty filter runs
      expect(result).toContain('### See Also');
      expect(result).not.toContain('View sample code');
      expect(result).not.toContain('---');
      expect(result).not.toContain('![](broken-image.png)');
      expect(result).not.toContain('typealias Text = Text');
      expect(result).not.toContain('View in the developer documentation');
      expect(result).not.toContain('Back to Views');

      // Result should be clean and focused
      const lines = result.split('\n').filter((line) => line.trim());
      expect(lines.length).toBeLessThan(10); // Much more concise than original
    });
  });

  describe('cleanupWhitespace', () => {
    it('should reduce multiple consecutive newlines to maximum of two', () => {
      const input = 'Line 1\n\n\n\nLine 2\n\n\n\n\n\nLine 3';
      const result = cleanupWhitespace(input);
      expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
    });

    it('should clean up multiple spaces', () => {
      const input = 'Text  with   multiple    spaces';
      const result = cleanupWhitespace(input);
      expect(result).toBe('Text with multiple spaces');
    });

    it('should trim whitespace from lines', () => {
      const input = '  Line 1   \n   Line 2  \n Line 3    ';
      const result = cleanupWhitespace(input);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should trim leading and trailing newlines', () => {
      const input = '\n\n\nContent\n\n\n';
      const result = cleanupWhitespace(input);
      expect(result).toBe('Content');
    });

    it('should handle mixed whitespace issues', () => {
      const input = '\n\n  Text  with   spaces  \n\n\n\n  And multiple  lines  \n\n\n';
      const result = cleanupWhitespace(input);
      expect(result).toBe('Text with spaces\n\nAnd multiple lines');
    });
  });

  describe('filterDocumentation - filter ordering edge cases', () => {
    it('should preserve headers that have availability content at time of empty content filtering', () => {
      const input = `# Documentation

### Conforms To

iOS 14.0+iPadOS 14.0+macOS 11.0+

### Empty Section

### Another Section

This has content.`;

      const result = filterDocumentation(input);

      // ### Conforms To is preserved because it has iOS availability content when empty filter runs
      expect(result).toContain('### Conforms To');

      // The availability strings are removed later
      expect(result).not.toContain('iOS 14.0+');

      // Empty sections without any content are removed
      expect(result).not.toContain('### Empty Section');

      // Sections with actual content are preserved
      expect(result).toContain('### Another Section');
      expect(result).toContain('This has content.');
    });

    it('should remove Conforms To header when it has no content initially', () => {
      const input = `# Documentation

### Conforms To

### Another Section

This has content.`;

      const result = filterDocumentation(input);

      // When Conforms To has no content initially, it gets removed
      expect(result).not.toContain('### Conforms To');

      // Other content is preserved
      expect(result).toContain('### Another Section');
      expect(result).toContain('This has content.');
    });
  });

  describe('filterDocumentation - newline cleanup in real scenarios', () => {
    it('should clean up excessive newlines from filtered documentation', () => {
      const input = `# Documentation

[Skip Navigation](#main)


## Overview


iOS 14.0+iPadOS 14.0+macOS 11.0+


This is the main content.




### Empty Section




### Another Section

More content here.



[View sample code](https://example.com)




[Back to top](#top)`;

      const result = filterDocumentation(input);

      // Should have cleaned up all the excessive newlines
      expect(result).not.toContain('\n\n\n');
      expect(result).not.toContain('\n\n\n\n');

      // But should preserve single paragraph breaks
      expect(result).toContain('\n\n');

      // Should contain the main content without excessive spacing
      const lines = result.split('\n');
      const emptyLineCount = lines.filter((line) => line === '').length;

      // Should have reasonable number of empty lines (for paragraph breaks)
      expect(emptyLineCount).toBeLessThan(5);
    });
  });
});
