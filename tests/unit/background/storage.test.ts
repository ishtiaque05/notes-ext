import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  getStorageData,
  saveStorageData,
  notifySidebar,
  notifyTab,
} from '../../../src/background/storage';
import type { StorageData } from '../../../src/types';

describe('background storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('STORAGE_KEY', () => {
    it('should be defined', () => {
      expect(STORAGE_KEY).toBe('notesCollectorData');
    });
  });

  describe('getStorageData', () => {
    it('should return default structure when storage is empty', async () => {
      const data = await getStorageData();

      expect(data).toEqual({
        items: [],
        nextOrder: 0,
        disabledDomains: [],
      });
    });

    it('should return stored data', async () => {
      const storedData: StorageData = {
        items: [
          {
            id: '123',
            type: 'link',
            order: 0,
            timestamp: 1234567890,
            content: 'https://example.com',
            metadata: { text: 'Example', href: 'https://example.com' },
          },
        ],
        nextOrder: 1,
        disabledDomains: ['disabled.com'],
      };

      await browser.storage.local.set({ [STORAGE_KEY]: storedData });

      const data = await getStorageData();

      expect(data).toEqual(storedData);
    });

    it('should return stored items with correct types', async () => {
      const storedData: StorageData = {
        items: [
          {
            id: '1',
            type: 'link',
            order: 0,
            timestamp: 1000,
            content: 'https://example.com',
            metadata: { text: 'Link', href: 'https://example.com' },
          },
          {
            id: '2',
            type: 'image',
            order: 1,
            timestamp: 2000,
            content: 'data:image/png;base64,...',
            metadata: { alt: 'Image', originalSrc: 'https://example.com/img.png' },
          },
        ],
        nextOrder: 2,
      };

      await browser.storage.local.set({ [STORAGE_KEY]: storedData });

      const data = await getStorageData();

      expect(data.items).toHaveLength(2);
      expect(data.items[0].type).toBe('link');
      expect(data.items[1].type).toBe('image');
    });
  });

  describe('saveStorageData', () => {
    it('should save data to storage', async () => {
      const dataToSave: StorageData = {
        items: [],
        nextOrder: 5,
        disabledDomains: ['example.com'],
      };

      await saveStorageData(dataToSave);

      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY]).toEqual(dataToSave);
    });

    it('should save items correctly', async () => {
      const dataToSave: StorageData = {
        items: [
          {
            id: 'test-id',
            type: 'text',
            order: 0,
            timestamp: Date.now(),
            content: 'Sample text',
            metadata: { text: 'Sample text', sourceUrl: 'https://example.com' },
          },
        ],
        nextOrder: 1,
      };

      await saveStorageData(dataToSave);

      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY].items).toHaveLength(1);
      expect(result[STORAGE_KEY].items[0].id).toBe('test-id');
    });
  });

  describe('notifySidebar', () => {
    it('should send message to runtime', () => {
      notifySidebar({ type: 'ITEMS_UPDATED' });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'ITEMS_UPDATED' });
    });

    it('should send message with data', () => {
      notifySidebar({ type: 'ITEMS_UPDATED', data: { count: 5 } });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ITEMS_UPDATED',
        data: { count: 5 },
      });
    });

    it('should not throw when sendMessage fails', () => {
      vi.mocked(browser.runtime.sendMessage).mockRejectedValueOnce(
        new Error('Sidebar not open')
      );

      // Should not throw
      expect(() => notifySidebar({ type: 'TEST' })).not.toThrow();
    });
  });

  describe('notifyTab', () => {
    it('should send message to specific tab', () => {
      notifyTab(123, { type: 'SITE_ENABLED_CHANGED', enabled: true });

      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(123, {
        type: 'SITE_ENABLED_CHANGED',
        enabled: true,
      });
    });

    it('should send message with data', () => {
      notifyTab(456, { type: 'UPDATE', data: { value: 'test' } });

      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(456, {
        type: 'UPDATE',
        data: { value: 'test' },
      });
    });

    it('should not throw when sendMessage fails', () => {
      vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(
        new Error('Tab not found')
      );

      // Should not throw
      expect(() => notifyTab(999, { type: 'TEST' })).not.toThrow();
    });
  });
});
