/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { setupDragAndDrop } from '../../../src/sidebar/dragDrop';
import { CapturedItem } from '../../../src/types';

describe('dragDrop', () => {
  const createMockItem = (id: string, order: number): CapturedItem => ({
    id,
    type: 'link',
    content: `https://example.com/${id}`,
    metadata: {
      text: `Link ${id}`,
      href: `https://example.com/${id}`,
    },
    timestamp: Date.now(),
    order,
  });

  const createMockElement = (itemId: string): HTMLElement => {
    const el = document.createElement('div');
    el.dataset.itemId = itemId;
    el.classList.add('item');
    return el;
  };

  describe('setupDragAndDrop', () => {
    it('should return drag and drop handlers', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);

      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      expect(handlers).toHaveProperty('handleDragStart');
      expect(handlers).toHaveProperty('handleDragOver');
      expect(handlers).toHaveProperty('handleDragEnter');
      expect(handlers).toHaveProperty('handleDragLeave');
      expect(handlers).toHaveProperty('handleDragEnd');
      expect(handlers).toHaveProperty('handleDrop');
    });
  });

  describe('handleDragStart', () => {
    it('should add dragging class and set data transfer', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const element = createMockElement('item-1');
      const dataTransfer = {
        effectAllowed: '',
        setData: vi.fn(),
      };
      const event = {
        currentTarget: element,
        dataTransfer,
      } as unknown as DragEvent;

      handlers.handleDragStart(event);

      expect(element.classList.contains('dragging')).toBe(true);
      expect(dataTransfer.effectAllowed).toBe('move');
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'item-1');
    });

    it('should handle missing dataTransfer', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const element = createMockElement('item-1');
      const event = {
        currentTarget: element,
        dataTransfer: null,
      } as unknown as DragEvent;

      expect(() => handlers.handleDragStart(event)).not.toThrow();
      expect(element.classList.contains('dragging')).toBe(true);
    });
  });

  describe('handleDragOver', () => {
    it('should prevent default and set drop effect', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const preventDefault = vi.fn();
      const dataTransfer = { dropEffect: '' };
      const event = {
        preventDefault,
        dataTransfer,
      } as unknown as DragEvent;

      const result = handlers.handleDragOver(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(dataTransfer.dropEffect).toBe('move');
      expect(result).toBe(false);
    });
  });

  describe('handleDragEnter', () => {
    it('should add drag-over class', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const element = createMockElement('item-1');
      const event = { currentTarget: element } as DragEvent;

      handlers.handleDragEnter(event);

      expect(element.classList.contains('drag-over')).toBe(true);
    });
  });

  describe('handleDragLeave', () => {
    it('should remove drag-over class', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const element = createMockElement('item-1');
      element.classList.add('drag-over');
      const event = { currentTarget: element } as DragEvent;

      handlers.handleDragLeave(event);

      expect(element.classList.contains('drag-over')).toBe(false);
    });
  });

  describe('handleDragEnd', () => {
    it('should remove dragging class from current element', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const element = createMockElement('item-1');
      element.classList.add('dragging');
      const event = { currentTarget: element } as DragEvent;

      handlers.handleDragEnd(event);

      expect(element.classList.contains('dragging')).toBe(false);
    });

    it('should remove drag-over class from all items', () => {
      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => []);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      const item1 = createMockElement('item-1');
      const item2 = createMockElement('item-2');
      item2.classList.add('drag-over');
      document.body.appendChild(item1);
      document.body.appendChild(item2);

      const event = { currentTarget: item1 } as DragEvent;
      handlers.handleDragEnd(event);

      expect(item2.classList.contains('drag-over')).toBe(false);

      document.body.removeChild(item1);
      document.body.removeChild(item2);
    });
  });

  describe('handleDrop', () => {
    it('should reorder items when dropped on different element', () => {
      const items = [
        createMockItem('item-1', 0),
        createMockItem('item-2', 1),
        createMockItem('item-3', 2),
      ];

      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => items);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      // Start dragging item-1
      const srcElement = createMockElement('item-1');
      const startEvent = {
        currentTarget: srcElement,
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as DragEvent;
      handlers.handleDragStart(startEvent);

      // Drop on item-3
      const targetElement = createMockElement('item-3');
      const dropEvent = {
        currentTarget: targetElement,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as unknown as DragEvent;

      const result = handlers.handleDrop(dropEvent);

      expect(dropEvent.stopPropagation).toHaveBeenCalled();
      expect(dropEvent.preventDefault).toHaveBeenCalled();
      expect(onReorder).toHaveBeenCalled();
      expect(result).toBe(false);

      const reorderedItems = onReorder.mock.calls[0][0];
      expect(reorderedItems[0].id).toBe('item-2');
      expect(reorderedItems[1].id).toBe('item-3');
      expect(reorderedItems[2].id).toBe('item-1');

      // Verify orders are updated
      expect(reorderedItems[0].order).toBe(0);
      expect(reorderedItems[1].order).toBe(1);
      expect(reorderedItems[2].order).toBe(2);
    });

    it('should not reorder when dropped on same element', () => {
      const items = [createMockItem('item-1', 0), createMockItem('item-2', 1)];

      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => items);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      // Start dragging item-1
      const element = createMockElement('item-1');
      const startEvent = {
        currentTarget: element,
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as DragEvent;
      handlers.handleDragStart(startEvent);

      // Drop on same item-1
      const dropEvent = {
        currentTarget: element,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as unknown as DragEvent;

      handlers.handleDrop(dropEvent);

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('should handle missing item IDs gracefully', () => {
      const items = [createMockItem('item-1', 0), createMockItem('item-2', 1)];

      const onReorder = vi.fn();
      const getCurrentItems = vi.fn(() => items);
      const handlers = setupDragAndDrop(onReorder, getCurrentItems);

      // Start dragging element without item ID
      const srcElement = document.createElement('div');
      const startEvent = {
        currentTarget: srcElement,
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as DragEvent;
      handlers.handleDragStart(startEvent);

      // Drop on valid element
      const targetElement = createMockElement('item-2');
      const dropEvent = {
        currentTarget: targetElement,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as unknown as DragEvent;

      handlers.handleDrop(dropEvent);

      expect(onReorder).not.toHaveBeenCalled();
    });
  });
});
