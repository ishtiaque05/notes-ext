import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCaptureLink,
  handleCaptureImage,
  handleCaptureText,
} from '../../../../src/background/handlers/captureHandler';
import { STORAGE_KEY } from '../../../../src/background/storage';

describe('captureHandler', () => {
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

  describe('handleCaptureLink', () => {
    it('should capture a link successfully', async () => {
      const result = await handleCaptureLink({
        href: 'https://example.com',
        text: 'Example Link',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe('link');
      expect(result.data?.content).toBe('https://example.com');
      expect(result.data?.metadata).toEqual({
        text: 'Example Link',
        href: 'https://example.com',
      });
    });

    it('should assign unique ID to captured link', async () => {
      const result = await handleCaptureLink({
        href: 'https://example.com',
        text: 'Test',
      });

      expect(result.data?.id).toBeDefined();
      expect(result.data?.id).toMatch(/^test-uuid-/);
    });

    it('should increment order for each capture', async () => {
      await handleCaptureLink({ href: 'https://first.com', text: 'First' });
      const result = await handleCaptureLink({ href: 'https://second.com', text: 'Second' });

      expect(result.data?.order).toBe(1);
    });

    it('should add timestamp to captured item', async () => {
      const before = Date.now();
      const result = await handleCaptureLink({
        href: 'https://example.com',
        text: 'Test',
      });
      const after = Date.now();

      expect(result.data?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.data?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should save item to storage', async () => {
      await handleCaptureLink({
        href: 'https://example.com',
        text: 'Test',
      });

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(1);
      expect(storage[STORAGE_KEY].items[0].type).toBe('link');
    });

    it('should notify sidebar of new item', async () => {
      await handleCaptureLink({
        href: 'https://example.com',
        text: 'Test',
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ITEM_ADDED' })
      );
    });

    it('should return error on failure', async () => {
      // Force storage to fail
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const result = await handleCaptureLink({
        href: 'https://example.com',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('handleCaptureImage', () => {
    it('should capture an image successfully', async () => {
      const result = await handleCaptureImage({
        src: 'https://example.com/image.png',
        alt: 'Test Image',
        dataUrl: 'data:image/png;base64,abc123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe('image');
      expect(result.data?.content).toBe('data:image/png;base64,abc123');
    });

    it('should store image metadata correctly', async () => {
      const result = await handleCaptureImage({
        src: 'https://example.com/image.png',
        alt: 'Alt Text',
        dataUrl: 'data:image/png;base64,abc123',
      });

      expect(result.data?.metadata).toEqual({
        alt: 'Alt Text',
        originalSrc: 'https://example.com/image.png',
      });
    });

    it('should save image to storage', async () => {
      await handleCaptureImage({
        src: 'https://example.com/image.png',
        alt: 'Test',
        dataUrl: 'data:image/png;base64,abc123',
      });

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(1);
      expect(storage[STORAGE_KEY].items[0].type).toBe('image');
    });

    it('should notify sidebar of new image', async () => {
      await handleCaptureImage({
        src: 'https://example.com/image.png',
        alt: 'Test',
        dataUrl: 'data:image/png;base64,abc123',
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ITEM_ADDED' })
      );
    });
  });

  describe('handleCaptureText', () => {
    it('should capture text successfully', async () => {
      const result = await handleCaptureText({
        text: 'Selected text content',
        sourceUrl: 'https://example.com/page',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe('text');
      expect(result.data?.content).toBe('Selected text content');
    });

    it('should store text metadata correctly', async () => {
      const result = await handleCaptureText({
        text: 'Some text',
        sourceUrl: 'https://example.com/page',
      });

      expect(result.data?.metadata).toEqual({
        text: 'Some text',
        sourceUrl: 'https://example.com/page',
      });
    });

    it('should save text to storage', async () => {
      await handleCaptureText({
        text: 'Test text',
        sourceUrl: 'https://example.com',
      });

      const storage = await browser.storage.local.get(STORAGE_KEY);
      expect(storage[STORAGE_KEY].items).toHaveLength(1);
      expect(storage[STORAGE_KEY].items[0].type).toBe('text');
    });

    it('should notify sidebar of new text', async () => {
      await handleCaptureText({
        text: 'Test text',
        sourceUrl: 'https://example.com',
      });

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ITEM_ADDED' })
      );
    });
  });

  describe('multiple captures', () => {
    it('should maintain correct order across different capture types', async () => {
      await handleCaptureLink({ href: 'https://link.com', text: 'Link' });
      await handleCaptureImage({
        src: 'https://img.com/a.png',
        alt: 'Image',
        dataUrl: 'data:image/png;base64,x',
      });
      await handleCaptureText({ text: 'Text', sourceUrl: 'https://page.com' });

      const storage = await browser.storage.local.get(STORAGE_KEY);
      const items = storage[STORAGE_KEY].items;

      expect(items).toHaveLength(3);
      expect(items[0].order).toBe(0);
      expect(items[1].order).toBe(1);
      expect(items[2].order).toBe(2);
    });
  });
});
