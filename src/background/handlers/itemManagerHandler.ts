/**
 * Handler for managing the collection (deleting, reordering, clearing)
 */
import { MessageResponse, CapturedItem } from '../../types';
import { getStorageData, saveStorageData, notifySidebar } from '../storage';

/**
 * Handler for deleting a single item
 */
export async function handleDeleteItem(id: string): Promise<MessageResponse> {
    try {
        const storageData = await getStorageData();
        const originalLength = storageData.items.length;
        storageData.items = storageData.items.filter((item) => item.id !== id);

        if (storageData.items.length !== originalLength) {
            await saveStorageData(storageData);
            notifySidebar({ type: 'ITEM_DELETED', data: { id } });
            return { success: true };
        }

        return { success: false, error: 'Item not found' };
    } catch (error) {
        console.error('Error deleting item:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Handler for reordering items
 */
export async function handleReorderItems(items: CapturedItem[]): Promise<MessageResponse> {
    try {
        const storageData = await getStorageData();
        storageData.items = items;
        await saveStorageData(storageData);
        return { success: true };
    } catch (error) {
        console.error('Error reordering items:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Handler for clearing all items
 */
export async function handleClearAll(): Promise<MessageResponse> {
    try {
        const storageData = await getStorageData();
        storageData.items = [];
        storageData.nextOrder = 0;
        await saveStorageData(storageData);

        notifySidebar({ type: 'ITEMS_CLEARED' });
        return { success: true };
    } catch (error) {
        console.error('Error clearing items:', error);
        return { success: false, error: String(error) };
    }
}
