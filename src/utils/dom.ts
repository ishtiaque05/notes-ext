/**
 * DOM utilities for Notes Collector extension
 */

/**
 * Escapes HTML characters to prevent XSS
 * @param text The text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Checks if an element is a link or an image
 * @param element The element to check
 * @returns true if the element is capturable
 */
export function isCapturableElement(element: HTMLElement): boolean {
  if (!element) return false;
  if (element.tagName === 'IMG' || element.closest('img')) return true;
  if (element.tagName === 'A' || element.closest('a')) return true;
  return false;
}
