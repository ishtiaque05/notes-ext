/**
 * Background-specific storage logic for Notes Collector extension
 */
import { StorageData } from '../types';
import { safeStorageSet } from '../utils/storage';

export const STORAGE_KEY = 'notesCollectorData';

/**
 * Gets the current storage data structure
 * @returns The StorageData object
 */
export async function getStorageData(): Promise<StorageData> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageData) || { items: [], nextOrder: 0, disabledDomains: [] };
}

/**
 * Saves the storage data structure
 * @param data The StorageData object to save
 */
export async function saveStorageData(data: StorageData): Promise<void> {
  await safeStorageSet({ [STORAGE_KEY]: data });
}

/**
 * Notifies the sidebar of changes
 * @param message The message to send to the sidebar
 */
export function notifySidebar(message: { type: string; data?: unknown; [key: string]: unknown }) {
  browser.runtime.sendMessage(message).catch(() => {
    // Sidebar might not be open, ignore errors
  });
}

/**
 * Notifies a specific tab of changes
 * @param tabId The ID of the tab to notify
 * @param message The message to send
 */
export function notifyTab(
  tabId: number,
  message: { type: string; data?: unknown; [key: string]: unknown }
) {
  browser.tabs.sendMessage(tabId, message).catch(() => {
    // Tab might be closed or content script not loaded
  });
}
