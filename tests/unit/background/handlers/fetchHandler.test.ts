/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFetchImage } from '../../../../src/background/handlers/fetchHandler';

describe('fetchHandler', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('handleFetchImage', () => {
    it('should fetch and convert image to data URL successfully', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await handleFetchImage('https://example.com/image.png');

      expect(result.success).toBe(true);
      expect(result.data?.dataUrl).toMatch(/^data:/);
    });

    it('should call fetch with correct URL', async () => {
      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob),
      });

      await handleFetchImage('https://example.com/test-image.jpg');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/test-image.jpg');
    });

    it('should handle fetch network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await handleFetchImage('https://example.com/image.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error fetch failures', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');

      const result = await handleFetchImage('https://example.com/image.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch image');
    });

    it('should handle blob conversion errors', async () => {
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.reject(new Error('Blob error')),
      });

      const result = await handleFetchImage('https://example.com/image.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Blob error');
    });

    it('should work with different image types', async () => {
      const mockBlob = new Blob(['gif data'], { type: 'image/gif' });
      mockFetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await handleFetchImage('https://example.com/animation.gif');

      expect(result.success).toBe(true);
      expect(result.data?.dataUrl).toBeDefined();
    });
  });
});
