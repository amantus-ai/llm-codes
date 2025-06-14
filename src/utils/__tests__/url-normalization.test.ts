import { normalizeUrl } from '../url-utils';

describe('normalizeUrl', () => {
  it('should remove hash fragments', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/page#app-main')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/page/#overview')).toBe('https://example.com/page');
  });

  it('should remove query parameters', () => {
    expect(normalizeUrl('https://example.com/page?param=value')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/page?foo=bar&baz=qux')).toBe(
      'https://example.com/page'
    );
  });

  it('should remove both hash and query parameters', () => {
    expect(normalizeUrl('https://example.com/page?param=value#section')).toBe(
      'https://example.com/page'
    );
    expect(normalizeUrl('https://example.com/page#section?param=value')).toBe(
      'https://example.com/page'
    );
  });

  it('should remove trailing slashes except for root', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should handle complex URLs', () => {
    expect(
      normalizeUrl('https://developer.apple.com/documentation/foundationmodels#app-main')
    ).toBe('https://developer.apple.com/documentation/foundationmodels');

    expect(
      normalizeUrl('https://developer.apple.com/documentation/foundationmodels/#overview')
    ).toBe('https://developer.apple.com/documentation/foundationmodels');

    expect(
      normalizeUrl('https://developer.apple.com/documentation/systemlanguagemodel/#mentions')
    ).toBe('https://developer.apple.com/documentation/systemlanguagemodel');
  });

  it('should return the same URL if already normalized', () => {
    expect(normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    expect(normalizeUrl('')).toBe('');
  });
});
