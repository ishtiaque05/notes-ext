/**
 * Handler for capturing links, images, and text
 */
import { MessageResponse, CapturedItem } from '../../types';
import { getStorageData, saveStorageData, notifySidebar } from '../storage';
import { checkStorageAvailable, getStorageWarning } from '../../utils/storage';

/**
 * Handler for capturing links
 */
export async function handleCaptureLink(data: {
  href: string;
  text: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    await checkStorageAvailable();
    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: self.crypto.randomUUID(),
      type: 'link',
      order: storageData.nextOrder++,
      timestamp: Date.now(),
      content: data.href,
      metadata: {
        text: data.text,
        href: data.href,
      },
    };

    storageData.items.push(newItem);
    await saveStorageData(storageData);

    notifySidebar({ type: 'ITEM_ADDED', data: newItem });
    const warning = await getStorageWarning();
    if (warning) notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing link:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for capturing images
 */
export async function handleCaptureImage(data: {
  src: string;
  alt: string;
  dataUrl: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    await checkStorageAvailable(data.dataUrl.length * 2);
    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: self.crypto.randomUUID(),
      type: 'image',
      order: storageData.nextOrder++,
      timestamp: Date.now(),
      content: data.dataUrl,
      metadata: {
        alt: data.alt,
        originalSrc: data.src,
      },
    };

    storageData.items.push(newItem);
    await saveStorageData(storageData);

    notifySidebar({ type: 'ITEM_ADDED', data: newItem });
    const warning = await getStorageWarning();
    if (warning) notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing image:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Handler for capturing text
 */
export async function handleCaptureText(data: {
  text: string;
  sourceUrl: string;
}): Promise<MessageResponse<CapturedItem>> {
  try {
    await checkStorageAvailable(data.text.length * 2);
    const storageData = await getStorageData();

    const newItem: CapturedItem = {
      id: self.crypto.randomUUID(),
      type: 'text',
      order: storageData.nextOrder++,
      timestamp: Date.now(),
      content: data.text,
      metadata: {
        text: data.text,
        sourceUrl: data.sourceUrl,
      },
    };

    storageData.items.push(newItem);
    await saveStorageData(storageData);

    notifySidebar({ type: 'ITEM_ADDED', data: newItem });
    const warning = await getStorageWarning();
    if (warning) notifySidebar({ type: 'STORAGE_WARNING', data: { message: warning } });

    return { success: true, data: newItem };
  } catch (error) {
    console.error('Error capturing text:', error);
    return { success: false, error: String(error) };
  }
}
