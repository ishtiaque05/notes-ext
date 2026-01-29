import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleRequestScreenshot,
  handleCaptureScreenshot,
} from '../../../../src/background/handlers/screenshotHandler';
import { STORAGE_KEY } from '../../../../src/background/storage';

describe('screenshotHandler', () => {
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

    // Mock captureVisibleTab to return a valid data URL
    vi.mocked(browser.tabs.captureVisibleTab).mockResolvedValue(
      'data:image/png;base64,mockScreenshotData'
    );
  });

  describe('handleRequestScreenshot', () => {
    it('should capture screenshot successfully', async () => {
      const sender: browser.runtime.MessageSender = {
        tab: { id: 1, windowId: 123 } as browser.tabs.Tab,
      };

      const result = await handleRequestScreenshot({}, sender);

      expect(result.success).toBe(true);
      expect(result.data?.dataUrl).toBe('data:image/png;base64,mockScreenshotData');
    });

    it('should pass windowId to captureVisibleTab', async () => {
      const sender: browser.runtime.MessageSender = {
        tab: { id: 1, windowId: 456 } as browser.tabs.Tab,
      };

      await handleRequestScreenshot({}, sender);

      expect(browser.tabs.captureVisibleTab).toHaveBeenCalledWith(456, { format: 'png' });
    });

    it('should handle capture errors gracefully', async () => {
      vi.mocked(browser.tabs.captureVisibleTab).mockRejectedValueOnce(
        new Error('Cannot capture tab')
      );

      const sender: browser.runtime.MessageSender = {
        tab: { id: 1, windowId: 123 } as browser.tabs.Tab,
      };

      const result = await handleRequestScreenshot({}, sender);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot capture tab');
    });

    it('should handle missing tab info', async () => {
      const sender: browser.runtime.MessageSender = {};

      await handleRequestScreenshot({}, sender);

      // Should still attempt capture with undefined windowId
      expect(browser.tabs.captureVisibleTab).toHaveBeenCalled();
    });
  });

  describe('handleCaptureScreenshot', () => {
    const validScreenshotData = {
      dataUrl: 'data:image/png;base64,smallImageData',
      sourceUrl: 'https://example.com/page',
      dimensions: { width: 800, height: 600, x: 100, y: 50 },
    };

    it('should capture screenshot successfully', async () => {
      const result = await handleCaptureScreenshot(validScreenshotData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe('screenshot');
      expect(result.data?.content).toBe(validScreenshotData.dataUrl);
    });

    it('should store screenshot metadata correctly', async () => {
      const result = await handleCaptureScreenshot(validScreenshotData);

      expect(result.data?.metadata).toEqual({
        alt: 'Screenshot from example.com',
        sourceUrl: 'https://example.com/page',
        dimensions: { width: 800, height: 600, x: 100, y: 50 },
      });
    });

    it('should assign unique ID to screenshot', async () => {
      const result = await handleCaptureScreenshot(validScreenshotData);

      expect(result.data?.id).toBeDefined();
      expect(result.data?.id).toMatch(/^test-uuid-/);
    });

    it('should save screenshot to storage', async () => {
      await handleCaptureScreenshot(validScreenshotData);

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(1);
      expect(storage[STORAGE_KEY].items[0].type).toBe('screenshot');
    });

    it('should notify sidebar of new screenshot', async () => {
      await handleCaptureScreenshot(validScreenshotData);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ITEM_ADDED' })
      );
    });

    it('should increment order for each screenshot', async () => {
      await handleCaptureScreenshot(validScreenshotData);
      const result = await handleCaptureScreenshot({
        ...validScreenshotData,
        sourceUrl: 'https://other.com',
      });

      expect(result.data?.order).toBe(1);
    });

    it('should add timestamp to screenshot', async () => {
      const before = Date.now();
      const result = await handleCaptureScreenshot(validScreenshotData);
      const after = Date.now();

      expect(result.data?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.data?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('Storage full'));

      const result = await handleCaptureScreenshot(validScreenshotData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract hostname correctly for alt text', async () => {
      const result = await handleCaptureScreenshot({
        ...validScreenshotData,
        sourceUrl: 'https://subdomain.example.org/path/to/page?query=1',
      });

      // @ts-expect-error - Type narrowing
      expect(result.data?.metadata?.alt).toBe('Screenshot from subdomain.example.org');
    });
  });
});
