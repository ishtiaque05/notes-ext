/**
 * Handler for screenshots and cropping
 */
import { MessageResponse, CapturedItem } from '../../types';
import { getStorageData, saveStorageData, notifySidebar } from '../storage';
import { checkStorageAvailable, getStorageWarning } from '../../utils/storage';

/**
 * Handler for requested screenshots (interactive mode)
 */
export async function handleRequestScreenshot(
    _data: unknown,
    sender: browser.runtime.MessageSender
): Promise<MessageResponse<{ dataUrl: string }>> {
    try {
        const windowId = sender.tab?.windowId;

        // Pass the specific window ID to ensure we capture the correct window
        const fullScreenshot = await browser.tabs.captureVisibleTab(windowId as number, { format: 'png' });

        return { success: true, data: { dataUrl: fullScreenshot } };
    } catch (error) {
        console.error('Error in request screenshot:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Handler for direct screenshot capture
 */
export async function handleCaptureScreenshot(data: {
    dataUrl: string;
    sourceUrl: string;
    dimensions: { width: number; height: number; x: number; y: number };
}): Promise<MessageResponse<CapturedItem>> {
    try {
        await checkStorageAvailable(data.dataUrl.length * 2);
        const storageData = await getStorageData();

        const newItem: CapturedItem = {
            id: self.crypto.randomUUID(),
            type: 'screenshot',
            order: storageData.nextOrder++,
            timestamp: Date.now(),
            content: data.dataUrl,
            metadata: {
                alt: `Screenshot from ${new URL(data.sourceUrl).hostname}`,
                sourceUrl: data.sourceUrl,
                dimensions: data.dimensions,
            },
        };

        storageData.items.push(newItem);
        await saveStorageData(storageData);

        notifySidebar({ type: 'ITEM_ADDED', data: newItem });
        const warning = await getStorageWarning();
        if (warning) notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });

        return { success: true, data: newItem };
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        return { success: false, error: String(error) };
    }
}
