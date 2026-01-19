import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleSiteEnabled } from '../../../../src/background/handlers/siteEnabledHandler';
import { STORAGE_KEY } from '../../../../src/background/storage';

// Mock the contextMenu module
vi.mock('../../../../src/background/contextMenu', () => ({
  updateContextMenu: vi.fn(),
}));

describe('siteEnabledHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for tabs.get
    vi.mocked(browser.tabs.get).mockResolvedValue({
      id: 1,
      url: 'https://example.com/page',
      index: 0,
      highlighted: false,
      active: true,
      pinned: false,
      incognito: false,
    });

    // Default mock for tabs.query
    vi.mocked(browser.tabs.query).mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/page',
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
      },
    ]);
  });

  describe('toggleSiteEnabled', () => {
    it('should disable a domain when not currently disabled', async () => {
      // Set up initial storage with no disabled domains
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [],
          nextOrder: 0,
          disabledDomains: [],
        },
      });

      await toggleSiteEnabled(1);

      // Check storage was updated
      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY].disabledDomains).toContain('example.com');
    });

    it('should enable a domain when currently disabled', async () => {
      // Set up initial storage with example.com disabled
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [],
          nextOrder: 0,
          disabledDomains: ['example.com'],
        },
      });

      await toggleSiteEnabled(1);

      // Check storage was updated - domain should be removed
      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY].disabledDomains).not.toContain('example.com');
    });

    it('should enable subdomain when parent domain is disabled', async () => {
      // Set up storage with parent domain disabled
      // Tab URL is sub.example.com
      vi.mocked(browser.tabs.get).mockResolvedValue({
        id: 1,
        url: 'https://sub.example.com/page',
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
      });

      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [],
          nextOrder: 0,
          disabledDomains: ['example.com'],
        },
      });

      await toggleSiteEnabled(1);

      // Check storage was updated - parent domain should be removed
      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY].disabledDomains).not.toContain('example.com');
    });

    it('should notify sidebar of state change', async () => {
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [],
          nextOrder: 0,
          disabledDomains: [],
        },
      });

      await toggleSiteEnabled(1);

      // Check runtime.sendMessage was called for sidebar notification
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SITE_ENABLED_CHANGED',
        })
      );
    });

    it('should notify all tabs of state change', async () => {
      // Set up multiple tabs
      vi.mocked(browser.tabs.query).mockResolvedValue([
        {
          id: 1,
          url: 'https://example.com/page1',
          index: 0,
          highlighted: false,
          active: true,
          pinned: false,
          incognito: false,
        },
        {
          id: 2,
          url: 'https://example.com/page2',
          index: 1,
          highlighted: false,
          active: false,
          pinned: false,
          incognito: false,
        },
      ]);

      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [],
          nextOrder: 0,
          disabledDomains: [],
        },
      });

      await toggleSiteEnabled(1);

      // Check tabs.sendMessage was called for each tab
      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ type: 'SITE_ENABLED_CHANGED' })
      );
      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ type: 'SITE_ENABLED_CHANGED' })
      );
    });

    it('should handle tab without URL gracefully', async () => {
      vi.mocked(browser.tabs.get).mockResolvedValue({
        id: 1,
        url: undefined,
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
      });

      // Should not throw
      await expect(toggleSiteEnabled(1)).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(browser.tabs.get).mockRejectedValue(new Error('Tab not found'));

      // Should not throw
      await expect(toggleSiteEnabled(999)).resolves.not.toThrow();
    });

    it('should preserve other items when toggling domain', async () => {
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          items: [{ id: '1', type: 'link', order: 0 }],
          nextOrder: 1,
          disabledDomains: [],
        },
      });

      await toggleSiteEnabled(1);

      const result = await browser.storage.local.get(STORAGE_KEY);
      expect(result[STORAGE_KEY].items).toHaveLength(1);
      expect(result[STORAGE_KEY].nextOrder).toBe(1);
    });
  });
});
