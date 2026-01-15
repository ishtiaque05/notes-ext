/**
 * Context menu management for background service worker
 */
export function createContextMenu() {
    browser.contextMenus.create({
        id: 'toggle-notes-collector',
        title: 'Disable Notes Collector on this page',
        contexts: ['all'],
    });
}

/**
 * Updates the context menu title based on the enabled state
 * @param isDisabled Whether the site is currently disabled
 */
export async function updateContextMenu(isDisabled: boolean) {
    try {
        await browser.contextMenus.update('toggle-notes-collector', {
            title: isDisabled
                ? 'Enable Notes Collector on this page'
                : 'Disable Notes Collector on this page',
        });
    } catch (error) {
        console.error('Failed to update context menu:', error);
    }
}
