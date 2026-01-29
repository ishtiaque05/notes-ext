import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMessaging } from '../../../src/background/messaging';

// Mock all handler modules
vi.mock('../../../src/background/handlers/captureHandler', () => ({
  handleCaptureLink: vi.fn().mockResolvedValue({ success: true }),
  handleCaptureImage: vi.fn().mockResolvedValue({ success: true }),
  handleCaptureText: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../src/background/handlers/screenshotHandler', () => ({
  handleRequestScreenshot: vi.fn().mockResolvedValue({ success: true }),
  handleCaptureScreenshot: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../src/background/handlers/itemManagerHandler', () => ({
  handleDeleteItem: vi.fn().mockResolvedValue({ success: true }),
  handleReorderItems: vi.fn().mockResolvedValue({ success: true }),
  handleClearAll: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../src/background/handlers/fetchHandler', () => ({
  handleFetchImage: vi.fn().mockResolvedValue({ success: true, data: { dataUrl: 'data:image/png;base64,abc' } }),
}));

vi.mock('../../../src/background/handlers/siteEnabledHandler', () => ({
  toggleSiteEnabled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/background/storage', () => ({
  getStorageData: vi.fn().mockResolvedValue({
    items: [{ id: '1', type: 'link', content: 'test' }],
    disabledDomains: [],
  }),
}));

vi.mock('../../../src/utils/url', () => ({
  isUrlDisabled: vi.fn().mockReturnValue(false),
}));

describe('messaging', () => {
  let messageListener: (message: unknown, sender: browser.runtime.MessageSender) => Promise<unknown> | void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture the message listener
    const addListenerMock = vi.fn((listener) => {
      messageListener = listener;
    });

    vi.mocked(browser.runtime.onMessage.addListener).mockImplementation(addListenerMock);

    setupMessaging();

    expect(addListenerMock).toHaveBeenCalled();
  });

  describe('setupMessaging', () => {
    it('should register message listener', () => {
      expect(browser.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(messageListener).toBeDefined();
    });
  });

  describe('message routing', () => {
    it('should handle FETCH_IMAGE message', async () => {
      const { handleFetchImage } = await import('../../../src/background/handlers/fetchHandler');

      const message = {
        type: 'FETCH_IMAGE',
        data: { url: 'https://example.com/image.png' },
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleFetchImage).toHaveBeenCalledWith('https://example.com/image.png');
      expect(result).toEqual({ success: true, data: { dataUrl: 'data:image/png;base64,abc' } });
    });

    it('should handle CAPTURE_LINK message', async () => {
      const { handleCaptureLink } = await import('../../../src/background/handlers/captureHandler');

      const message = {
        type: 'CAPTURE_LINK',
        data: { href: 'https://example.com', text: 'Example' },
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleCaptureLink).toHaveBeenCalledWith({ href: 'https://example.com', text: 'Example' });
      expect(result).toEqual({ success: true });
    });

    it('should handle CAPTURE_IMAGE message', async () => {
      const { handleCaptureImage } = await import('../../../src/background/handlers/captureHandler');

      const message = {
        type: 'CAPTURE_IMAGE',
        data: { src: 'https://example.com/img.png', alt: 'Image', dataUrl: 'data:...' },
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleCaptureImage).toHaveBeenCalledWith({
        src: 'https://example.com/img.png',
        alt: 'Image',
        dataUrl: 'data:...',
      });
    });

    it('should handle CAPTURE_TEXT message', async () => {
      const { handleCaptureText } = await import('../../../src/background/handlers/captureHandler');

      const message = {
        type: 'CAPTURE_TEXT',
        data: { text: 'Selected text', sourceUrl: 'https://example.com' },
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleCaptureText).toHaveBeenCalledWith({
        text: 'Selected text',
        sourceUrl: 'https://example.com',
      });
    });

    it('should handle REQUEST_SCREENSHOT message', async () => {
      const { handleRequestScreenshot } = await import('../../../src/background/handlers/screenshotHandler');

      const message = {
        type: 'REQUEST_SCREENSHOT',
        data: { dimensions: { x: 0, y: 0, width: 100, height: 100 } },
      };
      const sender = { tab: { id: 1 } } as browser.runtime.MessageSender;

      await messageListener(message, sender);

      expect(handleRequestScreenshot).toHaveBeenCalledWith(
        { dimensions: { x: 0, y: 0, width: 100, height: 100 } },
        sender
      );
    });

    it('should handle CAPTURE_SCREENSHOT message', async () => {
      const { handleCaptureScreenshot } = await import('../../../src/background/handlers/screenshotHandler');

      const message = {
        type: 'CAPTURE_SCREENSHOT',
        data: { dataUrl: 'data:...', sourceUrl: 'https://example.com' },
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleCaptureScreenshot).toHaveBeenCalledWith({
        dataUrl: 'data:...',
        sourceUrl: 'https://example.com',
      });
    });

    it('should handle GET_ITEMS message', async () => {
      const { getStorageData } = await import('../../../src/background/storage');

      const message = {
        type: 'GET_ITEMS',
        data: {},
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(getStorageData).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: [{ id: '1', type: 'link', content: 'test' }],
      });
    });

    it('should handle DELETE_ITEM message', async () => {
      const { handleDeleteItem } = await import('../../../src/background/handlers/itemManagerHandler');

      const message = {
        type: 'DELETE_ITEM',
        data: { id: 'item-1' },
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleDeleteItem).toHaveBeenCalledWith('item-1');
    });

    it('should handle REORDER_ITEMS message', async () => {
      const { handleReorderItems } = await import('../../../src/background/handlers/itemManagerHandler');

      const items = [{ id: '1', order: 0 }, { id: '2', order: 1 }];
      const message = {
        type: 'REORDER_ITEMS',
        data: { items },
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleReorderItems).toHaveBeenCalledWith(items);
    });

    it('should handle CLEAR_ALL message', async () => {
      const { handleClearAll } = await import('../../../src/background/handlers/itemManagerHandler');

      const message = {
        type: 'CLEAR_ALL',
        data: {},
      };

      await messageListener(message, {} as browser.runtime.MessageSender);

      expect(handleClearAll).toHaveBeenCalled();
    });

    it('should handle TOGGLE_SITE_ENABLED message with tabId', async () => {
      const { toggleSiteEnabled } = await import('../../../src/background/handlers/siteEnabledHandler');

      const message = {
        type: 'TOGGLE_SITE_ENABLED',
        data: { tabId: 123 },
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(toggleSiteEnabled).toHaveBeenCalledWith(123);
      expect(result).toEqual({ success: true });
    });

    it('should handle TOGGLE_SITE_ENABLED message without tabId', async () => {
      const message = {
        type: 'TOGGLE_SITE_ENABLED',
        data: {},
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(result).toEqual({ success: false, error: 'No tabId provided' });
    });

    it('should handle CHECK_SITE_ENABLED message', async () => {
      const { getStorageData } = await import('../../../src/background/storage');
      const { isUrlDisabled } = await import('../../../src/utils/url');

      vi.mocked(browser.tabs.get).mockResolvedValue({
        id: 1,
        url: 'https://example.com',
      } as browser.tabs.Tab);

      const message = {
        type: 'CHECK_SITE_ENABLED',
        data: { tabId: 1 },
      };

      const result = await messageListener(message, { tab: { id: 1 } } as browser.runtime.MessageSender);

      expect(getStorageData).toHaveBeenCalled();
      expect(isUrlDisabled).toHaveBeenCalledWith('https://example.com', []);
      expect(result).toEqual({ success: true, data: { enabled: true } });
    });

    it('should handle unknown message type', async () => {
      const message = {
        type: 'UNKNOWN_TYPE',
        data: {},
      };

      const result = await messageListener(message, {} as browser.runtime.MessageSender);

      expect(result).toEqual({ success: false, error: 'Unknown message type' });
    });
  });
});
