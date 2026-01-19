import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getStorageInfo,
  checkStorageAvailable,
  getStorageWarning,
  safeStorageSet,
  safeStorageGet,
} from '../../../src/utils/storage';
import { StorageQuotaError, StorageError, ItemLimitError } from '../../../src/types/errors';

describe('storage utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStorageInfo', () => {
    it('should return storage info with item count', async () => {
      // Set up mock storage data
      await browser.storage.local.set({
        notesCollectorData: {
          items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        },
      });

      const info = await getStorageInfo();

      expect(info.itemCount).toBe(3);
      expect(info.bytesInUse).toBeGreaterThanOrEqual(0);
      expect(info.isNearQuota).toBe(false);
      expect(info.isNearItemLimit).toBe(false);
    });

    it('should return 0 items when storage is empty', async () => {
      const info = await getStorageInfo();

      expect(info.itemCount).toBe(0);
      expect(info.isNearItemLimit).toBe(false);
    });

    it('should detect near item limit at 500+ items', async () => {
      // Create array of 500 items
      const items = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
      await browser.storage.local.set({
        notesCollectorData: { items },
      });

      const info = await getStorageInfo();

      expect(info.itemCount).toBe(500);
      expect(info.isNearItemLimit).toBe(true);
    });
  });

  describe('checkStorageAvailable', () => {
    it('should not throw when storage has space', async () => {
      await browser.storage.local.set({
        notesCollectorData: { items: [] },
      });

      await expect(checkStorageAvailable()).resolves.toBeUndefined();
    });

    it('should throw ItemLimitError when at max items', async () => {
      // Create array of 1000 items (max limit)
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
      await browser.storage.local.set({
        notesCollectorData: { items },
      });

      await expect(checkStorageAvailable()).rejects.toThrow(ItemLimitError);
    });

    it('should throw ItemLimitError with correct limit value', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
      await browser.storage.local.set({
        notesCollectorData: { items },
      });

      try {
        await checkStorageAvailable();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ItemLimitError);
        expect((error as ItemLimitError).limit).toBe(1000);
      }
    });
  });

  describe('getStorageWarning', () => {
    it('should return null when storage is below limits', async () => {
      await browser.storage.local.set({
        notesCollectorData: { items: [] },
      });

      const warning = await getStorageWarning();
      expect(warning).toBeNull();
    });

    it('should return warning when approaching item limit', async () => {
      const items = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
      await browser.storage.local.set({
        notesCollectorData: { items },
      });

      const warning = await getStorageWarning();
      expect(warning).toContain('Approaching limit');
      expect(warning).toContain('500');
    });

    it('should return full warning when at max items', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
      await browser.storage.local.set({
        notesCollectorData: { items },
      });

      const warning = await getStorageWarning();
      expect(warning).toContain('Storage full');
      expect(warning).toContain('1000');
    });
  });

  describe('safeStorageSet', () => {
    it('should set data successfully', async () => {
      await safeStorageSet({ testKey: 'testValue' });

      const result = await browser.storage.local.get('testKey');
      expect(result.testKey).toBe('testValue');
    });

    it('should throw StorageQuotaError on quota exceeded', async () => {
      // Mock storage.set to throw quota error
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(
        new Error('quota exceeded')
      );

      await expect(safeStorageSet({ key: 'value' })).rejects.toThrow(StorageQuotaError);
    });

    it('should throw StorageError on other errors', async () => {
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(
        new Error('Some other error')
      );

      await expect(safeStorageSet({ key: 'value' })).rejects.toThrow(StorageError);
    });
  });

  describe('safeStorageGet', () => {
    it('should get data successfully', async () => {
      await browser.storage.local.set({ myKey: { foo: 'bar' } });

      const result = await safeStorageGet<{ foo: string }>('myKey');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null when key does not exist', async () => {
      const result = await safeStorageGet('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should throw StorageError on errors', async () => {
      vi.mocked(browser.storage.local.get).mockRejectedValueOnce(
        new Error('Storage read error')
      );

      await expect(safeStorageGet('key')).rejects.toThrow(StorageError);
    });

    it('should include user message in StorageError', async () => {
      vi.mocked(browser.storage.local.get).mockRejectedValueOnce(
        new Error('Storage read error')
      );

      try {
        await safeStorageGet('key');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).userMessage).toContain('refresh');
      }
    });
  });
});
