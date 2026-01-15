/**
 * Handler for domain-based extension enabling/disabling
 */
import { getStorageData, saveStorageData, notifySidebar } from '../storage';
import { updateContextMenu } from '../contextMenu';
import { isUrlDisabled } from '../../utils/url';

/**
 * Toggles the enabled/disabled state for a tab's domain
 * @param tabId The ID of the tab to toggle
 */
export async function toggleSiteEnabled(tabId: number) {
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

        if (index > -1) {
            // Enable: remove the found domain (could be hostname or parent) from disabled list
            disabledDomains.splice(index, 1);
            console.warn('=== BACKGROUND: Enabling domain:', foundDomain);
        } else {
            // Disable: add the exact hostname to disabled list
            disabledDomains.push(hostname);
            console.warn('=== BACKGROUND: Disabling domain:', hostname);
        }

        storageData.disabledDomains = disabledDomains;
        await saveStorageData(storageData);

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

        // Notify sidebar
        notifySidebar({
            type: 'SITE_ENABLED_CHANGED',
            data: { enabled: !isCurrentlyDisabled },
        });
    } catch (error) {
        console.error('Error toggling site enabled:', error);
    }
}
