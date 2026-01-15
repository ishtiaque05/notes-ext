// Storage utilities for Notes Collector extension
import { StorageQuotaError, StorageError, ItemLimitError } from '../types/errors';

// Constants
const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8; // Warn at 80% usage
const MAX_ITEMS = 1000; // Maximum number of items allowed
const ITEM_LIMIT_WARNING = 500; // Warn at 500 items

/**
 * Storage usage information
 */
export interface StorageInfo {
  bytesInUse: number;
  quotaBytes?: number;
  percentUsed?: number;
  isNearQuota: boolean;
  itemCount: number;
  isNearItemLimit: boolean;
}

/**
 * Get current storage usage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  // Firefox doesn't support getBytesInUse, so we estimate based on JSON size
  let bytesInUse = 0;
  try {
    // Try to use getBytesInUse if available (Chrome)
    if (browser.storage.local.getBytesInUse) {
      bytesInUse = await browser.storage.local.getBytesInUse();
    } else {
      // Fallback: estimate size from JSON stringification (Firefox)
      const allData = await browser.storage.local.get(null);
      bytesInUse = new Blob([JSON.stringify(allData)]).size;
    }
  } catch (error) {
    console.warn('Failed to get storage size, using estimate', error);
  }

  // Get item count
  const STORAGE_KEY = 'notesCollectorData';
  const data = await browser.storage.local.get(STORAGE_KEY);
  const storageData = data[STORAGE_KEY] || {};
  const items = (storageData.items as unknown[] | undefined) || [];
  const itemCount = items.length;

  // Firefox doesn't provide quota info via the storage API
  // QUOTA_BYTES is deprecated, so we estimate based on typical limits
  const estimatedQuota = 10 * 1024 * 1024; // 10MB typical for local storage
  const percentUsed = (bytesInUse / estimatedQuota) * 100;
  const isNearQuota = percentUsed >= STORAGE_QUOTA_WARNING_THRESHOLD * 100;
  const isNearItemLimit = itemCount >= ITEM_LIMIT_WARNING;

  return {
    bytesInUse,
    quotaBytes: estimatedQuota,
    percentUsed,
    isNearQuota,
    itemCount,
    isNearItemLimit,
  };
}

/**
 * Check if storage quota is available for new item
 * @throws {StorageQuotaError} if quota would be exceeded
 * @throws {ItemLimitError} if item limit would be exceeded
 */
export async function checkStorageAvailable(estimatedSize: number = 50000): Promise<void> {
  const info = await getStorageInfo();

  // Check item limit
  if (info.itemCount >= MAX_ITEMS) {
    throw new ItemLimitError(MAX_ITEMS);
  }

  // Check storage quota
  if (info.quotaBytes) {
    const projectedUsage = info.bytesInUse + estimatedSize;
    if (projectedUsage >= info.quotaBytes) {
      throw new StorageQuotaError();
    }
  }
}

/**
 * Get storage warning message if approaching limits
 */
export async function getStorageWarning(): Promise<string | null> {
  const info = await getStorageInfo();

  if (info.itemCount >= MAX_ITEMS) {
    return `Storage full: ${info.itemCount} items. Please export and clear some items.`;
  }

  if (info.isNearItemLimit) {
    return `Approaching limit: ${info.itemCount}/${MAX_ITEMS} items captured.`;
  }

  if (info.isNearQuota && info.percentUsed) {
    return `Storage ${Math.round(info.percentUsed)}% full. Consider exporting to PDF.`;
  }

  return null;
}

/**
 * Safe storage set with error handling
 */
export async function safeStorageSet(data: Record<string, unknown>): Promise<void> {
  try {
    await browser.storage.local.set(data);
  } catch (error) {
    // Check if it's a quota error
    if (error instanceof Error && error.message.includes('quota')) {
      throw new StorageQuotaError();
    }

    throw new StorageError(error instanceof Error ? error.message : 'Unknown storage error');
  }
}

/**
 * Safe storage get with error handling
 */
export async function safeStorageGet<T>(key: string): Promise<T | null> {
  try {
    const data = await browser.storage.local.get(key);
    return (data[key] as T) || null;
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : 'Unknown storage error',
      'Failed to load data. Please refresh and try again.'
    );
  }
}
