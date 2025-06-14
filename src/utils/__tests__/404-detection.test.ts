import { describe, it, expect } from 'vitest';
import { is404Page } from '../content-processing';

describe('is404Page', () => {
  it('should detect common 404 page content', () => {
    expect(is404Page("The page you're looking for can't be found")).toBe(true);
    expect(is404Page('Page not found')).toBe(true);
    expect(is404Page('404 Not Found')).toBe(true);
    expect(is404Page("404 Error - This page doesn't exist")).toBe(true);
    expect(is404Page("We couldn't find that page")).toBe(true);
    expect(is404Page('The requested page could not be found')).toBe(true);
    expect(is404Page("Sorry, we can't find that page")).toBe(true);
    expect(is404Page("Oops! That page can't be found.")).toBe(true);
    expect(is404Page('The page you requested was not found')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(is404Page("THE PAGE YOU'RE LOOKING FOR CAN'T BE FOUND")).toBe(true);
    expect(is404Page('PAGE NOT FOUND')).toBe(true);
    expect(is404Page('pAgE nOt FoUnD')).toBe(true);
  });

  it('should detect 404 content within larger text', () => {
    const content = `
      # Documentation
      
      The page you're looking for can't be found.
      
      Please check the URL or go back to the home page.
    `;
    expect(is404Page(content)).toBe(true);
  });

  it('should not detect normal content as 404', () => {
    expect(is404Page('This is a normal documentation page')).toBe(false);
    expect(is404Page('Welcome to the API documentation')).toBe(false);
    expect(is404Page('# FoundationModels\n\nThis framework provides...')).toBe(false);
  });

  it('should handle empty or null content', () => {
    expect(is404Page('')).toBe(false);
    expect(is404Page(null as unknown as string)).toBe(false);
    expect(is404Page(undefined as unknown as string)).toBe(false);
  });

  it('should detect real-world Apple 404 pages', () => {
    const apple404 = `
      # Not Found
      
      The page you're looking for can't be found.
      
      Check that you entered the correct URL or try searching Apple Developer.
    `;
    expect(is404Page(apple404)).toBe(true);
  });
});
