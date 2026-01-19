/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  isPlaceholderImage,
  findBestImage,
  getTextContent,
} from '../../../src/content/elementFinder';

describe('elementFinder', () => {
  describe('isPlaceholderImage', () => {
    it('should return true for aria-hidden images', () => {
      const img = document.createElement('img');
      img.setAttribute('aria-hidden', 'true');
      img.src = 'https://example.com/img.png';

      expect(isPlaceholderImage(img)).toBe(true);
    });

    it('should return true for SVG data URL images', () => {
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml,<svg></svg>';

      expect(isPlaceholderImage(img)).toBe(true);
    });

    it('should return true for incomplete/broken images', () => {
      const img = document.createElement('img');
      img.src = 'https://example.com/img.png';
      // In JSDOM, images don't load, so naturalWidth/Height are 0
      // and complete is true after src is set
      Object.defineProperty(img, 'complete', { value: true });
      Object.defineProperty(img, 'naturalWidth', { value: 0 });
      Object.defineProperty(img, 'naturalHeight', { value: 0 });

      expect(isPlaceholderImage(img)).toBe(true);
    });

    it('should return false for valid images', () => {
      const img = document.createElement('img');
      img.src = 'https://example.com/real-image.png';
      // Mock a valid loaded image
      Object.defineProperty(img, 'complete', { value: true });
      Object.defineProperty(img, 'naturalWidth', { value: 100 });
      Object.defineProperty(img, 'naturalHeight', { value: 100 });

      expect(isPlaceholderImage(img)).toBe(false);
    });
  });

  describe('findBestImage', () => {
    it('should return null for null input', () => {
      expect(findBestImage(null)).toBeNull();
    });

    it('should return the image if element is an IMG', () => {
      const img = document.createElement('img');
      img.src = 'https://example.com/img.png';
      Object.defineProperty(img, 'naturalWidth', { value: 100 });
      Object.defineProperty(img, 'naturalHeight', { value: 100 });

      const result = findBestImage(img);
      expect(result).toBe(img);
    });

    it('should find image inside container', () => {
      const div = document.createElement('div');
      const img = document.createElement('img');
      img.src = 'https://example.com/img.png';
      Object.defineProperty(img, 'naturalWidth', { value: 100 });
      Object.defineProperty(img, 'naturalHeight', { value: 100 });
      div.appendChild(img);

      const result = findBestImage(div);
      expect(result).toBe(img);
    });

    it('should return null when no images found', () => {
      const div = document.createElement('div');
      div.textContent = 'No images here';

      const result = findBestImage(div);
      expect(result).toBeNull();
    });

    it('should prefer image with alt text', () => {
      const div = document.createElement('div');
      const img1 = document.createElement('img');
      img1.src = 'https://example.com/img1.png';

      const img2 = document.createElement('img');
      img2.src = 'https://example.com/img2.png';
      img2.alt = 'Description';

      div.appendChild(img1);
      div.appendChild(img2);

      // Both have same base score, but img2 has alt text bonus
      const result = findBestImage(div);
      expect(result).toBe(img2);
    });

    it('should avoid placeholder images', () => {
      const div = document.createElement('div');

      // Placeholder image
      const placeholder = document.createElement('img');
      placeholder.src = 'data:image/svg+xml,<svg></svg>';

      // Real image
      const realImg = document.createElement('img');
      realImg.src = 'https://example.com/real.png';
      Object.defineProperty(realImg, 'naturalWidth', { value: 100 });
      Object.defineProperty(realImg, 'naturalHeight', { value: 100 });

      div.appendChild(placeholder);
      div.appendChild(realImg);

      const result = findBestImage(div);
      expect(result).toBe(realImg);
    });
  });

  describe('getTextContent', () => {
    it('should return text content of element', () => {
      const div = document.createElement('div');
      div.textContent = 'Hello World';

      expect(getTextContent(div)).toBe('Hello World');
    });

    it('should return null for very short text', () => {
      const div = document.createElement('div');
      div.textContent = 'Hi';

      expect(getTextContent(div)).toBeNull();
    });

    it('should return null for empty element', () => {
      const div = document.createElement('div');

      expect(getTextContent(div)).toBeNull();
    });

    it('should trim whitespace', () => {
      const div = document.createElement('div');
      div.textContent = '   Trimmed content   ';

      expect(getTextContent(div)).toBe('Trimmed content');
    });

    it('should truncate very long text to 10000 chars', () => {
      const div = document.createElement('div');
      div.textContent = 'a'.repeat(15000);

      const result = getTextContent(div);
      expect(result).toHaveLength(10000);
    });

    it('should return null for whitespace-only content', () => {
      const div = document.createElement('div');
      div.textContent = '   \n\t   ';

      expect(getTextContent(div)).toBeNull();
    });
  });
});
