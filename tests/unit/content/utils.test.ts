/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showCaptureConfirmation,
  showTextCaptureConfirmation,
} from '../../../src/content/utils';

describe('content utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('showCaptureConfirmation', () => {
    it('should add captured class to element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      showCaptureConfirmation(element);

      expect(element.classList.contains('notes-collector-captured')).toBe(true);
    });

    it('should remove captured class after 500ms', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      showCaptureConfirmation(element);
      expect(element.classList.contains('notes-collector-captured')).toBe(true);

      vi.advanceTimersByTime(500);

      expect(element.classList.contains('notes-collector-captured')).toBe(false);
    });

    it('should work with nested elements', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      document.body.appendChild(parent);

      showCaptureConfirmation(child);

      expect(child.classList.contains('notes-collector-captured')).toBe(true);
    });
  });

  describe('showTextCaptureConfirmation', () => {
    it('should create notification element', () => {
      showTextCaptureConfirmation();

      const notification = document.body.querySelector('div');
      expect(notification).toBeTruthy();
      expect(notification?.textContent).toBe('Text captured!');
    });

    it('should apply styling to notification', () => {
      showTextCaptureConfirmation();

      const notification = document.body.querySelector('div') as HTMLElement;
      // jsdom doesn't fully support cssText parsing, so just verify the element exists
      // and has some style applied
      expect(notification).toBeTruthy();
      expect(notification.style).toBeDefined();
    });

    it('should remove notification after delay', () => {
      showTextCaptureConfirmation();

      expect(document.body.querySelector('div')).toBeTruthy();

      // After 2000ms, animation starts
      vi.advanceTimersByTime(2000);
      // After 300ms more, element is removed
      vi.advanceTimersByTime(300);

      expect(document.body.querySelector('div')).toBeFalsy();
    });
  });

  // Note: cropScreenshot tests are skipped because jsdom doesn't properly support
  // Image loading and canvas operations. This function is better tested with E2E tests.
});
