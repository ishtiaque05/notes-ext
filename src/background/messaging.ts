/**
 * Central messaging hub for background service worker
 */
import { Message, MessageResponse } from '../types';
import * as captureHandler from './handlers/captureHandler';
import * as screenshotHandler from './handlers/screenshotHandler';
import * as itemManagerHandler from './handlers/itemManagerHandler';
import * as fetchHandler from './handlers/fetchHandler';
import * as siteEnabledHandler from './handlers/siteEnabledHandler';
import { getStorageData } from './storage';
import { isUrlDisabled } from '../utils/url';

export function setupMessaging() {
    browser.runtime.onMessage.addListener(
        (message: Message, sender: browser.runtime.MessageSender): Promise<MessageResponse> | void => {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Background received message:', message);
            }

            switch (message.type) {
                case 'FETCH_IMAGE':
                    return fetchHandler.handleFetchImage(message.data.url);
                case 'CAPTURE_LINK':
                    return captureHandler.handleCaptureLink(message.data);
                case 'CAPTURE_IMAGE':
                    return captureHandler.handleCaptureImage(message.data);
                case 'CAPTURE_TEXT':
                    return captureHandler.handleCaptureText(message.data);
                case 'REQUEST_SCREENSHOT':
                    return screenshotHandler.handleRequestScreenshot(message.data, sender);
                case 'CAPTURE_SCREENSHOT':
                    return screenshotHandler.handleCaptureScreenshot(message.data);
                case 'GET_ITEMS':
                    return handleGetItems();
                case 'DELETE_ITEM':
                    return itemManagerHandler.handleDeleteItem(message.data.id);
                case 'REORDER_ITEMS':
                    return itemManagerHandler.handleReorderItems(message.data.items);
                case 'CLEAR_ALL':
                    return itemManagerHandler.handleClearAll();
                case 'TOGGLE_SITE_ENABLED':
                    if ('tabId' in message.data) {
                        return (async () => {
                            await siteEnabledHandler.toggleSiteEnabled(message.data.tabId);
                            return { success: true };
                        })();
                    }
                    return Promise.resolve({ success: false, error: 'No tabId provided' });
                case 'CHECK_SITE_ENABLED':
                    return handleCheckSiteEnabled(message, sender);
                default:
                    return Promise.resolve({ success: false, error: 'Unknown message type' });
            }
        }
    );
}

/**
 * Internal handler for GET_ITEMS
 */
async function handleGetItems(): Promise<MessageResponse> {
    try {
        const storageData = await getStorageData();
        return { success: true, data: storageData.items };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Internal handler for CHECK_SITE_ENABLED
 */
async function handleCheckSiteEnabled(
    message: Message,
    sender: browser.runtime.MessageSender
): Promise<MessageResponse> {
    try {
        if (message.type !== 'CHECK_SITE_ENABLED') return { success: false };

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
}
