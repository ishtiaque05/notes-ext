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

// Runtime state for disabled tabs (not persisted)
const disabledTabs = new Set<number>();

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
      };
      await browser.storage.local.set({ [STORAGE_KEY]: initialData });
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
  const isDisabled = disabledTabs.has(activeInfo.tabId);
  void updateContextMenu(isDisabled);
});

// Toggle site enabled/disabled for current tab
async function toggleSiteEnabled(tabId: number) {
  const isDisabled = disabledTabs.has(tabId);

  console.warn('=== BACKGROUND: toggleSiteEnabled called ===');
  console.warn('Tab ID:', tabId);
  console.warn('Is currently disabled:', isDisabled);

  if (isDisabled) {
    disabledTabs.delete(tabId);
    await updateContextMenu(false);
  } else {
    disabledTabs.add(tabId);
    await updateContextMenu(true);
  }

  // Calculate new state after toggling
  const newEnabledState = !disabledTabs.has(tabId);

  console.warn('=== BACKGROUND: New enabled state:', newEnabledState);
  console.warn('Disabled tabs:', Array.from(disabledTabs));

  // Notify content script
  await browser.tabs
    .sendMessage(tabId, {
      type: 'SITE_ENABLED_CHANGED',
      enabled: newEnabledState,
    })
    .catch(() => {
      // Content script might not be ready, ignore
    });

  console.warn('=== BACKGROUND: Notifying sidebar ===');
  // Notify sidebar
  notifySidebar({
    type: 'SITE_ENABLED_CHANGED',
    data: { enabled: newEnabledState },
  });
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
browser.runtime.onMessage.addListener((message: Message): Promise<MessageResponse> | void => {
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
      return handleRequestScreenshot(message.data);
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
        void toggleSiteEnabled(message.data.tabId);
      }
      return Promise.resolve({ success: true });
    case 'CHECK_SITE_ENABLED':
      if ('tabId' in message.data) {
        const enabled = !disabledTabs.has(message.data.tabId);
        return Promise.resolve({ success: true, data: { enabled } });
      }
      return Promise.resolve({ success: false, error: 'No tabId provided' });
    default:
      return Promise.resolve({ success: false, error: 'Unknown message type' });
  }
});

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

// Handler for requesting screenshot from content script
async function handleRequestScreenshot(data: {
  dimensions: { width: number; height: number; x: number; y: number };
}): Promise<MessageResponse> {
  try {
    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      return { success: false, error: 'No active tab found' };
    }

    const tab = tabs[0];

    // Capture visible tab using browser's native API
    const dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' });

    // Now we need to crop the screenshot to the selected area
    // We'll send it directly to handleCaptureScreenshot
    await handleCaptureScreenshot({
      dataUrl,
      sourceUrl: tab.url || window.location.href,
      dimensions: data.dimensions,
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
