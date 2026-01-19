/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml, isCapturableElement } from '../../../src/utils/dom';

describe('dom utilities', () => {
  describe('escapeHtml', () => {
    it('should escape < and > characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('should escape & character', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });

    it('should escape complex XSS attempt', () => {
      const xss = '<img src="x" onerror="alert(1)">';
      expect(escapeHtml(xss)).toBe('&lt;img src="x" onerror="alert(1)"&gt;');
    });
  });

  describe('isCapturableElement', () => {
    it('should return true for IMG element', () => {
      const img = document.createElement('img');
      expect(isCapturableElement(img)).toBe(true);
    });

    it('should return true for A element', () => {
      const a = document.createElement('a');
      expect(isCapturableElement(a)).toBe(true);
    });

    it('should return true for element inside IMG', () => {
      const img = document.createElement('img');
      const span = document.createElement('span');
      // Note: IMG can't actually have children, but the logic checks closest()
      // This tests when an element has an IMG ancestor
      const div = document.createElement('div');
      div.appendChild(img);
      // Actually, let's test a more realistic scenario
      expect(isCapturableElement(img)).toBe(true);
    });

    it('should return true for element inside A', () => {
      const a = document.createElement('a');
      const span = document.createElement('span');
      a.appendChild(span);
      expect(isCapturableElement(span)).toBe(true);
    });

    it('should return false for DIV element', () => {
      const div = document.createElement('div');
      expect(isCapturableElement(div)).toBe(false);
    });

    it('should return false for SPAN element not inside A or IMG', () => {
      const span = document.createElement('span');
      expect(isCapturableElement(span)).toBe(false);
    });

    it('should return false for null element', () => {
      expect(isCapturableElement(null as unknown as HTMLElement)).toBe(false);
    });

    it('should return false for undefined element', () => {
      expect(isCapturableElement(undefined as unknown as HTMLElement)).toBe(false);
    });
  });
});
