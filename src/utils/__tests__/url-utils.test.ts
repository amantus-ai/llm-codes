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
    describe('Documentation Subdomain Pattern', () => {
      it('should validate docs.* subdomains', () => {
        expect(isValidDocumentationUrl('https://docs.python.org/')).toBe(true);
        expect(isValidDocumentationUrl('https://docs.python.org/3/tutorial/')).toBe(true);
        expect(isValidDocumentationUrl('https://docs.example.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://docs.foo.bar.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://docs.cypress.io/guides')).toBe(true);
      });

      it('should validate developer.* subdomains', () => {
        expect(isValidDocumentationUrl('https://developer.apple.com/documentation/swiftui')).toBe(
          true
        );
        expect(isValidDocumentationUrl('https://developer.mozilla.org/en-US/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://developer.android.com/guide')).toBe(true);
      });

      it('should validate other documentation subdomains', () => {
        expect(isValidDocumentationUrl('https://learn.microsoft.com/en-us/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://help.github.com/articles')).toBe(true);
        expect(isValidDocumentationUrl('https://api.example.com/reference')).toBe(true);
        expect(isValidDocumentationUrl('https://guide.meteor.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://wiki.archlinux.org/')).toBe(true);
        expect(isValidDocumentationUrl('https://devcenter.heroku.com/')).toBe(true);
      });

      it('should reject non-documentation subdomains', () => {
        expect(isValidDocumentationUrl('https://www.example.com/')).toBe(false);
        expect(isValidDocumentationUrl('https://blog.example.com/')).toBe(false);
        expect(isValidDocumentationUrl('https://shop.example.com/')).toBe(false);
      });
    });

    describe('Documentation Path Pattern', () => {
      it('should validate /docs paths', () => {
        expect(isValidDocumentationUrl('https://angular.io/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://redis.io/docs/getting-started')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://playwright.dev/docs/intro')).toBe(true);
      });

      it('should validate /documentation paths', () => {
        expect(isValidDocumentationUrl('https://example.com/documentation')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/documentation/v2')).toBe(true);
      });

      it('should validate /api-docs and /api_docs paths', () => {
        expect(isValidDocumentationUrl('https://example.com/api-docs')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/api_docs')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/apidocs')).toBe(true);
      });

      it('should validate /guide and /guides paths', () => {
        expect(isValidDocumentationUrl('https://vitejs.dev/guide/')).toBe(true);
        expect(isValidDocumentationUrl('https://maven.apache.org/guides/index.html')).toBe(true);
        expect(isValidDocumentationUrl('https://www.elastic.co/guide/index.html')).toBe(true);
      });

      it('should validate /learn and /help paths', () => {
        expect(isValidDocumentationUrl('https://react.dev/learn')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/help/getting-started')).toBe(true);
      });

      it('should validate /stable and /latest paths', () => {
        expect(isValidDocumentationUrl('https://scikit-learn.org/stable/')).toBe(true);
        expect(isValidDocumentationUrl('https://example.com/latest')).toBe(true);
      });

      it('should validate paths with www subdomain', () => {
        expect(isValidDocumentationUrl('https://www.elastic.co/guide')).toBe(true);
        expect(isValidDocumentationUrl('https://www.postgresql.org/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://www.terraform.io/docs')).toBe(true);
      });

      it('should reject non-documentation paths', () => {
        expect(isValidDocumentationUrl('https://example.com/blog')).toBe(false);
        expect(isValidDocumentationUrl('https://example.com/products')).toBe(false);
        expect(isValidDocumentationUrl('https://example.com/')).toBe(false);
      });
    });

    describe('Programming Language Sites Pattern', () => {
      it('should validate *js.org sites', () => {
        expect(isValidDocumentationUrl('https://vuejs.org/')).toBe(true);
        expect(isValidDocumentationUrl('https://expressjs.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://mochajs.org/')).toBe(true);
      });

      it('should validate *lang.org sites', () => {
        expect(isValidDocumentationUrl('https://kotlinlang.org/docs')).toBe(true);
        expect(isValidDocumentationUrl('https://golang.org/doc')).toBe(true);
      });

      it('should validate *-doc.org sites', () => {
        expect(isValidDocumentationUrl('https://ruby-doc.org/')).toBe(true);
        expect(isValidDocumentationUrl('https://example-doc.org/')).toBe(true);
      });

      it('should validate *py.org sites', () => {
        expect(isValidDocumentationUrl('https://numpy.org/doc')).toBe(true);
        expect(isValidDocumentationUrl('https://scipy.org/doc')).toBe(true);
      });

      it('should reject non-matching language sites', () => {
        expect(isValidDocumentationUrl('https://example.org/')).toBe(false);
        expect(isValidDocumentationUrl('https://random-site.com/')).toBe(false);
      });
    });

    describe('GitHub Pages Pattern', () => {
      it('should validate GitHub Pages URLs', () => {
        expect(
          isValidDocumentationUrl('https://pointfreeco.github.io/swift-composable-architecture/')
        ).toBe(true);
        expect(isValidDocumentationUrl('https://vapor-community.github.io/vapor-websocket/')).toBe(
          true
        );
        expect(isValidDocumentationUrl('https://username.github.io/')).toBe(true);
        expect(isValidDocumentationUrl('https://project.github.io/docs')).toBe(true);
      });

      it('should reject non-GitHub Pages URLs', () => {
        expect(isValidDocumentationUrl('https://github.com/user/repo')).toBe(false);
        expect(isValidDocumentationUrl('https://gitlab.io/project')).toBe(false);
      });
    });

    describe('Explicit Exceptions', () => {
      it('should validate Swift Package Index', () => {
        expect(isValidDocumentationUrl('https://swiftpackageindex.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://swiftpackageindex.com/vapor/vapor')).toBe(true);
      });

      it('should validate Flask', () => {
        expect(isValidDocumentationUrl('https://flask.palletsprojects.com/')).toBe(true);
        expect(isValidDocumentationUrl('https://flask.palletsprojects.com/en/latest/')).toBe(true);
      });

      it('should validate Material-UI', () => {
        expect(isValidDocumentationUrl('https://mui.com/material-ui/')).toBe(true);
        expect(isValidDocumentationUrl('https://mui.com/material-ui/getting-started/')).toBe(true);
      });

      it('should validate pip', () => {
        expect(isValidDocumentationUrl('https://pip.pypa.io/en/stable/')).toBe(true);
        expect(isValidDocumentationUrl('https://pip.pypa.io/en/stable/installation/')).toBe(true);
      });

      it('should validate PHP', () => {
        expect(isValidDocumentationUrl('https://www.php.net/docs.php')).toBe(true);
      });

      it('should validate Tauri', () => {
        expect(isValidDocumentationUrl('https://tauri.app/')).toBe(true);
        expect(isValidDocumentationUrl('https://tauri.app/v1/guides/')).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should reject empty URLs', () => {
        expect(isValidDocumentationUrl('')).toBe(false);
      });

      it('should reject invalid URLs', () => {
        expect(isValidDocumentationUrl('not-a-url')).toBe(false);
        expect(isValidDocumentationUrl('ftp://example.com/docs')).toBe(false);
        expect(isValidDocumentationUrl('http://docs.example.com/')).toBe(false);
      });

      it('should reject popular non-documentation sites', () => {
        expect(isValidDocumentationUrl('https://github.com/user/repo')).toBe(false);
        expect(isValidDocumentationUrl('https://google.com')).toBe(false);
        expect(isValidDocumentationUrl('https://stackoverflow.com')).toBe(false);
      });
    });
  });

  describe('getSupportedDomainsText', () => {
    it('should return the correct text', () => {
      expect(getSupportedDomainsText()).toBe('Most documentation pages are supported');
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
    it('should generate filenames for special domains', () => {
      expect(generateFilename('https://developer.apple.com/documentation/swiftui')).toBe(
        'apple-developer-documentation-swiftui-docs.md'
      );
      expect(generateFilename('https://swiftpackageindex.com/vapor/vapor')).toBe(
        'swift-package-index-vapor-vapor-docs.md'
      );
    });

    it('should generate filenames for exception domains', () => {
      expect(generateFilename('https://flask.palletsprojects.com/en/latest/')).toBe(
        'flask-en-latest-docs.md'
      );
      expect(generateFilename('https://mui.com/material-ui/getting-started/')).toBe(
        'material-ui-material-ui-getting-started-docs.md'
      );
      expect(generateFilename('https://pip.pypa.io/en/stable/installation/')).toBe(
        'pip-en-stable-docs.md'
      );
      expect(generateFilename('https://www.php.net/docs.php')).toBe('php-docs.php-docs.md');
    });

    it('should generate generic filenames for pattern-matched URLs', () => {
      expect(generateFilename('https://docs.python.org/3/tutorial/')).toBe(
        'docs-python-org-3-docs.md'
      );
      expect(generateFilename('https://angular.io/docs')).toBe('angular-io-docs-docs.md');
      expect(generateFilename('https://vuejs.org/guide/')).toBe('vuejs-org-guide-docs.md');
      expect(generateFilename('https://username.github.io/project/')).toBe(
        'username-github-io-project-docs.md'
      );
    });

    it('should handle invalid URLs gracefully', () => {
      expect(generateFilename('not-a-url')).toBe('documentation.md');
      expect(generateFilename('')).toBe('documentation.md');
    });

    it('should handle URLs without paths', () => {
      expect(generateFilename('https://example.com/')).toBe('example-com-docs.md');
      expect(generateFilename('https://docs.example.com/')).toBe('docs-example-com-docs.md');
    });
  });
});
