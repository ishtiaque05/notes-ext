// Background service worker for Notes Collector extension
import type { Message, MessageResponse, StorageData, CapturedItem, LinkMetadata, ImageMetadata } from './types';

const STORAGE_KEY = 'notesCollectorData';

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Background service worker initialized');
}

// Initialize storage on extension install
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
        nextOrder: 0
      };
      await browser.storage.local.set({ [STORAGE_KEY]: initialData });
    }
  })();
});

// Handle messages from content script and sidebar
browser.runtime.onMessage.addListener((message: Message): Promise<MessageResponse> | void => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Background received message:', message);
  }

  switch (message.type) {
    case 'CAPTURE_LINK':
      return handleCaptureLink(message.data);
    case 'CAPTURE_IMAGE':
      return handleCaptureImage(message.data);
    case 'GET_ITEMS':
      return handleGetItems();
    case 'DELETE_ITEM':
      return handleDeleteItem(message.data.id);
    case 'REORDER_ITEMS':
      return handleReorderItems(message.data.items);
    case 'CLEAR_ALL':
      return handleClearAll();
    default:
      return Promise.resolve({ success: false, error: 'Unknown message type' });
  }
});

// Handler for capturing links
async function handleCaptureLink(data: { href: string; text: string }): Promise<MessageResponse<CapturedItem>> {
  try {
    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'link',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: data.href,
      metadata: {
        text: data.text,
        href: data.href
      } as LinkMetadata
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await browser.storage.local.set({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing link:', error);
    return { success: false, error: String(error) };
  }
}

// Handler for capturing images
async function handleCaptureImage(data: { src: string; alt: string; dataUrl: string }): Promise<MessageResponse<CapturedItem>> {
  try {
    const storageData = await getStorageData();

    // Use data URL if available, otherwise use original src
    const content = data.dataUrl || data.src;

    const newItem: CapturedItem = {
      id: crypto.randomUUID(),
      type: 'image',
      order: storageData.nextOrder,
      timestamp: Date.now(),
      content: content,
      metadata: {
        alt: data.alt,
        originalSrc: data.src
      } as ImageMetadata
    };

    storageData.items.push(newItem);
    storageData.nextOrder++;

    await browser.storage.local.set({ [STORAGE_KEY]: storageData });

    // Notify sidebar of new item
    notifySidebar({ type: 'ITEM_ADDED', data: newItem });

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing image:', error);
    return { success: false, error: String(error) };
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
    storageData.items = storageData.items.filter(item => item.id !== id);
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
      nextOrder: 0
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
