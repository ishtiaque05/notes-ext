// Background service worker for Notes Collector extension
import type {
  Message,
  MessageResponse,
  StorageData,
  CapturedItem,
  LinkMetadata,
  ImageMetadata,
  TextMetadata,
  ScreenshotMetadata,
} from './types';
import { NotesCollectorError } from './types/errors';
import { checkStorageAvailable, safeStorageSet, getStorageWarning } from './utils/storage';

const STORAGE_KEY = 'notesCollectorData';

// Helper to check if a URL is disabled based on its domain or parent domains
function isUrlDisabled(url: string, disabledDomains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');

    // Check the exact hostname and all parent domains (except the TLD)
    // For gist.github.com, check: gist.github.com, github.com
    for (let i = 0; i <= parts.length - 2; i++) {
      const domainToCheck = parts.slice(i).join('.');
      if (disabledDomains.includes(domainToCheck)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

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

// Create context menu for toggling extension on/off
function createContextMenu() {
  browser.contextMenus.create({
    id: 'toggle-notes-collector',
    title: 'Disable Notes Collector on this page',
    contexts: ['page', 'selection', 'link', 'image'],
  });
}

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
        notifySidebar({
          type: 'SITE_ENABLED_CHANGED',
          data: { enabled: !isDisabled },
        });
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
        // Note: Sidebar only cares if this is the active tab
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTabs[0]?.id === _tabId) {
          notifySidebar({
            type: 'SITE_ENABLED_CHANGED',
            data: { enabled: !isDisabled },
          });
        }
      }
    })();
  }
);

// Toggle site enabled/disabled for current tab
async function toggleSiteEnabled(tabId: number) {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.url) return;

    const hostname = new URL(tab.url).hostname;
    const storageData = await getStorageData();
    const disabledDomains = storageData.disabledDomains || [];

    // Find if the exact hostname or any parent domain is currently in the list
    let index = -1;
    let foundDomain = hostname;

    const parts = hostname.split('.');
    for (let i = 0; i <= parts.length - 2; i++) {
      const domainToCheck = parts.slice(i).join('.');
      const foundIndex = disabledDomains.indexOf(domainToCheck);
      if (foundIndex > -1) {
        index = foundIndex;
        foundDomain = domainToCheck;
        break;
      }
    }

    let newEnabledState: boolean;

    if (index > -1) {
      // Enable: remove the found domain (could be hostname or parent) from disabled list
      disabledDomains.splice(index, 1);
      newEnabledState = true;
      console.warn('=== BACKGROUND: Enabling domain:', foundDomain);
    } else {
      // Disable: add the exact hostname to disabled list
      disabledDomains.push(hostname);
      newEnabledState = false;
      console.warn('=== BACKGROUND: Disabling domain:', hostname);
    }

    storageData.disabledDomains = disabledDomains;
    await safeStorageSet({ [STORAGE_KEY]: storageData });

    console.warn('=== BACKGROUND: toggleSiteEnabled called ===');
    console.warn('Hostname:', hostname);
    console.warn('New enabled state (for exact domain):', newEnabledState);

    // Notify all tabs that their enabled state might have changed
    const tabs = await browser.tabs.query({});
    for (const t of tabs) {
      if (t.id && t.url) {
        const isNowDisabled = isUrlDisabled(t.url, disabledDomains);
        const isNowEnabled = !isNowDisabled;

        await browser.tabs
          .sendMessage(t.id, {
            type: 'SITE_ENABLED_CHANGED',
            enabled: isNowEnabled,
          })
          .catch(() => {
            // Content script might not be ready
          });
      }
    }

    // Update context menu for the current tab
    const isCurrentlyDisabled = isUrlDisabled(tab.url, disabledDomains);
    await updateContextMenu(isCurrentlyDisabled);

    console.warn('=== BACKGROUND: Notifying sidebar ===');
    // Notify sidebar
    notifySidebar({
      type: 'SITE_ENABLED_CHANGED',
      data: { enabled: !isCurrentlyDisabled },
    });
  } catch (error) {
    console.error('Error toggling site enabled:', error);
  }
}

// Update context menu title based on state
async function updateContextMenu(isDisabled: boolean) {
  await browser.contextMenus.update('toggle-notes-collector', {
    title: isDisabled
      ? 'Enable Notes Collector on this page'
      : 'Disable Notes Collector on this page',
  });
}

// Handle messages from content script and sidebar
browser.runtime.onMessage.addListener(
  (message: Message, sender: browser.runtime.MessageSender): Promise<MessageResponse> | void => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Background received message:', message);
    }

    switch (message.type) {
      case 'FETCH_IMAGE':
        return handleFetchImage(message.data.url);
      case 'CAPTURE_LINK':
        return handleCaptureLink(message.data);
      case 'CAPTURE_IMAGE':
        return handleCaptureImage(message.data);
      case 'CAPTURE_TEXT':
        return handleCaptureText(message.data);
      case 'REQUEST_SCREENSHOT':
        return handleRequestScreenshot(message.data, sender);
      case 'CAPTURE_SCREENSHOT':
        return handleCaptureScreenshot(message.data);
      case 'GET_ITEMS':
        return handleGetItems();
      case 'DELETE_ITEM':
        return handleDeleteItem(message.data.id);
      case 'REORDER_ITEMS':
        return handleReorderItems(message.data.items);
      case 'CLEAR_ALL':
        return handleClearAll();
      case 'TOGGLE_SITE_ENABLED':
        if ('tabId' in message.data) {
          return (async () => {
            await toggleSiteEnabled(message.data.tabId);
            return { success: true };
          })();
        }
        return Promise.resolve({ success: false, error: 'No tabId provided' });
      case 'CHECK_SITE_ENABLED':
        return (async () => {
          try {
            // Use tabId from message or from sender
            const tabId =
              message.data && 'tabId' in message.data && message.data.tabId !== -1
                ? message.data.tabId
                : sender.tab?.id;

            if (!tabId) {
              return { success: false, error: 'No tabId found' };
            }

            const tab = await browser.tabs.get(tabId);
            if (!tab.url) return { success: true, data: { enabled: true } };

            const storageData = await getStorageData();
            const enabled = !isUrlDisabled(tab.url, storageData.disabledDomains || []);
            return { success: true, data: { enabled } };
          } catch {
            return { success: true, data: { enabled: true } };
          }
        })();
      default:
        return Promise.resolve({ success: false, error: 'Unknown message type' });
    }
  }
);

// Handler for fetching images (bypasses CSP restrictions)
async function handleFetchImage(url: string): Promise<MessageResponse<{ dataUrl: string }>> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Background: Fetching image from', url);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();

    if (process.env.NODE_ENV === 'development') {
      console.warn('Background: Image fetched, size:', blob.size, 'type:', blob.type);
    }

    // Convert blob to data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob as data URL'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });

    if (process.env.NODE_ENV === 'development') {
      console.warn('Background: Conversion successful, data URL length:', dataUrl.length);
    }

    return { success: true, data: { dataUrl } };
  } catch (error) {
    console.error('Background: Error fetching image:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for capturing links
async function handleCaptureLink(data: {
  href: string;
  text: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    // Check storage availability before adding
    await checkStorageAvailable(500); // Estimate 500 bytes for link

    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'link',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: data.href,
      metadata: {
        text: data.text,
        href: data.href,
      } as LinkMetadata,
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await safeStorageSet({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    // Check if approaching limits and send warning
    const warning = await getStorageWarning();
    if (warning) {
      notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });
    }

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing link:', error);

    if (error instanceof NotesCollectorError) {
      return { success: false, error: error.userMessage || error.message };
    }

    return { success: false, error: 'Failed to capture link. Please try again.' };
  }
}

// Handler for capturing images
async function handleCaptureImage(data: {
  src: string;
  alt: string;
  dataUrl: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    // Use data URL if available, otherwise use original src
    const content = data.dataUrl || data.src;

    // Estimate size (data URLs can be large)
    const estimatedSize = content.startsWith('data:') ? content.length : 500;
    await checkStorageAvailable(estimatedSize);

    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'image',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: content,
      metadata: {
        alt: data.alt,
        originalSrc: data.src,
      } as ImageMetadata,
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await safeStorageSet({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    // Check if approaching limits and send warning
    const warning = await getStorageWarning();
    if (warning) {
      notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });
    }

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing image:', error);

    if (error instanceof NotesCollectorError) {
      return { success: false, error: error.userMessage || error.message };
    }

    return { success: false, error: 'Failed to capture image. Please try again.' };
  }
}

// Handler for capturing text
async function handleCaptureText(data: {
  text: string;
  sourceUrl: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    // Estimate size based on text length
    const estimatedSize = data.text.length + 200;
    await checkStorageAvailable(estimatedSize);

    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'text',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: data.text,
      metadata: {
        text: data.text,
        sourceUrl: data.sourceUrl,
      } as TextMetadata,
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await safeStorageSet({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    // Check if approaching limits and send warning
    const warning = await getStorageWarning();
    if (warning) {
      notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });
    }

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing text:', error);

    if (error instanceof NotesCollectorError) {
      return { success: false, error: error.userMessage || error.message };
    }

    return { success: false, error: 'Failed to capture text. Please try again.' };
  }
}

// Helper function to crop a screenshot to the selected area
async function cropScreenshot(
  dataUrl: string,
  dimensions: { width: number; height: number; x: number; y: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create canvas with the cropped dimensions
        const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw the cropped portion of the screenshot
        // Source: (x, y, width, height) from the original image
        // Destination: (0, 0, width, height) on the canvas
        ctx.drawImage(
          img,
          dimensions.x,
          dimensions.y,
          dimensions.width,
          dimensions.height,
          0,
          0,
          dimensions.width,
          dimensions.height
        );

        // Convert canvas to blob and then to data URL
        canvas
          .convertToBlob({ type: 'image/png' })
          .then((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result);
              } else {
                reject(new Error('Failed to convert blob to data URL'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      } catch (err) {
        reject(new Error(`Canvas cropping failed: ${String(err)}`));
      }
    };
    img.onerror = () => reject(new Error('Failed to load screenshot image'));
    img.src = dataUrl;
  });
}

// Handler for requesting screenshot from content script
async function handleRequestScreenshot(
  data: {
    dimensions: { width: number; height: number; x: number; y: number };
    pixelRatio?: number;
  },
  sender: browser.runtime.MessageSender
): Promise<MessageResponse> {
  try {
    const tab = sender.tab;
    if (!tab) {
      return { success: false, error: 'No tab found in message sender' };
    }

    if (tab.windowId === undefined) {
      return { success: false, error: 'No window ID found for sender tab' };
    }

    // Capture screenshot: try captureTab (Firefox) first, then captureVisibleTab
    let dataUrl: string;

    // Check if captureTab is available (Firefox specific, often more reliable for permissions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tabsApi = browser.tabs as unknown as {
      captureTab?: (tabId: number, options?: { format?: string }) => Promise<string>;
    };

    // Helper to try standard capture with fallbacks
    const tryStandardCapture = async () => {
      try {
        // First try with explicit windowId
        return await browser.tabs.captureVisibleTab(tab.windowId!, { format: 'png' });
      } catch (err1) {
        console.warn('captureVisibleTab(windowId) failed:', err1);
        try {
          // Fallback to active tab in current window
          return await browser.tabs.captureVisibleTab({ format: 'png' });
        } catch (err2) {
          console.warn('captureVisibleTab() failed:', err2);
          throw err1; // Throw the original error or the new one
        }
      }
    };

    if (typeof tabsApi.captureTab === 'function' && tab.id) {
      try {
        dataUrl = await tabsApi.captureTab(tab.id, { format: 'png' });
      } catch (e) {
        console.warn('captureTab failed, falling back to captureVisibleTab:', e);
        dataUrl = await tryStandardCapture();
      }
    } else {
      dataUrl = await tryStandardCapture();
    }

    // Crop the screenshot to the selected area
    // Scale coordinates by pixel ratio for the actual image crop
    const pixelRatio = data.pixelRatio || 1;
    const scaledDimensions = {
      x: Math.round(data.dimensions.x * pixelRatio),
      y: Math.round(data.dimensions.y * pixelRatio),
      width: Math.round(data.dimensions.width * pixelRatio),
      height: Math.round(data.dimensions.height * pixelRatio),
    };

    const croppedDataUrl = await cropScreenshot(dataUrl, scaledDimensions);

    // Store the cropped screenshot
    await handleCaptureScreenshot({
      dataUrl: croppedDataUrl,
      sourceUrl: tab.url || window.location.href,
      dimensions: data.dimensions, // Store original CSS dimensions
    });

    return { success: true };
  } catch (error) {
    console.error('Error requesting screenshot:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for capturing screenshots
async function handleCaptureScreenshot(data: {
  dataUrl: string;
  sourceUrl: string;
  dimensions: { width: number; height: number; x: number; y: number };
}): Promise<MessageResponse<CapturedItem>> {
  try {
    // Estimate size (data URLs can be very large for screenshots)
    const estimatedSize = data.dataUrl.length;
    await checkStorageAvailable(estimatedSize);

    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'screenshot',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: data.dataUrl,
      metadata: {
        alt: `Screenshot (${data.dimensions.width}x${data.dimensions.height})`,
        sourceUrl: data.sourceUrl,
        dimensions: data.dimensions,
      } as ScreenshotMetadata,
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await safeStorageSet({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    // Check if approaching limits and send warning
    const warning = await getStorageWarning();
    if (warning) {
      notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });
    }

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing screenshot:', error);

    if (error instanceof NotesCollectorError) {
      return { success: false, error: error.userMessage || error.message };
    }

    return { success: false, error: 'Failed to capture screenshot. Please try again.' };
  }
}

// Handler for getting all items
async function handleGetItems(): Promise<MessageResponse<CapturedItem[]>> {
  try {
    const storageData = await getStorageData();
    return { success: true, data: storageData.items };
  } catch (error) {
    console.error('Error getting items:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for deleting an item
async function handleDeleteItem(id: string): Promise<MessageResponse> {
  try {
    const storageData = await getStorageData();
    storageData.items = storageData.items.filter((item) => item.id !== id);
    await browser.storage.local.set({ [STORAGE_KEY]: storageData });

    notifySidebar({ type: 'ITEM_DELETED', data: { id } });

    return { success: true };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for reordering items
async function handleReorderItems(items: CapturedItem[]): Promise<MessageResponse> {
  try {
    const storageData = await getStorageData();
    storageData.items = items;
    await browser.storage.local.set({ [STORAGE_KEY]: storageData });

    return { success: true };
  } catch (error) {
    console.error('Error reordering items:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for clearing all items
async function handleClearAll(): Promise<MessageResponse> {
  try {
    const storageData: StorageData = {
      items: [],
      nextOrder: 0,
    };
    await browser.storage.local.set({ [STORAGE_KEY]: storageData });

    notifySidebar({ type: 'ITEMS_CLEARED' });

    return { success: true };
  } catch (error) {
    console.error('Error clearing items:', error);
    return { success: false, error: String(error) };
  }
}

// Helper function to get storage data
async function getStorageData(): Promise<StorageData> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageData) || { items: [], nextOrder: 0 };
}

// Helper function to notify sidebar of changes
function notifySidebar(message: { type: string; data?: unknown }) {
  // Send message to all sidebar instances
  void browser.runtime.sendMessage(message).catch(() => {
    // Sidebar might not be open, ignore errors
  });
}
