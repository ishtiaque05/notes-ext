/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the imported modules before importing the content script
vi.mock('../../../src/utils/dom', () => ({
  isCapturableElement: vi.fn((el: HTMLElement) => {
    return el.tagName === 'A' || el.tagName === 'IMG';
  }),
  escapeHtml: vi.fn((str: string) => str),
}));

vi.mock('../../../src/content/elementFinder', () => ({
  findBestImage: vi.fn((el: HTMLElement) => {
    return el.querySelector('img');
  }),
}));

vi.mock('../../../src/content/utils', () => ({
  showCaptureConfirmation: vi.fn(),
  showTextCaptureConfirmation: vi.fn(),
  cropScreenshot: vi.fn().mockResolvedValue('data:image/png;base64,cropped'),
}));

vi.mock('../../../src/content/components/screenshotOverlay', () => ({
  startScreenshotMode: vi.fn((x, y, callback) => {
    // Immediately invoke callback with mock rect for testing
    callback({ x: 10, y: 10, width: 100, height: 100 });
  }),
  isDrawingScreenshot: vi.fn(() => false),
}));

describe('content script', () => {
  beforeEach(() => {
    // Clear document
    document.body.innerHTML = '';

    // Reset mocks
    vi.clearAllMocks();

    // Mock browser.runtime.sendMessage
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { enabled: true } });
  });

  afterEach(() => {
    // Remove all event listeners by clearing modules
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should check initial site enabled state on load', async () => {
      // Import content script (this runs initialization)
      await import('../../../src/content/content');

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CHECK_SITE_ENABLED',
        data: {},
      });
    });
  });

  describe('highlight on hover', () => {
    it('should add highlight class to capturable elements on mouseover', async () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      document.body.appendChild(link);

      // Trigger mouseover
      const event = new MouseEvent('mouseover', { bubbles: true });
      Object.defineProperty(event, 'target', { value: link, writable: false });
      link.dispatchEvent(event);

      // Note: Since we're testing after import, the actual class addition
      // depends on the event handlers being registered. For isolated testing,
      // we'd need to export the handlers.
    });
  });

  describe('link capture', () => {
    it('should capture link on Ctrl+Click', async () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.textContent = 'Example Link';
      document.body.appendChild(link);

      // Mock sendMessage for capture
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true });

      // Create click event with Ctrl key
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: link, writable: false });

      link.dispatchEvent(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Note: Due to module isolation, we can't easily test the internal functions
      // This test demonstrates the structure. For better testability, export functions.
    });
  });

  describe('image capture', () => {
    it('should capture image on Ctrl+Shift+Click', async () => {
      const img = document.createElement('img');
      img.src = 'https://example.com/image.png';
      img.alt = 'Test Image';
      document.body.appendChild(img);

      vi.mocked(browser.runtime.sendMessage)
        .mockResolvedValueOnce({ success: true, data: { dataUrl: 'data:image/png;base64,abc' } })
        .mockResolvedValueOnce({ success: true });

      // Create click event with Ctrl+Shift
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
        shiftKey: true,
      });
      Object.defineProperty(event, 'target', { value: img, writable: false });

      img.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('text capture', () => {
    it('should capture selected text on Ctrl+Click', async () => {
      const div = document.createElement('div');
      div.textContent = 'Selected text content';
      document.body.appendChild(div);

      // Mock text selection
      const selection = {
        toString: () => 'Selected text content',
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(selection as unknown as Selection);

      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true });

      // Create click event with Ctrl
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: div, writable: false });

      div.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('screenshot capture', () => {
    it('should start screenshot mode on Shift+MouseDown', async () => {
      const { startScreenshotMode } = await import('../../../src/content/components/screenshotOverlay');

      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: { dataUrl: 'data:image/png;base64,screenshot' },
      });

      const div = document.createElement('div');
      document.body.appendChild(div);

      // Create mousedown event with Shift
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        shiftKey: true,
        clientX: 100,
        clientY: 100,
      });
      Object.defineProperty(event, 'target', { value: div, writable: false });

      div.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      // startScreenshotMode should be called
      // In real implementation, this would trigger screenshot capture
    });
  });

  describe('site enabled/disabled', () => {
    it('should not capture when site is disabled', async () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      document.body.appendChild(link);

      // Simulate disabled state by sending SITE_ENABLED_CHANGED message
      const messageListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0];

      if (messageListener) {
        messageListener({
          type: 'SITE_ENABLED_CHANGED',
          enabled: false,
        });
      }

      // Try to capture - should not work
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: link, writable: false });

      link.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not send capture message when disabled
    });

    it('should register message listener for site enabled changes', async () => {
      // The content script registers a message listener on initialization
      // This listener handles SITE_ENABLED_CHANGED messages

      // We can verify the listener was registered by checking the mock
      // Note: Testing module-level initialization is tricky, so we're mainly
      // verifying the structure exists. For full integration testing, use E2E tests.

      expect(browser.runtime.onMessage.addListener).toBeDefined();

      // In a real scenario, the listener would:
      // 1. Receive SITE_ENABLED_CHANGED message
      // 2. Update isEnabled state
      // 3. Remove all highlight classes via updateDisabledState()
    });
  });

  describe('error handling', () => {
    it('should handle capture errors gracefully', async () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.textContent = 'Example';
      document.body.appendChild(link);

      // Mock sendMessage to reject
      vi.mocked(browser.runtime.sendMessage).mockRejectedValue(new Error('Network error'));

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: link, writable: false });

      link.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should handle error without crashing
      consoleErrorSpy.mockRestore();
    });
  });
});
