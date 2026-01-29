import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleDeleteItem,
  handleReorderItems,
  handleClearAll,
} from '../../../../src/background/handlers/itemManagerHandler';
import { STORAGE_KEY } from '../../../../src/background/storage';
import { CapturedItem } from '../../../../src/types';

describe('itemManagerHandler', () => {
  const createMockItem = (overrides: Partial<CapturedItem> = {}): CapturedItem => ({
    id: 'test-id-1',
    type: 'link',
    order: 0,
    timestamp: Date.now(),
    content: 'https://example.com',
    metadata: { text: 'Test', href: 'https://example.com' },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset storage with default structure
    browser.storage.local.set({
      [STORAGE_KEY]: {
        items: [],
        nextOrder: 0,
        disabledDomains: [],
      },
    });
  });

  describe('handleDeleteItem', () => {
    it('should delete an existing item successfully', async () => {
      const item = createMockItem({ id: 'item-to-delete' });
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [item],
          nextOrder: 1,
          disabledDomains: [],
        },
      });

      const result = await handleDeleteItem('item-to-delete');

      expect(result.success).toBe(true);

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(0);
    });

    it('should return error when item not found', async () => {
      const result = await handleDeleteItem('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });

    it('should notify sidebar after deletion', async () => {
      const item = createMockItem({ id: 'item-to-delete' });
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [item],
          nextOrder: 1,
          disabledDomains: [],
        },
      });

      await handleDeleteItem('item-to-delete');

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ITEM_DELETED',
          data: { id: 'item-to-delete' },
        })
      );
    });

    it('should preserve other items when deleting one', async () => {
      const items = [
        createMockItem({ id: 'item-1', order: 0 }),
        createMockItem({ id: 'item-2', order: 1 }),
        createMockItem({ id: 'item-3', order: 2 }),
      ];
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items,
          nextOrder: 3,
          disabledDomains: [],
        },
      });

      await handleDeleteItem('item-2');

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(2);
      expect(storage[STORAGE_KEY].items.map((i: CapturedItem) => i.id)).toEqual([
        'item-1',
        'item-3',
      ]);
    });

    it('should handle storage errors gracefully', async () => {
      const item = createMockItem({ id: 'item-1' });
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [item],
          nextOrder: 1,
          disabledDomains: [],
        },
      });

      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('Storage error'));

      const result = await handleDeleteItem('item-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('handleReorderItems', () => {
    it('should reorder items successfully', async () => {
      const items = [
        createMockItem({ id: 'item-1', order: 0 }),
        createMockItem({ id: 'item-2', order: 1 }),
        createMockItem({ id: 'item-3', order: 2 }),
      ];
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items,
          nextOrder: 3,
          disabledDomains: [],
        },
      });

      const reorderedItems = [
        createMockItem({ id: 'item-3', order: 0 }),
        createMockItem({ id: 'item-1', order: 1 }),
        createMockItem({ id: 'item-2', order: 2 }),
      ];

      const result = await handleReorderItems(reorderedItems);

      expect(result.success).toBe(true);

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items.map((i: CapturedItem) => i.id)).toEqual([
        'item-3',
        'item-1',
        'item-2',
      ]);
    });

    it('should handle empty items array', async () => {
      const result = await handleReorderItems([]);

      expect(result.success).toBe(true);

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(0);
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('Storage error'));

      const result = await handleReorderItems([createMockItem()]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('handleClearAll', () => {
    it('should clear all items successfully', async () => {
      const items = [
        createMockItem({ id: 'item-1' }),
        createMockItem({ id: 'item-2' }),
      ];
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items,
          nextOrder: 2,
          disabledDomains: ['example.com'],
        },
      });

      const result = await handleClearAll();

      expect(result.success).toBe(true);

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(0);
      expect(storage[STORAGE_KEY].nextOrder).toBe(0);
    });

    it('should preserve disabledDomains when clearing', async () => {
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [createMockItem()],
          nextOrder: 1,
          disabledDomains: ['example.com', 'test.com'],
        },
      });

      await handleClearAll();

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].disabledDomains).toEqual(['example.com', 'test.com']);
    });

    it('should notify sidebar after clearing', async () => {
      await handleClearAll();

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ITEMS_CLEARED' })
      );
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('Storage error'));

      const result = await handleClearAll();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    it('should work when no items exist', async () => {
      const result = await handleClearAll();

      expect(result.success).toBe(true);
    });
  });
});
