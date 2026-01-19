import { describe, it, expect } from 'vitest';
import { isUrlDisabled, getHostname } from '../../../src/utils/url';

describe('url utilities', () => {
  describe('getHostname', () => {
    it('should extract hostname from valid URL', () => {
      expect(getHostname('https://example.com/path')).toBe('example.com');
    });

    it('should extract hostname with subdomain', () => {
      expect(getHostname('https://sub.example.com/path')).toBe('sub.example.com');
    });

    it('should extract hostname with port', () => {
      expect(getHostname('https://example.com:8080/path')).toBe('example.com');
    });

    it('should return empty string for invalid URL', () => {
      expect(getHostname('not-a-url')).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(getHostname('')).toBe('');
    });
  });

  describe('isUrlDisabled', () => {
    it('should return false for empty inputs', () => {
      expect(isUrlDisabled('', [])).toBe(false);
      expect(isUrlDisabled('https://example.com', [])).toBe(false);
    });

    it('should return true for exact domain match', () => {
      expect(isUrlDisabled('https://example.com/path', ['example.com'])).toBe(true);
    });

    it('should return true when parent domain is disabled', () => {
      expect(isUrlDisabled('https://sub.example.com/path', ['example.com'])).toBe(true);
    });

    it('should return true for deeply nested subdomain when parent is disabled', () => {
      expect(isUrlDisabled('https://a.b.c.example.com/path', ['example.com'])).toBe(true);
    });

    it('should return false when only subdomain is disabled', () => {
      // If sub.example.com is disabled, example.com should NOT be disabled
      expect(isUrlDisabled('https://example.com/path', ['sub.example.com'])).toBe(false);
    });

    it('should return false for unrelated domain', () => {
      expect(isUrlDisabled('https://other.com/path', ['example.com'])).toBe(false);
    });

    // Note: Browser-specific protocols (about:, chrome:, moz-extension:) are tested
    // in browser environment. In Node.js, URL parsing for these protocols may differ.
    // The function returns true for these protocols in Firefox to disable extension on special pages.

    it('should return false for invalid URL', () => {
      expect(isUrlDisabled('not-a-url', ['example.com'])).toBe(false);
    });

    it('should handle multiple disabled domains', () => {
      const disabled = ['example.com', 'test.org', 'foo.bar'];
      expect(isUrlDisabled('https://example.com', disabled)).toBe(true);
      expect(isUrlDisabled('https://test.org', disabled)).toBe(true);
      expect(isUrlDisabled('https://other.com', disabled)).toBe(false);
    });
  });
});
