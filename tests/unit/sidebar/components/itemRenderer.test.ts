/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createItemElement } from '../../../../src/sidebar/components/itemRenderer';
import { CapturedItem } from '../../../../src/types';

describe('itemRenderer', () => {
  const mockCallbacks = {
    onDelete: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    onDragEnter: vi.fn(),
    onDragLeave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createItemElement', () => {
    it('should create element for link item', () => {
      const item: CapturedItem = {
        id: 'link-1',
        type: 'link',
        content: 'https://example.com',
        metadata: {
          text: 'Example Link',
          href: 'https://example.com',
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      expect(element.tagName).toBe('LI');
      expect(element.className).toBe('item');
      expect(element.dataset.itemId).toBe('link-1');
      expect(element.draggable).toBe(true);

      // Check content
      expect(element.textContent).toContain('Example Link');
      expect(element.textContent).toContain('https://example.com');
      expect(element.querySelector('.link-icon')).toBeTruthy();
      expect(element.querySelector('.item-drag-handle')).toBeTruthy();
    });

    it('should create element for image item', () => {
      const item: CapturedItem = {
        id: 'img-1',
        type: 'image',
        content: 'data:image/png;base64,abc123',
        metadata: {
          alt: 'Test Image',
          originalSrc: 'https://example.com/image.png',
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      expect(element.className).toBe('item');
      expect(element.dataset.itemId).toBe('img-1');

      const thumbnail = element.querySelector('.item-thumbnail') as HTMLImageElement;
      expect(thumbnail).toBeTruthy();
      expect(thumbnail.src).toBe('data:image/png;base64,abc123');
      expect(thumbnail.alt).toBe('Test Image');

      expect(element.textContent).toContain('Test Image');
      expect(element.textContent).toContain('https://example.com/image.png');
    });

    it('should create element for text item', () => {
      const item: CapturedItem = {
        id: 'text-1',
        type: 'text',
        content: 'This is captured text content',
        metadata: {
          text: 'This is captured text content',
          sourceUrl: 'https://example.com/page',
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      expect(element.className).toBe('item');
      expect(element.dataset.itemId).toBe('text-1');

      expect(element.querySelector('.text-icon')).toBeTruthy();
      expect(element.textContent).toContain('This is captured text content');
      expect(element.textContent).toContain('https://example.com/page');
    });

    it('should truncate long text to 100 characters', () => {
      const longText = 'a'.repeat(150);
      const item: CapturedItem = {
        id: 'text-1',
        type: 'text',
        content: longText,
        metadata: {
          text: longText,
          sourceUrl: 'https://example.com',
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);
      const titleElement = element.querySelector('.item-title');

      expect(titleElement?.textContent).toHaveLength(103); // 100 + '...'
      expect(titleElement?.textContent).toContain('...');
    });

    it('should create element for screenshot item', () => {
      const item: CapturedItem = {
        id: 'screenshot-1',
        type: 'screenshot',
        content: 'data:image/png;base64,screenshot123',
        metadata: {
          alt: 'Screenshot',
          sourceUrl: 'https://example.com',
          dimensions: { x: 0, y: 0, width: 500, height: 300 },
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      expect(element.className).toBe('item');
      expect(element.dataset.itemId).toBe('screenshot-1');

      const thumbnail = element.querySelector('.item-thumbnail') as HTMLImageElement;
      expect(thumbnail).toBeTruthy();
      expect(thumbnail.src).toBe('data:image/png;base64,screenshot123');
    });

    it('should escape HTML in content', () => {
      const item: CapturedItem = {
        id: 'link-1',
        type: 'link',
        content: 'https://example.com',
        metadata: {
          text: '<script>alert("xss")</script>',
          href: 'https://example.com/"><script>alert("xss")</script>',
        },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      // Should not contain actual script tags
      expect(element.innerHTML).not.toContain('<script>alert("xss")</script>');
      // Should contain escaped version
      expect(element.innerHTML).toContain('&lt;script&gt;');
    });

    it('should add delete button with click handler', () => {
      const item: CapturedItem = {
        id: 'link-1',
        type: 'link',
        content: 'https://example.com',
        metadata: { text: 'Test', href: 'https://example.com' },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);
      const deleteBtn = element.querySelector('.delete-btn') as HTMLButtonElement;

      expect(deleteBtn).toBeTruthy();
      expect(deleteBtn.dataset.id).toBe('link-1');

      // Click delete button
      deleteBtn.click();

      expect(mockCallbacks.onDelete).toHaveBeenCalledWith('link-1');
    });

    it('should attach drag event listeners', () => {
      const item: CapturedItem = {
        id: 'link-1',
        type: 'link',
        content: 'https://example.com',
        metadata: { text: 'Test', href: 'https://example.com' },
        timestamp: Date.now(),
        order: 0,
      };

      const element = createItemElement(item, mockCallbacks);

      // Trigger drag events using Event constructor (DragEvent not supported in jsdom)
      element.dispatchEvent(new Event('dragstart'));
      expect(mockCallbacks.onDragStart).toHaveBeenCalled();

      element.dispatchEvent(new Event('dragover'));
      expect(mockCallbacks.onDragOver).toHaveBeenCalled();

      element.dispatchEvent(new Event('drop'));
      expect(mockCallbacks.onDrop).toHaveBeenCalled();

      element.dispatchEvent(new Event('dragend'));
      expect(mockCallbacks.onDragEnd).toHaveBeenCalled();

      element.dispatchEvent(new Event('dragenter'));
      expect(mockCallbacks.onDragEnter).toHaveBeenCalled();

      element.dispatchEvent(new Event('dragleave'));
      expect(mockCallbacks.onDragLeave).toHaveBeenCalled();
    });
  });
});
