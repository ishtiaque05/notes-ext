/**
 * Background entry point for Notes Collector extension
 */
import { StorageData } from './types';
import { STORAGE_KEY, getStorageData, notifySidebar, notifyTab } from './background/storage';
import { createContextMenu, updateContextMenu } from './background/contextMenu';
import { setupMessaging } from './background/messaging';
import { toggleSiteEnabled } from './background/handlers/siteEnabledHandler';
import { isUrlDisabled } from './utils/url';

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Background service worker initialized');
}

// Initialize storage and context menu on extension install
browser.runtime.onInstalled.addListener(() => {
  void (async () => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Notes Collector: Extension installed');
    }

    // Initialize storage with empty data structure
    const result = await browser.storage.local.get(STORAGE_KEY);
    if (!result[STORAGE_KEY]) {
      const initialData: StorageData = {
        items: [],
        nextOrder: 0,
        disabledDomains: [],
      };
      await browser.storage.local.set({ [STORAGE_KEY]: initialData });
    } else {
      // Ensure disabledDomains exists
      const data = result[STORAGE_KEY] as StorageData;
      if (!data.disabledDomains) {
        data.disabledDomains = [];
        await browser.storage.local.set({ [STORAGE_KEY]: data });
      }
    }

    // Create context menu
    createContextMenu();
  })();
});

// Setup message listeners
setupMessaging();

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(
  (info: browser.contextMenus.OnClickData, tab?: browser.tabs.Tab) => {
    if (info.menuItemId === 'toggle-notes-collector' && tab?.id) {
      void toggleSiteEnabled(tab.id);
    }
  }
);

// Update context menu when tab changes
browser.tabs.onActivated.addListener((activeInfo) => {
  void (async () => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.url) {
        const storageData = await getStorageData();
        const isDisabled = isUrlDisabled(tab.url, storageData.disabledDomains || []);
        void updateContextMenu(isDisabled);

        // Also notify sidebar of the enabled state for the new current tab
        const msg = {
          type: 'SITE_ENABLED_CHANGED',
          data: { enabled: !isDisabled },
          enabled: !isDisabled, // Backward compatibility
        };
        notifySidebar(msg);
        notifyTab(activeInfo.tabId, msg);
      }
    } catch {
      // Tab might be closed or not have a URL
    }
  })();
});

// Update context menu when tab URL changes
browser.tabs.onUpdated.addListener(
  (_tabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo, tab: browser.tabs.Tab) => {
    void (async () => {
      if (changeInfo.url || (tab.url && changeInfo.status === 'complete')) {
        const storageData = await getStorageData();
        const isDisabled = isUrlDisabled(tab.url || '', storageData.disabledDomains || []);
        void updateContextMenu(isDisabled);

        // Also notify sidebar of the enabled state for the updated tab
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTabs[0]?.id === _tabId) {
          const msg = {
            type: 'SITE_ENABLED_CHANGED',
            data: { enabled: !isDisabled },
            enabled: !isDisabled, // Backward compatibility
          };
          notifySidebar(msg);
          notifyTab(_tabId, msg);
        }
      }
    })();
  }
);
